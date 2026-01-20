'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface DataPoint {
  /** X-axis label (e.g., date string) */
  label: string;
  /** Y-axis value */
  value: number;
  /** Optional: parsed Date for time series */
  date?: Date;
}

interface AreaLineChartProps {
  /** Data points to display */
  data: DataPoint[];
  /** Chart width (use "100%" for responsive) */
  width?: number | string;
  /** Chart height */
  height?: number;
  /** Line/fill color */
  color?: string;
  /** Show gradient fill under line */
  showFill?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show X-axis labels */
  showXAxis?: boolean;
  /** Show Y-axis labels */
  showYAxis?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Show data points as dots */
  showDots?: boolean;
  /** Y-axis min value (auto if not set) */
  yMin?: number;
  /** Y-axis max value (auto if not set) */
  yMax?: number;
  /** Animate on mount */
  animate?: boolean;
  /** Tooltip formatter */
  tooltipFormatter?: (point: DataPoint) => string;
  /** Optional className */
  className?: string;
}

// Default colors
const DEFAULT_COLOR = '#00FFE0';

/**
 * AreaLineChart - SVG-based area/line chart with gradient fill
 *
 * Used for displaying time-series data like Narrative Index history.
 * Features hover tooltips and smooth animations.
 */
export default function AreaLineChart({
  data,
  width = '100%',
  height = 200,
  color = DEFAULT_COLOR,
  showFill = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  showDots = false,
  yMin,
  yMax,
  animate = true,
  tooltipFormatter,
  className = '',
}: AreaLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(!animate);

  // Handle responsive width
  useEffect(() => {
    if (typeof width === 'string' && containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        setContainerWidth(entries[0].contentRect.width);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [width]);

  // Animation on mount
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  const chartWidth = typeof width === 'number' ? width : containerWidth;

  // Calculate chart dimensions and paths
  const chart = useMemo(() => {
    if (data.length < 2 || chartWidth === 0) {
      return null;
    }

    // Margins
    const margin = {
      top: 20,
      right: 20,
      bottom: showXAxis ? 30 : 10,
      left: showYAxis ? 45 : 10,
    };

    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate Y range
    const values = data.map((d) => d.value);
    const minValue = yMin !== undefined ? yMin : Math.min(...values);
    const maxValue = yMax !== undefined ? yMax : Math.max(...values);
    const range = maxValue - minValue || 1;

    // Scale functions
    const xScale = (index: number) => margin.left + (index / (data.length - 1)) * innerWidth;
    const yScale = (value: number) =>
      margin.top + innerHeight - ((value - minValue) / range) * innerHeight;

    // Generate line path
    const linePath = data
      .map((d, i) => {
        const x = xScale(i);
        const y = yScale(d.value);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    // Generate area path (closes to bottom)
    const areaPath = `${linePath} L ${xScale(data.length - 1)} ${margin.top + innerHeight} L ${margin.left} ${margin.top + innerHeight} Z`;

    // Generate grid lines
    const gridLines = [];
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = margin.top + (i / yTicks) * innerHeight;
      const value = maxValue - (i / yTicks) * range;
      gridLines.push({ y, value });
    }

    // Generate X-axis labels (show ~5-7 labels)
    const xLabels: Array<{ x: number; label: string }> = [];
    const labelInterval = Math.max(1, Math.floor(data.length / 6));
    data.forEach((d, i) => {
      if (i % labelInterval === 0 || i === data.length - 1) {
        xLabels.push({ x: xScale(i), label: d.label });
      }
    });

    // Generate point positions for dots and hover
    const points = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.value),
      data: d,
      index: i,
    }));

    return {
      margin,
      innerWidth,
      innerHeight,
      linePath,
      areaPath,
      gridLines,
      xLabels,
      points,
      minValue,
      maxValue,
    };
  }, [data, chartWidth, height, yMin, yMax, showXAxis, showYAxis]);

  if (!chart || chartWidth === 0) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        {data.length < 2 && (
          <span className="text-[10px] font-mono text-white/32">
            Insufficient data
          </span>
        )}
      </div>
    );
  }

  const gradientId = `area-gradient-${color.replace('#', '')}`;
  const hoveredPoint = hoveredIndex !== null ? chart.points[hoveredIndex] : null;

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width }}>
      <svg width={chartWidth} height={height} className="overflow-visible">
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g>
            {chart.gridLines.map((line, i) => (
              <g key={i}>
                <line
                  x1={chart.margin.left}
                  y1={line.y}
                  x2={chartWidth - chart.margin.right}
                  y2={line.y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="2,4"
                />
                {showYAxis && (
                  <text
                    x={chart.margin.left - 8}
                    y={line.y + 4}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-white/32"
                  >
                    {line.value.toFixed(0)}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}

        {/* X-axis labels */}
        {showXAxis && (
          <g>
            {chart.xLabels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={height - 8}
                textAnchor="middle"
                className="text-[8px] font-mono fill-white/32"
              >
                {label.label}
              </text>
            ))}
          </g>
        )}

        {/* Area fill */}
        {showFill && (
          <path
            d={chart.areaPath}
            fill={`url(#${gradientId})`}
            opacity={mounted ? 1 : 0}
            className="transition-opacity duration-500"
          />
        )}

        {/* Line */}
        <path
          d={chart.linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={mounted ? 1 : 0}
          className="transition-opacity duration-500"
          style={{
            strokeDasharray: animate ? chart.innerWidth * 3 : 'none',
            strokeDashoffset: animate && !mounted ? chart.innerWidth * 3 : 0,
            transition: animate ? 'stroke-dashoffset 1s ease-out, opacity 0.5s' : 'opacity 0.5s',
          }}
        />

        {/* Data points */}
        {showDots &&
          chart.points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === i ? 5 : 3}
              fill={color}
              opacity={mounted ? 1 : 0}
              className="transition-all duration-200"
              style={{ transitionDelay: animate ? `${i * 30}ms` : '0ms' }}
            />
          ))}

        {/* Hover overlay */}
        {showTooltip && (
          <g>
            {chart.points.map((point, i) => (
              <rect
                key={i}
                x={point.x - chart.innerWidth / data.length / 2}
                y={chart.margin.top}
                width={chart.innerWidth / data.length}
                height={chart.innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-crosshair"
              />
            ))}
          </g>
        )}

        {/* Hover indicator line */}
        {hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={chart.margin.top}
              x2={hoveredPoint.x}
              y2={chart.margin.top + chart.innerHeight}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.5}
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={6}
              fill={color}
              stroke="#000"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {showTooltip && hoveredPoint && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1.5
                     bg-black/90 backdrop-blur-sm border border-white/[0.12] rounded-sm
                     transform -translate-x-1/2"
          style={{
            left: hoveredPoint.x,
            top: Math.max(0, hoveredPoint.y - 45),
          }}
        >
          <div className="text-[10px] font-mono text-white/48">
            {hoveredPoint.data.label}
          </div>
          <div className="text-[14px] font-mono font-medium" style={{ color }}>
            {tooltipFormatter
              ? tooltipFormatter(hoveredPoint.data)
              : `${hoveredPoint.data.value.toFixed(1)}%`}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AreaLineChartSkeleton - Loading state
 */
export function AreaLineChartSkeleton({
  width = '100%',
  height = 200,
  className = '',
}: {
  width?: number | string;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-white/[0.02] rounded-sm animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

/**
 * MultiLineChart - Multiple lines on same chart
 */
export function MultiLineChart({
  series,
  width = '100%',
  height = 200,
  showLegend = true,
  className = '',
}: {
  series: Array<{
    name: string;
    data: DataPoint[];
    color: string;
  }>;
  width?: number | string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  useEffect(() => {
    if (typeof width === 'string' && containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        setContainerWidth(entries[0].contentRect.width);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [width]);

  const chartWidth = typeof width === 'number' ? width : containerWidth;

  const chart = useMemo(() => {
    if (chartWidth === 0) return null;

    const margin = { top: 20, right: 20, bottom: 30, left: 45 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Get all values for Y scale
    const allValues = series.flatMap((s) => s.data.map((d) => d.value));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;

    // Get max data length
    const maxLength = Math.max(...series.map((s) => s.data.length));

    const xScale = (index: number) => margin.left + (index / (maxLength - 1)) * innerWidth;
    const yScale = (value: number) =>
      margin.top + innerHeight - ((value - minValue) / range) * innerHeight;

    // Generate paths for each series
    const paths = series.map((s) => ({
      name: s.name,
      color: s.color,
      path: s.data
        .map((d, i) => {
          const x = xScale(i);
          const y = yScale(d.value);
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' '),
    }));

    return { margin, innerWidth, innerHeight, paths, minValue, maxValue };
  }, [series, chartWidth, height]);

  if (!chart || chartWidth === 0) {
    return <div ref={containerRef} style={{ width, height }} />;
  }

  return (
    <div ref={containerRef} className={className} style={{ width }}>
      <svg width={chartWidth} height={height}>
        {/* Lines */}
        {chart.paths.map((s) => (
          <path
            key={s.name}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={hoveredSeries === s.name ? 3 : 2}
            strokeLinecap="round"
            opacity={hoveredSeries && hoveredSeries !== s.name ? 0.3 : 1}
            className="transition-all duration-200"
          />
        ))}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          {series.map((s) => (
            <button
              key={s.name}
              className="flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-white/[0.04] transition-colors"
              onMouseEnter={() => setHoveredSeries(s.name)}
              onMouseLeave={() => setHoveredSeries(null)}
            >
              <span
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[9px] font-mono text-white/48">
                {s.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SparkAreaChart - Compact inline area chart
 */
export function SparkAreaChart({
  data,
  width = 120,
  height = 40,
  color = DEFAULT_COLOR,
  className = '',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const chart = useMemo(() => {
    if (data.length < 2) return null;

    const padding = 2;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, i) => ({
      x: padding + (i / (data.length - 1)) * innerWidth,
      y: padding + innerHeight - ((value - min) / range) * innerHeight,
    }));

    const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    return { linePath, areaPath, lastPoint: points[points.length - 1] };
  }, [data, width, height]);

  if (!chart) {
    return <div style={{ width, height }} />;
  }

  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={chart.areaPath} fill={`url(#spark-grad-${color.replace('#', '')})`} />
      <path d={chart.linePath} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={chart.lastPoint.x} cy={chart.lastPoint.y} r={2} fill={color} />
    </svg>
  );
}
