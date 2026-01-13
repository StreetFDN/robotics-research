'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { latLonToVector3 } from '@/utils/coordinates';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';

interface LabelData {
  company: PrivateCompany;
  position: THREE.Vector3;
  screenPos: { x: number; y: number };
  offsetPos?: THREE.Vector3; // Offset position if label needs to avoid overlap
}

const MIN_ZOOM_DISTANCE = 2.0; // Show labels when camera is closer than this
const MAX_LABELS = 50; // Maximum number of labels to show at once
const LABEL_OFFSET_DISTANCE = 0.05; // Distance to offset label when overlapping

export default function CompanyLabels({ radius = 1.002 }: { radius?: number }) {
  const { privateCompanies, showPrivateCompanies } = useGlobeStore();
  const { camera, size } = useThree();
  const labelsRef = useRef<LabelData[]>([]);

  // Filter valid companies
  const validCompanies = useMemo(() => {
    return privateCompanies.filter((company) => company.hq.lat !== 0 || company.hq.lon !== 0);
  }, [privateCompanies]);

  // Calculate which labels to show based on zoom and visibility
  useFrame(() => {
    if (!showPrivateCompanies || validCompanies.length === 0) {
      labelsRef.current = [];
      return;
    }

    const cameraDistance = camera.position.length();
    
    // Only show labels when zoomed in
    if (cameraDistance > MIN_ZOOM_DISTANCE) {
      labelsRef.current = [];
      return;
    }

    // Project company positions to screen space
    const labelCandidates: LabelData[] = [];
    const tempVector = new THREE.Vector3();
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());

    for (const company of validCompanies) {
      const position = latLonToVector3(company.hq.lat, company.hq.lon, radius);
      
      // Check if position is in front of camera
      tempVector.copy(position).sub(camera.position);
      if (tempVector.dot(cameraDirection) < 0) {
        continue; // Behind camera
      }

      // Project to screen space
      const projected = position.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (projected.y * -0.5 + 0.5) * size.height;

      labelCandidates.push({
        company,
        position,
        screenPos: { x, y },
      });
    }

    // Sort by distance from camera (closer first)
    labelCandidates.sort((a, b) => {
      const distA = camera.position.distanceTo(a.position);
      const distB = camera.position.distanceTo(b.position);
      return distA - distB;
    });

    // Resolve overlaps by trying multiple offset positions
    const visibleLabels: LabelData[] = [];
    const occupiedRegions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const LABEL_HEIGHT = 20; // Increased for larger font
    const LABEL_PADDING = 6;

    // Helper function to check if a position overlaps with existing labels
    const checkOverlap = (x: number, y: number, width: number, height: number): boolean => {
      for (const occupied of occupiedRegions) {
        if (
          x < occupied.x + occupied.width + LABEL_PADDING &&
          x + width > occupied.x - LABEL_PADDING &&
          y < occupied.y + occupied.height + LABEL_PADDING &&
          y + height > occupied.y - LABEL_PADDING
        ) {
          return true;
        }
      }
      return false;
    };

    // Helper function to convert screen offset to 3D world offset
    const screenOffsetToWorld = (screenDx: number, screenDy: number, basePos: THREE.Vector3): THREE.Vector3 => {
      // Get camera right and up vectors
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      
      // Calculate distance from camera to point
      const distance = camera.position.distanceTo(basePos);
      
      // Convert screen pixels to world units (approximate)
      const worldDx = (screenDx / size.width) * distance * 0.1;
      const worldDy = (screenDy / size.height) * distance * 0.1;
      
      // Apply offset in camera space
      return cameraRight.multiplyScalar(worldDx).add(cameraUp.multiplyScalar(worldDy));
    };

    // Helper function to find best offset position
    const findBestPosition = (
      baseX: number,
      baseY: number,
      width: number,
      height: number,
      worldPos: THREE.Vector3
    ): { x: number; y: number; worldPos: THREE.Vector3 } => {
      // Try positions in order of preference: top, top-right, top-left, right, left, bottom-right, bottom-left, bottom
      const offsets = [
        { dx: 0, dy: -height - LABEL_PADDING }, // Top
        { dx: width / 2 + LABEL_PADDING, dy: -height - LABEL_PADDING }, // Top-right
        { dx: -(width / 2 + LABEL_PADDING), dy: -height - LABEL_PADDING }, // Top-left
        { dx: width / 2 + LABEL_PADDING, dy: 0 }, // Right
        { dx: -(width / 2 + LABEL_PADDING), dy: 0 }, // Left
        { dx: width / 2 + LABEL_PADDING, dy: height + LABEL_PADDING }, // Bottom-right
        { dx: -(width / 2 + LABEL_PADDING), dy: height + LABEL_PADDING }, // Bottom-left
        { dx: 0, dy: height + LABEL_PADDING }, // Bottom
        // Try further offsets if needed
        { dx: width + LABEL_PADDING, dy: 0 }, // Further right
        { dx: -(width + LABEL_PADDING), dy: 0 }, // Further left
        { dx: 0, dy: -(height * 2 + LABEL_PADDING) }, // Further up
        { dx: 0, dy: height * 2 + LABEL_PADDING }, // Further down
      ];

      // Try each offset position
      for (const offset of offsets) {
        const testX = baseX + offset.dx;
        const testY = baseY + offset.dy;
        
        // Check if position is within screen bounds (with some margin)
        const margin = 20;
        if (testX < margin || testX + width > size.width - margin || 
            testY < margin || testY + height > size.height - margin) {
          continue;
        }

        if (!checkOverlap(testX, testY, width, height)) {
          // Convert screen offset to 3D world offset
          const worldOffset = screenOffsetToWorld(offset.dx, offset.dy, worldPos);
          return {
            x: testX,
            y: testY,
            worldPos: worldPos.clone().add(worldOffset),
          };
        }
      }

      // If all positions overlap, try to find least overlapping position
      let bestX = baseX;
      let bestY = baseY;
      let minOverlap = Infinity;

      for (const offset of offsets) {
        const testX = baseX + offset.dx;
        const testY = baseY + offset.dy;
        const margin = 20;
        if (testX < margin || testX + width > size.width - margin || 
            testY < margin || testY + height > size.height - margin) {
          continue;
        }

        // Count overlapping pixels
        let overlapCount = 0;
        for (const occupied of occupiedRegions) {
          const overlapX = Math.max(0, Math.min(testX + width, occupied.x + occupied.width) - Math.max(testX, occupied.x));
          const overlapY = Math.max(0, Math.min(testY + height, occupied.y + occupied.height) - Math.max(testY, occupied.y));
          overlapCount += overlapX * overlapY;
        }

        if (overlapCount < minOverlap) {
          minOverlap = overlapCount;
          bestX = testX;
          bestY = testY;
        }
      }

      const worldOffset = screenOffsetToWorld(bestX - baseX, bestY - baseY, worldPos);
      return {
        x: bestX,
        y: bestY,
        worldPos: worldPos.clone().add(worldOffset),
      };
    };

    for (const label of labelCandidates.slice(0, MAX_LABELS)) {
      const labelWidth = Math.min(label.company.name.length * 8 + 10, 200); // Increased for larger font
      const labelHeight = LABEL_HEIGHT;
      
      // Check if base position overlaps
      const baseOverlaps = checkOverlap(
        label.screenPos.x,
        label.screenPos.y,
        labelWidth,
        labelHeight
      );

      let finalX = label.screenPos.x;
      let finalY = label.screenPos.y;
      let labelPosition = label.position.clone();

      if (baseOverlaps) {
        // Find best non-overlapping position
        const bestPos = findBestPosition(
          label.screenPos.x,
          label.screenPos.y,
          labelWidth,
          labelHeight,
          label.position
        );
        finalX = bestPos.x;
        finalY = bestPos.y;
        labelPosition = bestPos.worldPos;
      }

      visibleLabels.push({
        ...label,
        offsetPos: baseOverlaps ? labelPosition : undefined,
      });

      occupiedRegions.push({
        x: finalX,
        y: finalY,
        width: labelWidth,
        height: labelHeight,
      });
    }

    labelsRef.current = visibleLabels;
  });

  if (!showPrivateCompanies || labelsRef.current.length === 0) {
    return null;
  }

  return (
    <>
      {labelsRef.current.map((labelData) => {
        const { company, position, offsetPos } = labelData;
        const labelPosition = offsetPos || position;
        const needsLine = offsetPos !== undefined;

        return (
          <group key={company.id}>
            {/* Connecting line if label is offset */}
            {needsLine && offsetPos && (
              <Line
                points={[position, offsetPos]}
                color="#666"
                lineWidth={0.5}
                transparent
                opacity={0.4}
              />
            )}
            
            {/* Label */}
            <Html
              position={labelPosition}
              distanceFactor={0.12}
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                transform: 'translate(-50%, -100%)',
              }}
              transform
            >
              <div
                className="text-gray-300 text-[40px] font-sans whitespace-nowrap"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {company.name}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

