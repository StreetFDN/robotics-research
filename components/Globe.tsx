'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { latLonToVector3, createArc } from '@/utils/coordinates';
import { useGlobeStore } from '@/store/globeStore';
import { Company, Event } from '@/types';
import Coastlines from './Coastlines';
import PrivateCompaniesLayer from './PrivateCompaniesLayer';
import CompanyLabels from './CompanyLabels';

interface GlobeProps {
  cameraPosition?: [number, number, number];
}

export default function Globe({ cameraPosition = [0, 0, 3] }: GlobeProps) {
  const globeRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { companies, events, selectedCompany, rotationSpeed, showGrid, showArcs, showNodes } =
    useGlobeStore();

  // Rotate globe
  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += rotationSpeed * delta * 0.01;
    }
  });

  // Animate camera to selected company
  useEffect(() => {
    if (selectedCompany) {
      const target = latLonToVector3(selectedCompany.hq_lat, selectedCompany.hq_lon);
      const direction = target.clone().normalize();
      const newPosition = direction.multiplyScalar(2.5);

      // Smooth camera animation
      const startPosition = camera.position.clone();
      const startTarget = new THREE.Vector3(0, 0, 0);
      const endTarget = target.clone();

      let progress = 0;
      const duration = 2000; // 2 seconds
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        camera.position.lerpVectors(startPosition, newPosition, ease);
        
        const currentTarget = new THREE.Vector3().lerpVectors(startTarget, endTarget, ease);
        camera.lookAt(currentTarget);
        camera.updateProjectionMatrix();

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [selectedCompany, camera]);

  // Create latitude/longitude grid
  const gridLines = useMemo(() => {
    if (!showGrid) return null;

    const lines: JSX.Element[] = [];
    const segments = 64;

    // Latitude lines
    for (let lat = -80; lat <= 80; lat += 20) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const lon = (i / segments) * 360 - 180;
        points.push(latLonToVector3(lat, lon));
      }
      lines.push(
        <Line
          key={`lat-${lat}`}
          points={points}
          color="#2A3A4A"
          lineWidth={0.5}
          transparent
          opacity={0.3}
        />
      );
    }

    // Longitude lines
    for (let lon = -180; lon <= 180; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const lat = (i / segments) * 180 - 90;
        points.push(latLonToVector3(lat, lon));
      }
      lines.push(
        <Line
          key={`lon-${lon}`}
          points={points}
          color="#2A3A4A"
          lineWidth={0.5}
          transparent
          opacity={0.3}
        />
      );
    }

    return <group ref={gridRef}>{lines}</group>;
  }, [showGrid]);

  // Create arcs between major hubs
  const arcs = useMemo(() => {
    if (!showArcs || companies.length < 2) return null;

    const majorHubs = companies.slice(0, 4); // Top 4 companies
    const arcElements: JSX.Element[] = [];

    for (let i = 0; i < majorHubs.length; i++) {
      for (let j = i + 1; j < majorHubs.length; j++) {
        const start = majorHubs[i];
        const end = majorHubs[j];
        const arcPoints = createArc(start.hq_lat, start.hq_lon, end.hq_lat, end.hq_lon, 50);

        arcElements.push(
          <Line
            key={`arc-${start.id}-${end.id}`}
            points={arcPoints}
            color="#00D9FF"
            lineWidth={1}
            transparent
            opacity={0.2}
            dashed
          />
        );
      }
    }

    return <group>{arcElements}</group>;
  }, [companies, showArcs]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#00D9FF" />

      {/* Globe wireframe sphere */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial
          color="#1A1F2E"
          wireframe
          transparent
          opacity={0.8}
          emissive="#0D1015"
          emissiveIntensity={0.1}
        />
      </Sphere>

      {/* Subtle surface fill */}
      <Sphere args={[0.99, 64, 64]}>
        <meshStandardMaterial
          color="#0D1015"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Depth-only sphere for backside visibility (writes depth but not color) */}
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial
          colorWrite={false}
          depthWrite={true}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Grid lines */}
      {gridLines}

      {/* Coastlines */}
      <Coastlines />

      {/* Private Companies Layer */}
      <PrivateCompaniesLayer />
      <CompanyLabels />

      {/* Arcs - disabled to match private companies style */}
      {/* {arcs} */}

      {/* Company nodes - unified style with private companies */}
      {showNodes && companies.length > 0 && (
        <CompanyPointsLayer companies={companies} selectedCompany={selectedCompany} />
      )}

      {/* Event markers */}
      {events.map((event) => {
        if (!event.lat || !event.lon) return null;
        const position = latLonToVector3(event.lat, event.lon);
        return <EventMarker key={event.id} position={position} event={event} />;
      })}

      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// Unified company points layer (matches private companies style)
interface CompanyPointsLayerProps {
  companies: Company[];
  selectedCompany: Company | null;
}

function CompanyPointsLayer({ companies, selectedCompany }: CompanyPointsLayerProps) {
  const { setSelectedCompany } = useGlobeStore();
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(companies.length * 3);
    const colors = new Float32Array(companies.length * 4);

    const redColor = new THREE.Color('#ff0000');
    const orangeColor = new THREE.Color('#FFB020');

    companies.forEach((company, i) => {
      const position = latLonToVector3(company.hq_lat, company.hq_lon);
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const isSelected = selectedCompany?.id === company.id;
      const color = isSelected ? orangeColor : redColor;
      colors[i * 4] = color.r;
      colors[i * 4 + 1] = color.g;
      colors[i * 4 + 2] = color.b;
      colors[i * 4 + 3] = 0.9;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4, true));

    const mat = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geom, material: mat };
  }, [companies, selectedCompany]);

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled />;
}

interface EventMarkerProps {
  position: THREE.Vector3;
  event: Event;
}

function EventMarker({ position, event }: EventMarkerProps) {
  const colorMap = {
    high: '#FF4444',
    medium: '#FFB020',
    low: '#00D9FF',
  };

  const color = colorMap[event.severity || 'low'];

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.015, 0.015, 0.015]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

