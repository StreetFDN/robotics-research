'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToVector3 } from '@/utils/coordinates';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';
import { privateCompanyToCompany } from '@/utils/companyMapping';

const POINT_SIZE = 0.025; // Increased from 0.008 for visibility (smaller than major hubs at 0.02)
const RED_COLOR = '#ff0000'; // Red to match existing company nodes
const OPACITY = {
  high: 0.9,
  med: 0.6,
  low: 0.35,
};

interface PrivateCompaniesLayerProps {
  radius?: number;
}

export default function PrivateCompaniesLayer({ radius = 1.002 }: PrivateCompaniesLayerProps) {
  const { privateCompanies, showPrivateCompanies, setSelectedCompanyId, setSelectedCompany, setHoveredPrivateCompany, hoveredPrivateCompany } = useGlobeStore();
  const { camera, raycaster, pointer, size } = useThree();
  const pointsRef = useRef<THREE.Points>(null);

  // Debug: Log layer state
  console.log('[DEBUG PrivateCompaniesLayer] Mounted - privateCompanies.length:', privateCompanies.length, 'showPrivateCompanies:', showPrivateCompanies);

  // Filter valid companies and create positions/colors
  const validCompanies = useMemo(() => {
    const valid = privateCompanies.filter((company) => company.hq.lat !== 0 || company.hq.lon !== 0);
    console.log('[DEBUG PrivateCompaniesLayer] Valid companies:', valid.length, 'out of', privateCompanies.length);
    return valid;
  }, [privateCompanies]);

  const { positions, colors } = useMemo(() => {
    if (!showPrivateCompanies || validCompanies.length === 0) {
      return { positions: new Float32Array(0), colors: new Float32Array(0) };
    }

    const positionsArray: number[] = [];
    const colorsArray: number[] = [];
    const redColor = new THREE.Color(RED_COLOR);

    validCompanies.forEach((company) => {
      const position = latLonToVector3(company.hq.lat, company.hq.lon, radius);
      positionsArray.push(position.x, position.y, position.z);

      // Set color and opacity based on confidence
      const opacity = OPACITY[company.hq.confidence] || OPACITY.low;
      colorsArray.push(redColor.r, redColor.g, redColor.b, opacity);
    });

    return {
      positions: new Float32Array(positionsArray),
      colors: new Float32Array(colorsArray),
    };
  }, [validCompanies, showPrivateCompanies, radius]);

  // Create geometry and material
  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4, true));

    const mat = new THREE.PointsMaterial({
      size: POINT_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geom, material: mat };
  }, [positions, colors]);

  // Store positions for raycasting (computed once)
  const companyPositions = useMemo(() => {
    return validCompanies.map((company) => latLonToVector3(company.hq.lat, company.hq.lon, radius));
  }, [validCompanies, radius]);

  // Handle hover and click with raycasting
  useFrame(() => {
    if (!pointsRef.current || !showPrivateCompanies || validCompanies.length === 0) {
      setHoveredPrivateCompany(null);
      return;
    }

    // Update raycaster
    raycaster.setFromCamera(pointer, camera);

    let closestDistance = Infinity;
    let closestIndex = -1;

    // Check each point position
    const ray = raycaster.ray;
    for (let i = 0; i < companyPositions.length; i++) {
      const pointPosition = companyPositions[i];

      // Create a small sphere at the point for intersection testing
      const pointSphere = new THREE.Sphere(pointPosition, POINT_SIZE * 3);
      
      // Check if ray intersects the sphere
      const intersection = ray.intersectSphere(pointSphere, new THREE.Vector3());
      if (intersection) {
        const distance = intersection.distanceTo(ray.origin);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
    }

    if (closestIndex >= 0 && closestIndex < validCompanies.length) {
      setHoveredPrivateCompany(validCompanies[closestIndex]);
      document.body.style.cursor = 'pointer';
    } else {
      setHoveredPrivateCompany(null);
      document.body.style.cursor = 'default';
    }
  });

  // Handle click
  const handleClick = useCallback(() => {
    if (hoveredPrivateCompany) {
      setSelectedCompanyId(hoveredPrivateCompany.id);
      // Also set selectedCompany for list highlighting
      setSelectedCompany(privateCompanyToCompany(hoveredPrivateCompany));

      // Center camera on company
      const target = latLonToVector3(hoveredPrivateCompany.hq.lat, hoveredPrivateCompany.hq.lon);
      const direction = target.clone().normalize();
      const newPosition = direction.multiplyScalar(2.5);

      const startPosition = camera.position.clone();
      let progress = 0;
      const duration = 2000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, newPosition, ease);
        camera.lookAt(target);
        camera.updateProjectionMatrix();

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [hoveredPrivateCompany, setSelectedCompanyId, setSelectedCompany, camera]);

  if (!showPrivateCompanies || validCompanies.length === 0) {
    return null;
  }

  return (
    <>
      <points
        ref={pointsRef}
        geometry={geometry}
        material={material}
        onClick={handleClick}
        frustumCulled
      />
    </>
  );
}
