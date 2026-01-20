'use client';

import { useState, useMemo, useEffect } from 'react';

interface TechDonutSegment {
  /** Language/technology name */
  name: string;
  /** Percentage (0-100) */
  percentage: number;
  /** Segment color */
  color: string;
  /** Organizations using this tech */
  orgsUsing?: string[];
}

interface TechDonutProps {
  /** Segment data */
  data: TechDonutSegment[];
  /** Chart size in pixels */
  size?: number;
  /** Donut thickness (0-1) */
  thickness?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Legend position */
  legendPosition?: 'right' | 'bottom';
  /** Enable segment click */
  onSegmentClick?: (segment: TechDonutSegment) => void;
  /** Selected segment */
  selectedSegment?: string;
  /** Animate on mount */
  animate?: boolean;
  /** Optional className */
  className?: string;
}

// Default language colors (GitHub style)
export const TECH_COLORS: Record<string, string> = {
  Python: '#3572A5',
  'C++': '#f34b7d',
  C: '#555555',
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CUDA: '#3A4E3A',
  Shell: '#89e051',
  CMake: '#DA3434',
  Ruby: '#701516',
  Kotlin: '#A97BFF',
  Other: '#666666',
};

/**
 * TechDonut - Animated donut chart for tech stack visualization
 *
 * Shows language distribution with interactive segments.
 * Used in TechStackAnalysis panel.
 */
export default function TechDonut({
  data,
  size = 160,
  thickness = 0.3,
  showLegend = true,
  legendPosition = 'right',
  onSegmentClick,
  selectedSegment,
  animate = true,
  className = '',
}: TechDonutProps) {
  const [mounted, setMounted] = useState(!animate);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  // Calculate SVG paths
  const { paths, total } = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.percentage, 0);
    const normalizedData = data.map((d) => ({
      ...d,
      percentage: (d.percentage / total) * 100,
    }));

    const center = size / 2;
    const radius = (size / 2) * 0.9;
    const innerRadius = radius * (1 - thickness);

    let currentAngle = -90; // Start at top

    const paths = normalizedData.map((segment) => {
      const angle = (segment.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate arc points
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const x3 = center + innerRadius * Math.cos(endRad);
      const y3 = center + innerRadius * Math.sin(endRad);
      const x4 = center + innerRadius * Math.cos(startRad);
      const y4 = center + innerRadius * Math.sin(startRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      // Build path
      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ');

      currentAngle = endAngle;

      return {
        ...segment,
        path,
        startAngle,
        endAngle,
      };
    });

    return { paths, total };
  }, [data, size, thickness]);

  const isHorizontal = legendPosition === 'right';

  return (
    <div
      className={`
        flex ${isHorizontal ? 'flex-row gap-4' : 'flex-col gap-3'}
        ${className}
      `}
    >
      {/* Donut chart */}
      <div className="flex-shrink-0 relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-0"
        >
          {paths.map((segment, index) => {
            const isHovered = hoveredSegment === segment.name;
            const isSelected = selectedSegment === segment.name;
            const isHighlighted = isHovered || isSelected;

            return (
              <path
                key={segment.name}
                d={segment.path}
                fill={segment.color}
                opacity={mounted ? (isHighlighted ? 1 : 0.8) : 0}
                stroke={isHighlighted ? '#fff' : 'transparent'}
                strokeWidth={isHighlighted ? 2 : 0}
                className="transition-all duration-300 cursor-pointer"
                style={{
                  transitionDelay: animate ? `${index * 50}ms` : '0ms',
                  transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: 'center',
                }}
                onMouseEnter={() => setHoveredSegment(segment.name)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => onSegmentClick?.(segment)}
              />
            );
          })}
        </svg>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          {hoveredSegment ? (
            <>
              <span className="text-[18px] font-mono font-medium text-white">
                {paths.find((p) => p.name === hoveredSegment)?.percentage.toFixed(0)}%
              </span>
              <span className="text-[9px] font-mono text-white/48 uppercase">
                {hoveredSegment}
              </span>
            </>
          ) : (
            <>
              <span className="text-[14px] font-mono font-medium text-white/64">
                {data.length}
              </span>
              <span className="text-[8px] font-mono text-white/32 uppercase">
                Languages
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          className={`
            flex ${isHorizontal ? 'flex-col' : 'flex-row flex-wrap'}
            gap-2 justify-center
          `}
        >
          {paths.map((segment) => {
            const isSelected = selectedSegment === segment.name;

            return (
              <button
                key={segment.name}
                className={`
                  flex items-center gap-2 px-2 py-1 rounded-sm
                  transition-colors text-left
                  ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}
                  ${onSegmentClick ? 'cursor-pointer' : 'cursor-default'}
                `}
                onClick={() => onSegmentClick?.(segment)}
                onMouseEnter={() => setHoveredSegment(segment.name)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-[10px] font-mono text-white/64">
                  {segment.name}
                </span>
                <span className="text-[9px] font-mono text-white/32">
                  {segment.percentage.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * TechDonutSkeleton - Loading state
 */
export function TechDonutSkeleton({
  size = 160,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex gap-4 ${className}`}>
      <div
        className="rounded-full bg-white/[0.04] animate-pulse"
        style={{ width: size, height: size }}
      />
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TechStackBar - Horizontal stacked bar alternative
 */
export function TechStackBar({
  data,
  height = 24,
  showLabels = true,
  className = '',
}: {
  data: TechDonutSegment[];
  height?: number;
  showLabels?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const total = data.reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className={className}>
      {/* Stacked bar */}
      <div
        className="flex rounded-sm overflow-hidden bg-white/[0.04]"
        style={{ height }}
      >
        {data.map((segment, index) => {
          const width = (segment.percentage / total) * 100;
          return (
            <div
              key={segment.name}
              className="transition-all duration-500 ease-out"
              style={{
                width: mounted ? `${width}%` : '0%',
                backgroundColor: segment.color,
                transitionDelay: `${index * 50}ms`,
              }}
              title={`${segment.name}: ${segment.percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-wrap gap-3 mt-2">
          {data.slice(0, 6).map((segment) => (
            <div key={segment.name} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-[9px] font-mono text-white/48">
                {segment.name}
              </span>
              <span className="text-[8px] font-mono text-white/24">
                {segment.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
