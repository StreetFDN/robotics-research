'use client';

import { useMemo, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { latLonToVector3 } from '@/utils/coordinates';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][][] | number[][];
  };
  properties?: Record<string, any>;
}

interface GeoJSON {
  type: string;
  features: GeoJSONFeature[];
}

const COASTLINE_RADIUS = 1.001; // Slightly larger to avoid z-fighting
const COASTLINE_COLOR = '#00B8A3'; // Muted cyan/teal
const COASTLINE_OPACITY = 0.35;
const COASTLINE_WIDTH = 1.5;

export default function Coastlines() {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON | null>(null);
  const { size } = useThree();

  // Load GeoJSON
  useEffect(() => {
    fetch('/data/coastline50.geojson')
      .then((res) => res.json())
      .then((data: GeoJSON) => {
        setGeoJsonData(data);
      })
      .catch((err) => {
        console.error('Failed to load coastline data:', err);
      });
  }, []);

  // Process GeoJSON and create line segments geometry
  // Build LINE SEGMENTS: for each LineString, add segments (p[i], p[i+1]) for i in [0..n-2]
  // Handle dateline: if abs(lon[i]-lon[i-1]) > 180, skip connecting
  const coastlineGroup = useMemo(() => {
    if (!geoJsonData) return null;

    const positions: number[] = [];

    const processLineString = (coordinates: number[][]) => {
      if (coordinates.length < 2) return;

      for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];

        // Handle dateline crossing: skip if longitude difference > 180 degrees
        const lonDiff = Math.abs(lon2 - lon1);
        if (lonDiff > 180) {
          continue; // Skip this segment, start new segment on next iteration
        }

        // Add segment: (p[i], p[i+1])
        const p1 = latLonToVector3(lat1, lon1, COASTLINE_RADIUS);
        const p2 = latLonToVector3(lat2, lon2, COASTLINE_RADIUS);

        positions.push(p1.x, p1.y, p1.z);
        positions.push(p2.x, p2.y, p2.z);
      }
    };

    // Process all features
    geoJsonData.features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        const coordinates = feature.geometry.coordinates as number[][];
        processLineString(coordinates);
      } else if (feature.geometry.type === 'MultiLineString') {
        const coordinates = feature.geometry.coordinates as number[][][];
        coordinates.forEach((lineString) => {
          processLineString(lineString);
        });
      }
    });

    // Create LineSegmentsGeometry from positions
    if (positions.length >= 6) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);

      const material = new LineMaterial({
        color: COASTLINE_COLOR,
        linewidth: COASTLINE_WIDTH,
        transparent: true,
        opacity: COASTLINE_OPACITY,
        depthTest: true,
        resolution: new THREE.Vector2(size.width, size.height),
      });

      const line = new LineSegments2(geometry, material);
      return line;
    }

    return null;
  }, [geoJsonData, size.width, size.height]);

  // Update material resolution on resize
  useEffect(() => {
    if (coastlineGroup?.material) {
      const material = coastlineGroup.material as LineMaterial;
      material.resolution.set(size.width, size.height);
    }
  }, [size.width, size.height, coastlineGroup]);

  if (!coastlineGroup) return null;

  return <primitive object={coastlineGroup} />;
}

