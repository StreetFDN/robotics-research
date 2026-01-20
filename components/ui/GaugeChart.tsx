'use client';

import { useState, useEffect, useMemo } from 'react';

interface GaugeChartProps {
  /** Current value (0-100) */
  value: number;
  /** Previous value for delta display */
  previousValue?: number;
  /** Label text below gauge */
  label?: string;
  /** Sublabel/description */
  sublabel?: string;
  /** Gauge size in pixels */
  size?: number;
  /** Arc thickness (0-1) */
  thickness?: number;
  /** Color or auto-color based on value */
  color?: string;
  /** Show value in center */
  showValue?: boolean;
  /** Show delta indicator */
  showDelta?: boolean;
  /** Animate on mount */
  animate?: boolean;
  /** Variant: semi-circular or full circular */
  variant?: 'semi' | 'full';
  /** Optional className */
  className?: string;
}

// Color thresholds for auto-coloring
const VALUE_COLORS = {
  high: '#00FF88',    // Green (>70)
  medium: '#FFB800',  // Yellow (40-70)
  low: '#FF3B3B',     // Red (<40)
};

/**
 * Get color based on value
 */
function getAutoColor(value: number): string {
  if (value >= 70) return VALUE_COLORS.high;
  if (value >= 40) return VALUE_COLORS.medium;
  return VALUE_COLORS.low;
}

/**
 * GaugeChart - Semi-circular or full circular gauge visualization
 *
 * Displays a single metric as an animated gauge with optional delta.
 * Used for Narrative Index score display.
 */
export default function GaugeChart({
  value,
  previousValue,
  label,
  sublabel,
  size = 200,
  thickness = 0.15,
  color,
  showValue = true,
  showDelta = true,
  animate = true,
  variant = 'semi',
  className = '',
}: GaugeChartProps) {
  const [animatedValue, setAnimatedValue] = useState(animate ? 0 : value);

  useEffect(() => {
    if (animate) {
      // Animate from 0 to value
      const duration = 1000;
      const startTime = Date.now();
      const startValue = animatedValue;

      const animateFrame = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (value - startValue) * eased;

        setAnimatedValue(current);

        if (progress < 1) {
          requestAnimationFrame(animateFrame);
        }
      };

      requestAnimationFrame(animateFrame);
    } else {
      setAnimatedValue(value);
    }
  }, [value, animate]);

  const resolvedColor = color || getAutoColor(value);

  // Calculate delta
  const delta = previousValue !== undefined ? value - previousValue : 0;
  const deltaColor = delta >= 0 ? '#00FF88' : '#FF3B3B';

  // SVG calculations
  const { pathBg, pathFill, centerX, centerY, valueY } = useMemo(() => {
    const center = size / 2;
    const radius = (size / 2) * 0.85;
    const innerRadius = radius * (1 - thickness);
    const strokeWidth = radius - innerRadius;
    const midRadius = (radius + innerRadius) / 2;

    if (variant === 'semi') {
      // Semi-circular gauge (180 degrees, bottom half hidden)
      const startAngle = Math.PI; // Start at left (180°)
      const endAngle = 0; // End at right (0°)
      const totalAngle = Math.PI;
      const fillAngle = startAngle - (animatedValue / 100) * totalAngle;

      // Background arc path
      const bgPath = describeArc(center, center, midRadius, startAngle, endAngle);
      // Fill arc path
      const fillPath = describeArc(center, center, midRadius, startAngle, fillAngle);

      return {
        pathBg: bgPath,
        pathFill: fillPath,
        centerX: center,
        centerY: center,
        valueY: center + 10,
        strokeWidth,
      };
    } else {
      // Full circular gauge (270 degrees, gap at bottom)
      const gapAngle = Math.PI * 0.5; // 90° gap at bottom
      const startAngle = Math.PI / 2 + gapAngle / 2; // Start at bottom-left
      const endAngle = Math.PI / 2 - gapAngle / 2 + Math.PI * 2; // End at bottom-right
      const totalAngle = Math.PI * 2 - gapAngle;
      const fillEndAngle = startAngle + (animatedValue / 100) * totalAngle;

      const bgPath = describeArc(center, center, midRadius, startAngle, endAngle);
      const fillPath = describeArc(center, center, midRadius, startAngle, fillEndAngle);

      return {
        pathBg: bgPath,
        pathFill: fillPath,
        centerX: center,
        centerY: center,
        valueY: center + 5,
        strokeWidth,
      };
    }
  }, [size, thickness, animatedValue, variant]);

  const strokeWidth = (size / 2) * 0.85 * thickness;
  const viewHeight = variant === 'semi' ? size / 2 + 20 : size;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Gauge SVG */}
      <svg
        width={size}
        height={viewHeight}
        viewBox={`0 0 ${size} ${viewHeight}`}
        className="overflow-visible"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gauge-gradient-${resolvedColor.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity="1" />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={pathBg}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Fill arc */}
        <path
          d={pathFill}
          fill="none"
          stroke={`url(#gauge-gradient-${resolvedColor.replace('#', '')})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#gauge-glow)"
          className="transition-all duration-100"
        />

        {/* Center value text */}
        {showValue && (
          <g>
            <text
              x={centerX}
              y={valueY - 8}
              textAnchor="middle"
              className="text-[32px] font-mono font-bold"
              fill={resolvedColor}
            >
              {Math.round(animatedValue)}
            </text>
            <text
              x={centerX + 24}
              y={valueY - 16}
              textAnchor="start"
              className="text-[14px] font-mono"
              fill="rgba(255,255,255,0.4)"
            >
              %
            </text>

            {/* Delta indicator */}
            {showDelta && delta !== 0 && (
              <text
                x={centerX}
                y={valueY + 16}
                textAnchor="middle"
                className="text-[12px] font-mono"
                fill={deltaColor}
              >
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Labels */}
      {(label || sublabel) && (
        <div className="text-center mt-2">
          {label && (
            <div className="text-[11px] font-mono uppercase tracking-wider text-white/64">
              {label}
            </div>
          )}
          {sublabel && (
            <div className="text-[9px] font-mono text-white/32 mt-0.5">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create SVG arc path
 */
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = {
    x: x + radius * Math.cos(startAngle),
    y: y - radius * Math.sin(startAngle),
  };
  const end = {
    x: x + radius * Math.cos(endAngle),
    y: y - radius * Math.sin(endAngle),
  };

  const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweepFlag = startAngle > endAngle ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

/**
 * GaugeSkeleton - Loading state
 */
export function GaugeSkeleton({
  size = 200,
  variant = 'semi',
  className = '',
}: {
  size?: number;
  variant?: 'semi' | 'full';
  className?: string;
}) {
  const height = variant === 'semi' ? size / 2 + 20 : size;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="rounded-full bg-white/[0.04] animate-pulse"
        style={{ width: size, height }}
      />
      <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse mt-2" />
    </div>
  );
}

/**
 * MiniGauge - Compact inline gauge
 */
export function MiniGauge({
  value,
  size = 48,
  color,
  className = '',
}: {
  value: number;
  size?: number;
  color?: string;
  className?: string;
}) {
  const resolvedColor = color || getAutoColor(value);
  const radius = size * 0.4;
  const strokeWidth = size * 0.1;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Value circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute text-[10px] font-mono font-medium"
        style={{ color: resolvedColor }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

/**
 * GaugeRow - Multiple gauges in a row for breakdown display
 */
export function GaugeRow({
  items,
  className = '',
}: {
  items: Array<{ label: string; value: number; weight?: number }>;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-center gap-6 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center">
          <MiniGauge value={item.value} size={56} />
          <div className="mt-2 text-center">
            <div className="text-[9px] font-mono uppercase tracking-wider text-white/48">
              {item.label}
            </div>
            {item.weight && (
              <div className="text-[8px] font-mono text-white/24">
                {item.weight}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
