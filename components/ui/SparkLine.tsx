'use client';

import { useMemo } from 'react';

interface SparkLineProps {
  /** Array of numeric data points */
  data: number[];
  /** SVG width in pixels */
  width?: number;
  /** SVG height in pixels */
  height?: number;
  /** Override line/fill color */
  color?: string;
  /** Show filled area under curve */
  showFill?: boolean;
  /** Show trend direction color automatically */
  autoTrendColor?: boolean;
  /** Optional className */
  className?: string;
}

// Color palette per Palantir/CIA aesthetic
const COLORS = {
  default: '#00FFE0',
  up: '#00FF88',
  down: '#FF3B3B',
  neutral: '#666666',
};

type Trend = 'up' | 'down' | 'flat';

/**
 * Compute trend direction from data
 */
function computeTrend(data: number[]): Trend {
  if (data.length < 2) return 'flat';

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const threshold = (Math.max(...data) - Math.min(...data)) * 0.1;

  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'flat';
}

/**
 * SparkLine - Minimal SVG line chart for trends
 *
 * Used for news velocity and other time-series visualizations.
 * No axes, labels, or legend — pure data visualization.
 */
export default function SparkLine({
  data,
  width = 100,
  height = 24,
  color,
  showFill = true,
  autoTrendColor = true,
  className = '',
}: SparkLineProps) {
  const { path, fillPath, lineColor } = useMemo(() => {
    if (data.length < 2) {
      return { path: '', fillPath: '', lineColor: COLORS.neutral };
    }

    // Compute min/max for scaling
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1; // Avoid division by zero

    // Padding to prevent clipping
    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    // Generate path points
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - minVal) / range) * effectiveHeight;
      return { x, y };
    });

    // Create line path
    const linePath = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');

    // Create fill path (closes to bottom)
    const fillPathStr = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    // Determine color
    const trend = computeTrend(data);
    let resolvedColor = color;
    if (!resolvedColor && autoTrendColor) {
      resolvedColor = trend === 'up' ? COLORS.up : trend === 'down' ? COLORS.down : COLORS.default;
    }
    resolvedColor = resolvedColor || COLORS.default;

    return {
      path: linePath,
      fillPath: fillPathStr,
      lineColor: resolvedColor,
    };
  }, [data, width, height, color, autoTrendColor]);

  if (data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-[8px] font-mono text-white/24">NO DATA</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {/* Gradient fill under curve */}
      {showFill && (
        <>
          <defs>
            <linearGradient id={`sparkline-grad-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={fillPath}
            fill={`url(#sparkline-grad-${lineColor.replace('#', '')})`}
          />
        </>
      )}

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End point dot */}
      {data.length > 0 && (
        <circle
          cx={width - 2}
          cy={
            2 +
            (height - 4) -
            ((data[data.length - 1] - Math.min(...data)) /
              (Math.max(...data) - Math.min(...data) || 1)) *
              (height - 4)
          }
          r={2}
          fill={lineColor}
        />
      )}
    </svg>
  );
}

/**
 * SparkLineWithLabel - SparkLine with value label
 */
export function SparkLineWithLabel({
  data,
  label,
  currentValue,
  width = 80,
  height = 20,
  className = '',
}: {
  data: number[];
  label: string;
  currentValue?: number | string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[9px] font-mono uppercase tracking-wider text-white/32 min-w-[60px]">
        {label}
      </span>
      <SparkLine data={data} width={width} height={height} />
      {currentValue !== undefined && (
        <span className="text-[10px] font-mono tabular-nums text-white/64 min-w-[32px] text-right">
          {currentValue}
        </span>
      )}
    </div>
  );
}

/**
 * MiniSparkLine - Inline tiny version
 */
export function MiniSparkLine({
  data,
  className = '',
}: {
  data: number[];
  className?: string;
}) {
  return (
    <SparkLine
      data={data}
      width={40}
      height={12}
      showFill={false}
      className={className}
    />
  );
}
