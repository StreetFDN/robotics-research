'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToVector3 } from '@/utils/coordinates';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';
import { privateCompanyToCompany } from '@/utils/companyMapping';

const BASE_POINT_SIZE = 0.025; // Base size for points
const RED_COLOR = '#ff0000'; // Red to match existing company nodes
const OPACITY = {
  high: 0.9,
  med: 0.6,
  low: 0.35,
};

// Power scaling constants (1.2x to 2x range as per spec)
const POWER_SIZE_MIN = 1.2;
const POWER_SIZE_MAX = 2.0;
const POWER_GLOW_MIN = 1.0;
const POWER_GLOW_MAX = 1.5;

// Helper to extract power score from company (0-100 scale)
function getPowerScore(company: PrivateCompany): number {
  // Check for powerScore field
  if ('powerScore' in company && typeof (company as Record<string, unknown>).powerScore === 'number') {
    return (company as Record<string, unknown>).powerScore as number;
  }
  // Default to 50 (middle of 0-100 range) which maps to ~1.6x size
  return 50;
}

// Convert power score (0-100) to size multiplier (1.2x to 2.0x)
function powerToSizeMultiplier(power: number): number {
  const normalizedPower = Math.max(0, Math.min(power, 100)) / 100;
  return POWER_SIZE_MIN + (normalizedPower * (POWER_SIZE_MAX - POWER_SIZE_MIN));
}

// Convert power score to glow/brightness multiplier (1.0x to 1.5x)
function powerToGlowMultiplier(power: number): number {
  const normalizedPower = Math.max(0, Math.min(power, 100)) / 100;
  return POWER_GLOW_MIN + (normalizedPower * (POWER_GLOW_MAX - POWER_GLOW_MIN));
}

// ============================================================================
// NEWS ACTIVITY PULSE CONSTANTS (Sprint 3)
// ============================================================================
const NEWS_PULSE_COLOR_POSITIVE = '#00FFE0'; // Cyan for neutral/positive sentiment
const NEWS_PULSE_COLOR_NEGATIVE = '#FF3B3B'; // Red for negative sentiment
const NEWS_PULSE_MAX_COMPANIES = 10; // Limit pulsing to top 10 most active
const NEWS_PULSE_BASE_SPEED = 1.5; // Base pulse cycles per second
const NEWS_PULSE_MAX_SPEED = 4.0; // Max pulse speed for very active companies
const NEWS_PULSE_RING_RADIUS = 0.04; // Base ring radius

// News activity data structure (expected from company.newsActivity)
interface NewsActivityData {
  velocity: number; // 0-100 normalized news velocity
  sentiment: number; // -1 to 1 sentiment score
}

// Helper to extract news activity from company
function getNewsActivity(company: PrivateCompany): NewsActivityData | null {
  if ('newsActivity' in company) {
    const activity = (company as Record<string, unknown>).newsActivity;
    if (activity && typeof activity === 'object') {
      const act = activity as Record<string, unknown>;
      if (typeof act.velocity === 'number' && typeof act.sentiment === 'number') {
        return {
          velocity: act.velocity as number,
          sentiment: act.sentiment as number,
        };
      }
    }
  }
  return null;
}

// Get top N companies by news activity
function getTopNewsActiveCompanies(
  companies: PrivateCompany[],
  limit: number
): Array<{ company: PrivateCompany; activity: NewsActivityData }> {
  const withActivity = companies
    .map((company) => {
      const activity = getNewsActivity(company);
      return activity ? { company, activity } : null;
    })
    .filter((item): item is { company: PrivateCompany; activity: NewsActivityData } => item !== null)
    .sort((a, b) => b.activity.velocity - a.activity.velocity)
    .slice(0, limit);

  return withActivity;
}

// Get pulse color based on sentiment
function getPulseColor(sentiment: number): THREE.Color {
  if (sentiment < -0.3) {
    return new THREE.Color(NEWS_PULSE_COLOR_NEGATIVE);
  }
  return new THREE.Color(NEWS_PULSE_COLOR_POSITIVE);
}

// Get pulse speed based on news velocity (higher velocity = faster pulse)
function getPulseSpeed(velocity: number): number {
  const normalizedVelocity = Math.max(0, Math.min(velocity, 100)) / 100;
  return NEWS_PULSE_BASE_SPEED + normalizedVelocity * (NEWS_PULSE_MAX_SPEED - NEWS_PULSE_BASE_SPEED);
}

// ============================================================================
// GITHUB ACTIVITY PULSE CONSTANTS (Sprint 5)
// ============================================================================
const GITHUB_PULSE_COLOR_HIGH = '#00FF88'; // Bright green for high activity
const GITHUB_PULSE_COLOR_MED = '#00FFE0'; // Cyan for medium activity
const GITHUB_PULSE_COLOR_LOW = '#4ADE80'; // Muted green for low activity
const GITHUB_PULSE_MAX_COMPANIES = 10; // Limit to top 10 most active
const GITHUB_PULSE_BASE_SPEED = 0.8; // Slower, more subtle pulse
const GITHUB_PULSE_MAX_SPEED = 2.5; // Max pulse speed for very active repos
const GITHUB_PULSE_RING_RADIUS = 0.035; // Slightly smaller than news pulse

// GitHub activity data structure (expected from company.githubActivity)
interface GitHubActivityData {
  commitsWeek: number; // Weekly commit count
  starsTotal: number; // Total stars across repos
  recentReleases?: number; // Recent releases count
}

// Helper to extract GitHub activity from company
function getGitHubActivity(company: PrivateCompany): GitHubActivityData | null {
  if ('githubActivity' in company) {
    const activity = (company as Record<string, unknown>).githubActivity;
    if (activity && typeof activity === 'object') {
      const act = activity as Record<string, unknown>;
      if (typeof act.commitsWeek === 'number') {
        return {
          commitsWeek: act.commitsWeek as number,
          starsTotal: (act.starsTotal as number) || 0,
          recentReleases: (act.recentReleases as number) || 0,
        };
      }
    }
  }
  return null;
}

// Get top N companies by GitHub activity (commits per week)
function getTopGitHubActiveCompanies(
  companies: PrivateCompany[],
  limit: number
): Array<{ company: PrivateCompany; activity: GitHubActivityData }> {
  const withActivity = companies
    .map((company) => {
      const activity = getGitHubActivity(company);
      return activity ? { company, activity } : null;
    })
    .filter((item): item is { company: PrivateCompany; activity: GitHubActivityData } => item !== null)
    .sort((a, b) => b.activity.commitsWeek - a.activity.commitsWeek)
    .slice(0, limit);

  return withActivity;
}

// Get GitHub pulse color based on commit velocity
function getGitHubPulseColor(commitsWeek: number): THREE.Color {
  if (commitsWeek > 100) {
    return new THREE.Color(GITHUB_PULSE_COLOR_HIGH); // High activity
  } else if (commitsWeek > 30) {
    return new THREE.Color(GITHUB_PULSE_COLOR_MED); // Medium activity
  }
  return new THREE.Color(GITHUB_PULSE_COLOR_LOW); // Low activity
}

// Get GitHub pulse speed based on commit velocity
function getGitHubPulseSpeed(commitsWeek: number): number {
  // Normalize: 0-200+ commits/week → 0-1
  const normalizedActivity = Math.min(commitsWeek / 200, 1);
  return GITHUB_PULSE_BASE_SPEED + normalizedActivity * (GITHUB_PULSE_MAX_SPEED - GITHUB_PULSE_BASE_SPEED);
}

// Custom vertex shader supporting per-point sizes
const vertexShader = `
  attribute float size;
  attribute vec4 color;
  varying vec4 vColor;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Custom fragment shader for additive blending glow effect
const fragmentShader = `
  varying vec4 vColor;

  void main() {
    // Create circular point with soft edges
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float alpha = vColor.a * (1.0 - smoothstep(0.3, 0.5, dist));
    gl_FragColor = vec4(vColor.rgb, alpha);
  }
`;

// ============================================================================
// NEWS ACTIVITY PULSE RING COMPONENT (Sprint 3)
// ============================================================================
interface PulseRingProps {
  position: THREE.Vector3;
  color: THREE.Color;
  speed: number;
  baseRadius: number;
}

function PulseRing({ position, color, speed, baseRadius }: PulseRingProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2); // Random start phase

  // Calculate rotation to face outward from globe center
  const rotation = useMemo(() => {
    // The ring should face outward (normal = position normalized)
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    // Default ring faces +Z, rotate to face outward
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [position]);

  useFrame((_, delta) => {
    if (!ringRef.current) return;

    // Update phase
    phaseRef.current += delta * speed * Math.PI * 2;

    // Pulse animation: scale from 1x to 2x, opacity from 0.6 to 0
    const phase = phaseRef.current % (Math.PI * 2);
    const progress = phase / (Math.PI * 2);

    // Scale: 1.0 -> 2.0
    const scale = 1.0 + progress;
    ringRef.current.scale.setScalar(scale);

    // Opacity: 0.6 -> 0 (using material opacity)
    const material = ringRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = 0.6 * (1 - progress);
  });

  return (
    <mesh ref={ringRef} position={position} rotation={rotation}>
      <ringGeometry args={[baseRadius * 0.8, baseRadius, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// Component to render all pulse rings for news-active companies
interface NewsActivityPulseLayerProps {
  companies: PrivateCompany[];
  radius: number;
}

function NewsActivityPulseLayer({ companies, radius }: NewsActivityPulseLayerProps) {
  // Get top news-active companies
  const activeCompanies = useMemo(() => {
    return getTopNewsActiveCompanies(companies, NEWS_PULSE_MAX_COMPANIES);
  }, [companies]);

  // Calculate positions and pulse params for each active company
  const pulseData = useMemo(() => {
    return activeCompanies.map(({ company, activity }) => {
      const position = latLonToVector3(company.hq.lat, company.hq.lon, radius + 0.001);
      const color = getPulseColor(activity.sentiment);
      const speed = getPulseSpeed(activity.velocity);
      return {
        id: company.id,
        position,
        color,
        speed,
      };
    });
  }, [activeCompanies, radius]);

  if (pulseData.length === 0) return null;

  return (
    <>
      {pulseData.map((pulse) => (
        <PulseRing
          key={`pulse-${pulse.id}`}
          position={pulse.position}
          color={pulse.color}
          speed={pulse.speed}
          baseRadius={NEWS_PULSE_RING_RADIUS}
        />
      ))}
    </>
  );
}

// ============================================================================
// GITHUB ACTIVITY PULSE COMPONENTS (Sprint 5)
// ============================================================================

// GitHub pulse ring with double-ring effect for distinction from news pulses
interface GitHubPulseRingProps {
  position: THREE.Vector3;
  color: THREE.Color;
  speed: number;
  baseRadius: number;
  commitsWeek: number;
}

function GitHubPulseRing({ position, color, speed, baseRadius, commitsWeek }: GitHubPulseRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Calculate rotation to face outward from globe center
  const rotation = useMemo(() => {
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [position]);

  // Color intensity based on commits (brighter for more commits)
  const colorIntensity = useMemo(() => {
    const intensity = Math.min(commitsWeek / 150, 1);
    const adjustedColor = color.clone();
    adjustedColor.offsetHSL(0, 0, intensity * 0.2); // Slightly brighter
    return adjustedColor;
  }, [color, commitsWeek]);

  useFrame((_, delta) => {
    if (!innerRingRef.current || !outerRingRef.current) return;

    // Update phase
    phaseRef.current += delta * speed * Math.PI * 2;

    // Inner ring: standard pulse
    const innerPhase = phaseRef.current % (Math.PI * 2);
    const innerProgress = innerPhase / (Math.PI * 2);
    const innerScale = 1.0 + innerProgress * 0.8;
    innerRingRef.current.scale.setScalar(innerScale);
    (innerRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - innerProgress);

    // Outer ring: delayed pulse (offset by half cycle)
    const outerPhase = (phaseRef.current + Math.PI) % (Math.PI * 2);
    const outerProgress = outerPhase / (Math.PI * 2);
    const outerScale = 1.0 + outerProgress * 1.2;
    outerRingRef.current.scale.setScalar(outerScale);
    (outerRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - outerProgress);
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Inner ring */}
      <mesh ref={innerRingRef}>
        <ringGeometry args={[baseRadius * 0.7, baseRadius * 0.9, 32]} />
        <meshBasicMaterial
          color={colorIntensity}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer ring (delayed) */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[baseRadius * 1.0, baseRadius * 1.15, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// Component to render GitHub activity pulses
interface GitHubActivityPulseLayerProps {
  companies: PrivateCompany[];
  radius: number;
  enabled?: boolean;
}

function GitHubActivityPulseLayer({ companies, radius, enabled = true }: GitHubActivityPulseLayerProps) {
  // Get top GitHub-active companies
  const activeCompanies = useMemo(() => {
    if (!enabled) return [];
    return getTopGitHubActiveCompanies(companies, GITHUB_PULSE_MAX_COMPANIES);
  }, [companies, enabled]);

  // Calculate positions and pulse params
  const pulseData = useMemo(() => {
    return activeCompanies.map(({ company, activity }) => {
      // Offset slightly more than news pulse to avoid overlap
      const position = latLonToVector3(company.hq.lat, company.hq.lon, radius + 0.003);
      const color = getGitHubPulseColor(activity.commitsWeek);
      const speed = getGitHubPulseSpeed(activity.commitsWeek);
      return {
        id: company.id,
        position,
        color,
        speed,
        commitsWeek: activity.commitsWeek,
      };
    });
  }, [activeCompanies, radius]);

  if (!enabled || pulseData.length === 0) return null;

  return (
    <>
      {pulseData.map((pulse) => (
        <GitHubPulseRing
          key={`github-pulse-${pulse.id}`}
          position={pulse.position}
          color={pulse.color}
          speed={pulse.speed}
          baseRadius={GITHUB_PULSE_RING_RADIUS}
          commitsWeek={pulse.commitsWeek}
        />
      ))}
    </>
  );
}

interface PrivateCompaniesLayerProps {
  radius?: number;
}

export default function PrivateCompaniesLayer({ radius = 1.002 }: PrivateCompaniesLayerProps) {
  const { privateCompanies, showPrivateCompanies, setSelectedCompanyId, setSelectedCompany, setHoveredPrivateCompany, setSelectedPrivateCompany, hoveredPrivateCompany } = useGlobeStore();

  // Check for GitHub activity visualization toggle in store (default: enabled)
  const showGitHubActivity = useGlobeStore((state) =>
    'showGitHubActivity' in state ? (state as Record<string, unknown>).showGitHubActivity as boolean : true
  );
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

  const { positions, colors, sizes } = useMemo(() => {
    if (!showPrivateCompanies || validCompanies.length === 0) {
      return { positions: new Float32Array(0), colors: new Float32Array(0), sizes: new Float32Array(0) };
    }

    const positionsArray: number[] = [];
    const colorsArray: number[] = [];
    const sizesArray: number[] = [];
    const redColor = new THREE.Color(RED_COLOR);

    validCompanies.forEach((company) => {
      const position = latLonToVector3(company.hq.lat, company.hq.lon, radius);
      positionsArray.push(position.x, position.y, position.z);

      // Get power score for this company
      const powerScore = getPowerScore(company);
      const sizeMultiplier = powerToSizeMultiplier(powerScore);
      const glowMultiplier = powerToGlowMultiplier(powerScore);

      // Set color and opacity based on confidence, boosted by power glow
      const baseOpacity = OPACITY[company.hq.confidence] || OPACITY.low;
      const boostedOpacity = Math.min(1.0, baseOpacity * glowMultiplier);

      // Boost color brightness for high-power companies
      const boostedColor = redColor.clone();
      if (powerScore > 70) {
        // Add slight brightness boost for high-power companies
        boostedColor.offsetHSL(0, 0, (powerScore - 70) / 200);
      }

      colorsArray.push(boostedColor.r, boostedColor.g, boostedColor.b, boostedOpacity);

      // Calculate final point size
      sizesArray.push(BASE_POINT_SIZE * sizeMultiplier);
    });

    return {
      positions: new Float32Array(positionsArray),
      colors: new Float32Array(colorsArray),
      sizes: new Float32Array(sizesArray),
    };
  }, [validCompanies, showPrivateCompanies, radius]);

  // Create geometry and material with custom shader for per-point sizes
  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4, true));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Use custom ShaderMaterial for per-point sizing based on power
    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geom, material: mat };
  }, [positions, colors, sizes]);

  // Store positions and sizes for raycasting (computed once)
  const companyPositions = useMemo(() => {
    return validCompanies.map((company) => latLonToVector3(company.hq.lat, company.hq.lon, radius));
  }, [validCompanies, radius]);

  // Store hit radii based on power-scaled sizes
  const companyHitRadii = useMemo(() => {
    return validCompanies.map((company) => {
      const powerScore = getPowerScore(company);
      const sizeMultiplier = powerToSizeMultiplier(powerScore);
      return BASE_POINT_SIZE * sizeMultiplier * 3; // Hit radius is 3x visual size
    });
  }, [validCompanies]);

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

    // Check each point position with power-scaled hit radii
    const ray = raycaster.ray;
    for (let i = 0; i < companyPositions.length; i++) {
      const pointPosition = companyPositions[i];
      const hitRadius = companyHitRadii[i];

      // Create sphere with power-scaled radius for intersection testing
      const pointSphere = new THREE.Sphere(pointPosition, hitRadius);

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

  // Handle click - pin selection
  const handleClick = useCallback(() => {
    if (hoveredPrivateCompany) {
      // Pin this company (persists when hover changes)
      setSelectedPrivateCompany(hoveredPrivateCompany);
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
  }, [hoveredPrivateCompany, setSelectedPrivateCompany, setSelectedCompanyId, setSelectedCompany, camera]);

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
      {/* News activity pulse rings (Sprint 3) */}
      <NewsActivityPulseLayer companies={validCompanies} radius={radius} />
      {/* GitHub activity pulse rings (Sprint 5) */}
      <GitHubActivityPulseLayer
        companies={validCompanies}
        radius={radius}
        enabled={showGitHubActivity}
      />
    </>
  );
}
