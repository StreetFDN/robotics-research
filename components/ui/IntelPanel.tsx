'use client';

import React, { ReactNode } from 'react';

interface IntelPanelProps {
  /** Panel title displayed in header */
  title: string;
  /** Optional subtitle shown below title */
  subtitle?: string;
  /** Optional content on the right side of header (meta info, stats) */
  headerRight?: ReactNode;
  /** Main panel content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Remove default padding from content area */
  noPadding?: boolean;
  /** Panel variant for different contexts */
  variant?: 'default' | 'compact' | 'accent';
  /** Full height panel with scrollable content */
  fullHeight?: boolean;
  /** Show LIVE status indicator in header */
  showLive?: boolean;
}

/**
 * IntelPanel - Premium institutional panel wrapper
 * Street Foundation glassmorphism + Palantir intel style
 */
export default function IntelPanel({
  title,
  subtitle,
  headerRight,
  children,
  className = '',
  noPadding = false,
  variant = 'default',
  fullHeight = false,
  showLive = false,
}: IntelPanelProps) {
  // GLASSMORPHISM: backdrop-blur + subtle transparency
  const variantStyles = {
    default: 'bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
    compact: 'bg-black/40 backdrop-blur-xl border border-white/[0.06] rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    // ACCENT: for selected/important panels - cyan glow
    accent: 'bg-black/40 backdrop-blur-xl border border-[#00FFE0]/20 rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(0,255,224,0.08)]',
  };

  const headerPadding = variant === 'compact' ? 'px-3 py-2' : 'px-3 py-2';
  const contentPadding = noPadding ? '' : variant === 'compact' ? 'p-3' : 'p-3';

  const containerClass = fullHeight
    ? `flex flex-col h-full ${variantStyles[variant]} ${className}`
    : `${variantStyles[variant]} ${className}`;

  const contentClass = fullHeight
    ? `flex-1 overflow-y-auto ${contentPadding}`
    : contentPadding;

  return (
    <div className={containerClass}>
      {/* Header - Glass separator with subtle bg */}
      <div className={`flex items-center justify-between ${headerPadding} border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0`}>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/48">
            {title}
          </span>
          {subtitle && (
            <div className="text-[10px] text-white/32 font-mono mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>

        {/* Right side: LIVE indicator or custom content */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerRight}
          {showLive && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
              <span className="text-[10px] font-mono text-white/32">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={contentClass}>
        {children}
      </div>
    </div>
  );
}

/**
 * Empty state placeholder for IntelPanel
 * Glassmorphism: subtle dashed border
 */
export function IntelPanelEmpty({
  message = 'No data available',
  minHeight = '180px'
}: {
  message?: string;
  minHeight?: string;
}) {
  return (
    <div
      className="border border-dashed border-white/[0.08] rounded-sm w-full flex items-center justify-center bg-white/[0.01]"
      style={{ minHeight }}
    >
      <p className="text-[11px] text-white/32 font-mono">{message}</p>
    </div>
  );
}

/**
 * Loading state for IntelPanel
 * Glassmorphism: subtle skeleton pulse
 */
export function IntelPanelLoading({
  rows = 3,
  height = '20px'
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white/[0.04] animate-pulse rounded-sm"
          style={{
            height,
            width: i === rows - 1 ? '60%' : '100%'
          }}
        />
      ))}
    </div>
  );
}

/**
 * Error state for IntelPanel
 */
export function IntelPanelError({
  message = 'Failed to load data',
  onRetry
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[#FF4444] font-mono">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] text-white/48 hover:text-white/64 font-mono underline transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
