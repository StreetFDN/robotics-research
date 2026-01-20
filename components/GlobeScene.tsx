'use client';

import { Component, ReactNode, useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
// import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Globe from './Globe';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';

// ============================================================================
// NARRATIVE INDEX GLOBE OVERLAY (Sprint 6)
// ============================================================================

// Narrative score thresholds and visual settings
const NARRATIVE_THRESHOLDS = {
  HIGH: 70,    // >70: Strong narrative
  MEDIUM: 40,  // 40-70: Building
  LOW: 0,      // <40: Weak
};

const NARRATIVE_COLORS = {
  HIGH: '#00FFE0',   // Cyan for strong narrative
  MEDIUM: '#FFB800', // Amber for building
  LOW: '#444444',    // Dim gray for weak
};

const NARRATIVE_PULSE_SPEEDS = {
  HIGH: 0.3,    // Very subtle pulse
  MEDIUM: 0.15, // Barely visible pulse
  LOW: 0,       // No pulse
};

// Helper to get narrative level from score
function getNarrativeLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= NARRATIVE_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= NARRATIVE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// Narrative globe glow component - renders animated sphere around globe
function NarrativeGlobeGlow() {
  const meshRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(0);

  // Check for narrative score in store (fallback to mock if not available)
  const narrativeScore = useGlobeStore((state) => {
    if ('narrativeScore' in state) {
      return (state as Record<string, unknown>).narrativeScore as number;
    }
    // Default mock score for development - will be replaced by real API data
    return 72; // "BUILDING" level for demo
  });

  // Get visual settings based on score
  const { color, pulseSpeed, opacity } = useMemo(() => {
    const level = getNarrativeLevel(narrativeScore);
    return {
      color: new THREE.Color(NARRATIVE_COLORS[level]),
      pulseSpeed: NARRATIVE_PULSE_SPEEDS[level],
      opacity: level === 'LOW' ? 0.05 : level === 'MEDIUM' ? 0.12 : 0.18,
    };
  }, [narrativeScore]);

  // Animate the glow pulse - very subtle, no flickering
  useFrame((_, delta) => {
    if (!meshRef.current || pulseSpeed === 0) return;

    phaseRef.current += delta * pulseSpeed;

    // Very subtle pulse animation - almost imperceptible
    const pulse = Math.sin(phaseRef.current * Math.PI * 2) * 0.5 + 0.5;

    // Scale: 1.01 to 1.02 (barely visible)
    const scale = 1.01 + pulse * 0.01;
    meshRef.current.scale.setScalar(scale);

    // Opacity: base ± 10% (very subtle)
    const material = meshRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = opacity * (0.9 + pulse * 0.2);
  });

  // Don't render if score is very low
  if (narrativeScore < 20) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.015, 64, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// Narrative score indicator overlay (HTML)
function NarrativeScoreIndicator() {
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch narrative score from API
  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch('/api/narrative/score');
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.data?.overall) {
            setScore(data.data.overall);
          }
        }
      } catch {
        // Silently fail - API may not be available yet
      } finally {
        setLoading(false);
      }
    }

    fetchScore();
    // Refresh every 5 minutes
    const interval = setInterval(fetchScore, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Don't show if no score or loading
  if (loading || score === null) return null;

  const level = getNarrativeLevel(score);
  const levelLabel = level === 'HIGH' ? 'STRONG' : level === 'MEDIUM' ? 'BUILDING' : 'WEAK';
  const color = NARRATIVE_COLORS[level];

  return (
    <div className="absolute top-3 left-3 z-40 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-sm px-2 py-1">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-[9px] font-mono text-white/60">
            NARRATIVE: <span style={{ color }}>{score}%</span>
          </span>
          <span className="text-[8px] font-mono" style={{ color }}>
            {levelLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// Premium degraded mode UI component
function GlobeDegradedState({
  title,
  message,
  details
}: {
  title: string;
  message: string;
  details?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-0 bg-[#101318]">
      {/* Subtle radial gradient background mimicking globe presence */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 217, 255, 0.02) 0%, rgba(16, 19, 24, 0.9) 50%, rgba(16, 19, 24, 1) 100%)',
        }}
      />

      {/* Decorative rings suggesting globe silhouette */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-full border border-white/[0.04]"
          style={{ width: '60%', height: '60%', maxWidth: '400px', maxHeight: '400px' }}
        />
        <div
          className="absolute rounded-full border border-white/[0.03]"
          style={{ width: '45%', height: '45%', maxWidth: '300px', maxHeight: '300px' }}
        />
        <div
          className="absolute rounded-full border border-white/[0.02]"
          style={{ width: '30%', height: '30%', maxWidth: '200px', maxHeight: '200px' }}
        />
      </div>

      {/* Content card - sharp corners */}
      <div className="relative text-center p-6 max-w-sm mx-4">
        <div className="rounded-sm bg-[#101318] border border-white/[0.08] p-5">
          {/* Globe icon placeholder */}
          <div className="flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-white/[0.32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <circle cx="12" cy="12" r="10" />
              <ellipse cx="12" cy="12" rx="10" ry="4" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
          </div>

          <h2 className="text-[14px] font-medium text-white/[0.72] mb-2">{title}</h2>
          <p className="text-[12px] text-white/[0.48] leading-relaxed mb-3">
            {message}
          </p>

          {details && (
            <p className="text-[10px] text-white/[0.32] font-mono bg-black/20 rounded-sm px-2 py-1.5 mb-3">
              {details}
            </p>
          )}

          <div className="text-left text-[11px] text-white/[0.36] space-y-1 pt-3 border-t border-white/[0.06]">
            <p className="text-white/[0.48] mb-1.5">Try:</p>
            <p>→ Refresh the page</p>
            <p>→ Enable hardware acceleration</p>
            <p>→ Update graphics drivers</p>
          </div>
        </div>
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log with [globe-init] prefix for easy filtering
    console.error('[globe-init] WebGL rendering error:', error.message);
    console.error('[globe-init] Error details:', error);
    console.error('[globe-init] Component stack:', errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <GlobeDegradedState
          title="Globe Rendering Degraded"
          message="WebGL initialization failed. The dashboard remains fully functional with all data, charts, and controls available."
          details={this.state.error?.message}
        />
      );
    }

    return this.props.children;
  }
}

function checkWebGLSupport(): { supported: boolean; error?: string } {
  if (typeof window === 'undefined') {
    return { supported: false, error: 'Server-side rendering detected' };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      console.error('[globe-init] WebGL context creation failed');
      return { supported: false, error: 'WebGL context creation failed' };
    }

    // Verify basic WebGL functionality
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      console.log('[globe-init] WebGL renderer:', renderer);
    }

    return { supported: true };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown WebGL error';
    console.error('[globe-init] WebGL support check failed:', errorMsg);
    return { supported: false, error: errorMsg };
  }
}

// Helper to extract confidence value from a company
function getConfidenceValue(company: PrivateCompany | null): number {
  if (!company) return 0.7;

  // Use dataQuality field if it exists
  if ('dataQuality' in company && typeof (company as Record<string, unknown>).dataQuality === 'number') {
    return (company as Record<string, unknown>).dataQuality as number;
  }

  // Map hq.confidence string to numeric value
  const confidenceMap: Record<string, number> = { high: 0.9, med: 0.7, low: 0.4 };
  return confidenceMap[company.hq?.confidence] || 0.7;
}

// Confidence overlay component for hovered companies
function ConfidenceOverlay() {
  const hoveredPrivateCompany = useGlobeStore((state) => state.hoveredPrivateCompany);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!hoveredPrivateCompany) return null;

  const confidence = getConfidenceValue(hoveredPrivateCompany);
  const percentage = Math.round(confidence * 100);

  return (
    <div
      className="fixed text-[9px] font-mono text-white/40 pointer-events-none z-50 select-none"
      style={{
        left: mousePos.x + 14,
        top: mousePos.y + 28,
      }}
    >
      Data: {percentage}%
    </div>
  );
}

// Effects disabled - causing WebGL context issues
// TODO: Re-enable once postprocessing library is updated
function SafeEffects() {
  return null;
}

// Safe Canvas initialization handler
function handleCanvasCreated({ gl }: { gl: THREE.WebGLRenderer }) {
  try {
    if (!gl) {
      console.error('[globe-init] WebGL renderer is null');
      return;
    }

    // Guard: Check if setClearColor exists before calling
    if (typeof gl.setClearColor === 'function') {
      gl.setClearColor(0x000000, 0);
    } else {
      console.error('[globe-init] setClearColor method not available');
    }

    // Guard: Check if domElement exists before accessing
    if (gl.domElement) {
      gl.domElement.style.width = '100%';
      gl.domElement.style.height = '100%';
    } else {
      console.error('[globe-init] domElement not available');
    }

    console.log('[globe-init] Canvas initialized successfully');
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown initialization error';
    console.error('[globe-init] Canvas initialization error:', errorMsg);
    // Don't throw - let the error boundary catch rendering errors
  }
}

export default function GlobeScene() {
  const webglCheck = checkWebGLSupport();

  if (!webglCheck.supported) {
    return (
      <GlobeDegradedState
        title="Globe Rendering Degraded"
        message="WebGL is required for the 3D globe but isn't available. The dashboard remains fully functional with all data, charts, and controls."
        details={webglCheck.error}
      />
    );
  }

  return (
    <WebGLErrorBoundary>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          stencil: false,
          depth: true,
        }}
        style={{ background: 'transparent' }}
        onCreated={handleCanvasCreated}
      >
        {/* Narrative glow overlay (Sprint 6) - renders behind globe */}
        <NarrativeGlobeGlow />
        <Globe />
        <Suspense fallback={null}>
          <SafeEffects />
        </Suspense>
      </Canvas>
      {/* Narrative score indicator (Sprint 6) */}
      <NarrativeScoreIndicator />
      <ConfidenceOverlay />
    </WebGLErrorBoundary>
  );
}

