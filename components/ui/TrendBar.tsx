'use client';

import { useEffect, useState } from 'react';

interface TrendBarProps {
  /** Array of data points with labels and values */
  data: Array<{ label: string; value: number }>;
  /** Height of the chart in pixels */
  height?: number;
  /** Bar color */
  color?: string;
  /** Show labels below bars */
  showLabels?: boolean;
  /** Animate bars on mount */
  animate?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * TrendBar - Vertical bar chart for trend visualization
 *
 * Shows temporal data as a series of vertical bars.
 * Used for yearly trends in contracts, activity, etc.
 */
export default function TrendBar({
  data,
  height = 48,
  color = '#00FFE0',
  showLabels = true,
  animate = true,
  className = '',
}: TrendBarProps) {
  const [mounted, setMounted] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-[9px] font-mono text-white/24 ${className}`}
        style={{ height }}
      >
        No trend data
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={className}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((item, index) => {
          const barHeight = mounted
            ? (item.value / maxValue) * 100
            : 0;

          return (
            <div
              key={`${item.label}-${index}`}
              className="flex-1 flex flex-col items-center"
            >
              <div
                className="w-full rounded-t-sm transition-all duration-500 ease-out"
                style={{
                  height: `${barHeight}%`,
                  minHeight: item.value > 0 ? '4px' : '0',
                  backgroundColor: `${color}99`,
                  transitionDelay: animate ? `${index * 50}ms` : '0ms',
                }}
              />
            </div>
          );
        })}
      </div>

      {showLabels && (
        <div className="flex gap-1 mt-1">
          {data.map((item, index) => (
            <div
              key={`label-${item.label}-${index}`}
              className="flex-1 text-center"
            >
              <span className="text-[8px] font-mono text-white/24">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TrendBarWithTitle - TrendBar with header
 */
export function TrendBarWithTitle({
  title,
  data,
  height = 48,
  color,
  className = '',
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
        {title}
      </div>
      <TrendBar data={data} height={height} color={color} />
    </div>
  );
}

/**
 * YearlyTrendBar - Specialized for year-based data
 */
export function YearlyTrendBar({
  data,
  height = 48,
  color = '#00FFE0',
  className = '',
}: {
  data: Array<{ year: number; value: number }>;
  height?: number;
  color?: string;
  className?: string;
}) {
  const formattedData = data.map((d) => ({
    label: d.year.toString().slice(-2), // Show last 2 digits
    value: d.value,
  }));

  return (
    <TrendBar
      data={formattedData}
      height={height}
      color={color}
      className={className}
    />
  );
}

/**
 * ActivityBar - Horizontal activity/score bar
 */
export function ActivityBar({
  score,
  maxScore = 100,
  label,
  showScore = true,
  className = '',
}: {
  score: number;
  maxScore?: number;
  label?: string;
  showScore?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const percentage = Math.min(100, (score / maxScore) * 100);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Color based on score
  const color =
    percentage >= 70
      ? '#00FF88'
      : percentage >= 40
        ? '#FFB800'
        : '#FF4444';

  return (
    <div className={`bg-black/20 rounded-sm p-3 border border-white/[0.06] ${className}`}>
      {(label || showScore) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
              {label}
            </span>
          )}
          {showScore && (
            <span className="text-[14px] font-mono font-medium text-white">
              {score}/{maxScore}
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: mounted ? `${percentage}%` : '0%',
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * MiniTrendBar - Compact inline version
 */
export function MiniTrendBar({
  data,
  color = '#00FFE0',
  className = '',
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const maxValue = Math.max(...data, 1);

  return (
    <div className={`flex items-end gap-px h-4 ${className}`}>
      {data.map((value, index) => {
        const barHeight = (value / maxValue) * 100;
        return (
          <div
            key={index}
            className="flex-1 rounded-t-[1px]"
            style={{
              height: `${barHeight}%`,
              minHeight: value > 0 ? '2px' : '0',
              backgroundColor: `${color}80`,
            }}
          />
        );
      })}
    </div>
  );
}
