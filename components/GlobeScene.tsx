'use client';

import { Component, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Globe from './Globe';

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
        <Globe />
        <EffectComposer>
          <Bloom intensity={0.3} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </WebGLErrorBoundary>
  );
}

