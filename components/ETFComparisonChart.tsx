'use client';

import { useEffect, useState, useMemo, useRef } from 'react';

interface DataPoint {
  t: number; // Unix timestamp in milliseconds
  BOTZ: number;
  ROBO: number;
  IRBO: number;
}

interface CompareResponse {
  range: string;
  tickers: string[];
  points: DataPoint[];
  latest: {
    BOTZ: number;
    ROBO: number;
    IRBO: number;
  };
}

const TIME_RANGES = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'YTD', value: 'YTD' },
] as const;

// TradingView-style colors: teal variants with similar brightness
const TICKER_COLORS = {
  BOTZ: '#00d4ff', // Cyan/Teal
  ROBO: '#00ffaa', // Bright Teal
  IRBO: '#ffaa00', // Amber/Orange
};

// Calculate optimal tick step for y-axis
function calculateTickStep(min: number, max: number, targetTicks: number = 8): number {
  const range = max - min;
  const rawStep = range / (targetTicks - 1);
  
  // Round to nice numbers: 1, 2, 5, 10, 20, 50, etc.
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  
  let step: number;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  
  return step * magnitude;
}

// Resolve label collisions
function resolveLabelCollisions(
  labels: Array<{ ticker: string; y: number; value: number }>,
  minY: number,
  maxY: number,
  minSpacing: number = 14
): Array<{ ticker: string; y: number; value: number }> {
  if (labels.length === 0) return [];
  
  // Sort by y position
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  const resolved: typeof sorted = [];
  
  for (let i = 0; i < sorted.length; i++) {
    let y = sorted[i].y;
    
    // Check collision with previous label
    if (i > 0) {
      const prevY = resolved[i - 1].y;
      if (y - prevY < minSpacing) {
        y = prevY + minSpacing;
      }
    }
    
    // Clamp to bounds
    y = Math.max(minY + 8, Math.min(maxY - 8, y));
    
    resolved.push({ ...sorted[i], y });
  }
  
  return resolved;
}

export default function ETFComparisonChart() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('1Y');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  // 1) Measure container with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width >= 50 && height >= 50) {
          setContainerSize({ width, height });
        } else {
          setContainerSize(null);
        }
      }
    });

    resizeObserver.observe(container);

    // Initial measurement
    const rect = container.getBoundingClientRect();
    if (rect.width >= 50 && rect.height >= 50) {
      setContainerSize({ width: rect.width, height: rect.height });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchComparisonData(selectedRange);
  }, [selectedRange]);

  const fetchComparisonData = async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/market/compare-history?tickers=BOTZ,ROBO,IRBO&range=${range}`);
      const result = await response.json();
      
      if (result.ok && result.data) {
        setData(result.data);
        setError(null);
      } else {
        const errorMsg = result.error || 'Failed to fetch comparison data';
        const errorDetails = result.details ? `: ${result.details}` : '';
        setError(`${errorMsg}${errorDetails}`);
      }
    } catch (err: any) {
      console.error('[ETFComparisonChart] Fetch error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data || !data.points || data.points.length === 0 || !containerSize) return null;

    // Validate and filter points
    const tickers = ['BOTZ', 'ROBO', 'IRBO'] as const;
    const validPoints = data.points.filter((p) => {
      if (!p.t || isNaN(p.t) || !isFinite(p.t)) return false;
      return tickers.every(ticker => {
        const value = p[ticker];
        return value != null && typeof value === 'number' && isFinite(value);
      });
    });

    if (validPoints.length < 2) return null;

    const points = validPoints;
    
    // 2) Define explicit chart layout regions from actual container size
    const width = containerSize.width;
    const height = containerSize.height;
    
    // Margins (tuned for proper spacing)
    const margins = {
      left: 12,
      right: 64, // Space for % axis labels + right-edge series tags
      top: 22,  // Space for top-left legend
      bottom: 28, // Space for x-axis labels + timeframe tabs
    };
    
    // Inner plot area
    const innerW = width - margins.left - margins.right;
    const innerH = height - margins.top - margins.bottom;
    
    // Ensure inner dimensions are positive
    if (innerW <= 0 || innerH <= 0) {
      console.warn('[ETFComparisonChart] Invalid inner dimensions:', { innerW, innerH, width, height });
      return null;
    }

    // Compute yMin/yMax from visible series values
    const allValues: number[] = [];
    points.forEach(p => {
      tickers.forEach(ticker => {
        const value = Number(p[ticker]);
        if (isFinite(value)) {
          allValues.push(value);
        }
      });
    });
    
    if (allValues.length === 0) return null;

    let minValue = Math.min(...allValues);
    let maxValue = Math.max(...allValues);
    let valueRange = maxValue - minValue;
    
    if (valueRange === 0) {
      valueRange = Math.abs(minValue) * 0.1 || 1;
    }
    
    // Smart padding
    const paddingAmount = Math.max(2, valueRange * 0.08);
    let paddedMin = minValue - paddingAmount;
    let paddedMax = maxValue + paddingAmount;
    let paddedRange = paddedMax - paddedMin;
    
    // Ensure min span of 8%
    if (paddedRange < 8) {
      const mid = (paddedMin + paddedMax) / 2;
      paddedMin = mid - 4;
      paddedMax = mid + 4;
      paddedRange = 8;
    }
    
    // Zero line (only if within range)
    let zeroLineY: number | null = null;
    if (paddedMin <= 0 && paddedMax >= 0) {
      zeroLineY = margins.top + innerH - ((0 - paddedMin) / paddedRange) * innerH;
    }

    // Generate right-side percent axis ticks
    const tickStep = calculateTickStep(paddedMin, paddedMax, 8);
    const firstTick = Math.ceil(paddedMin / tickStep) * tickStep;
    const ticks: Array<{ value: number; y: number }> = [];
    
    for (let value = firstTick; value <= paddedMax + tickStep * 0.5; value += tickStep) {
      // 4) Use innerH with top offset for y-mapping
      const y = margins.top + innerH - ((value - paddedMin) / paddedRange) * innerH;
      if (y >= margins.top && y <= margins.top + innerH) {
        ticks.push({ value, y });
      }
    }

    // Generate paths for each ticker
    const paths: Record<string, string> = [];
    
    tickers.forEach(ticker => {
      // 5) x-scale uses innerW, positioned at left margin
      const pathData = points.map((point, index) => {
        const value = Number(point[ticker]);
        if (!isFinite(value)) return null;
        
        const xDenom = points.length - 1;
        if (xDenom === 0) return null;
        
        // x pixel = left + (i/(n-1))*innerW
        const x = margins.left + (index / xDenom) * innerW;
        // y uses innerH with top offset
        const y = margins.top + innerH - ((value - paddedMin) / paddedRange) * innerH;
        
        if (!isFinite(x) || !isFinite(y)) return null;
        
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).filter((cmd): cmd is string => cmd !== null).join(' ');
      
      if (pathData.length > 0) {
        paths[ticker] = pathData;
      }
    });

    // Format X-axis labels
    const xLabels = [];
    if (points.length > 0) {
      const firstDate = new Date(points[0].t);
      const middleDate = new Date(points[Math.floor(points.length / 2)].t);
      const lastDate = new Date(points[points.length - 1].t);
      
      xLabels.push({ date: firstDate, x: margins.left });
      xLabels.push({ date: middleDate, x: margins.left + innerW / 2 });
      xLabels.push({ date: lastDate, x: margins.left + innerW });
    }

    // Get last point positions for right-side labels
    const lastPointIndex = points.length - 1;
    const labelCandidates: Array<{ ticker: string; y: number; value: number }> = [];
    
    tickers.forEach(ticker => {
      if (points[lastPointIndex]) {
        const value = Number(points[lastPointIndex][ticker]);
        if (isFinite(value)) {
          // 4) Use inner plot coordinates
          const y = margins.top + innerH - ((value - paddedMin) / paddedRange) * innerH;
          if (isFinite(y)) {
            labelCandidates.push({ ticker, y, value });
          }
        }
      }
    });
    
    // 4) Collision resolver uses inner plot bounds
    const plotTop = margins.top;
    const plotBottom = margins.top + innerH;
    const resolvedLabels = resolveLabelCollisions(labelCandidates, plotTop, plotBottom, 14);

    return {
      paths,
      ticks,
      xLabels,
      resolvedLabels,
      zeroLineY,
      width,
      height,
      margins,
      innerW,
      innerH,
      paddedMin,
      paddedMax,
    };
  }, [data, containerSize]);

  const formatPercent = (value: number) => {
    const numValue = Number(value);
    if (!isFinite(numValue)) return 'N/A';
    const sign = numValue >= 0 ? '+' : '';
    return `${sign}${numValue.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-col bg-[#0a0e27] border-b border-gray-800 flex-shrink-0" style={{ height: '160px' }}>
      {/* Chart Area - full height, uses real container measurements */}
      <div 
        ref={containerRef}
        className="flex-1 relative w-full" 
        style={{ minHeight: 0 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-red-400">Error: {error}</div>
          </div>
        ) : !containerSize ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Measuring...</div>
          </div>
        ) : chartData ? (
          <svg
            width={chartData.width}
            height={chartData.height}
            className="overflow-visible"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x >= chartData.margins.left && x <= chartData.margins.left + chartData.innerW) {
                const relativeX = (x - chartData.margins.left) / chartData.innerW;
                setHoveredPoint(Math.round(relativeX * (data?.points.length || 0)));
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* 6) Debug rectangle (dev-only) */}
            {process.env.NODE_ENV === 'development' && (
              <rect
                x={chartData.margins.left}
                y={chartData.margins.top}
                width={chartData.innerW}
                height={chartData.innerH}
                fill="none"
                stroke="#ff00ff"
                strokeWidth="0.5"
                strokeDasharray="2,2"
                opacity="0.3"
              />
            )}

            {/* Faint horizontal gridlines at each tick */}
            <g opacity="0.12">
              {chartData.ticks.map((tick, i) => (
                <line
                  key={i}
                  x1={chartData.margins.left}
                  y1={tick.y}
                  x2={chartData.margins.left + chartData.innerW}
                  y2={tick.y}
                  stroke="#888"
                  strokeWidth="0.5"
                />
              ))}
            </g>

            {/* Zero line (only if within range) */}
            {chartData.zeroLineY !== null && (
              <line
                x1={chartData.margins.left}
                y1={chartData.zeroLineY}
                x2={chartData.margins.left + chartData.innerW}
                y2={chartData.zeroLineY}
                stroke="#666"
                strokeWidth="0.5"
                strokeDasharray="2,2"
                opacity="0.3"
              />
            )}

            {/* Right-side percent axis labels */}
            <g>
              {chartData.ticks.map((tick, i) => (
                <text
                  key={i}
                  x={chartData.margins.left + chartData.innerW + 4}
                  y={tick.y + 3}
                  fontSize="11"
                  fill="#888"
                  textAnchor="start"
                  fontFamily="monospace"
                  opacity="0.7"
                >
                  {tick.value >= 0 ? '+' : ''}{tick.value.toFixed(1)}%
                </text>
              ))}
            </g>

            {/* X-axis labels */}
            <g>
              {chartData.xLabels.map((label, i) => (
                <text
                  key={i}
                  x={label.x}
                  y={chartData.height - 8}
                  fontSize="10"
                  fill="#888"
                  textAnchor={i === 0 ? 'start' : i === chartData.xLabels.length - 1 ? 'end' : 'middle'}
                  fontFamily="monospace"
                  opacity="0.6"
                >
                  {label.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              ))}
            </g>

            {/* Lines - crisp, ~2px */}
            {chartData.paths.BOTZ && chartData.paths.BOTZ.length > 0 && (
              <path
                d={chartData.paths.BOTZ}
                fill="none"
                stroke={TICKER_COLORS.BOTZ}
                strokeWidth="2"
              />
            )}
            {chartData.paths.ROBO && chartData.paths.ROBO.length > 0 && (
              <path
                d={chartData.paths.ROBO}
                fill="none"
                stroke={TICKER_COLORS.ROBO}
                strokeWidth="2"
              />
            )}
            {chartData.paths.IRBO && chartData.paths.IRBO.length > 0 && (
              <path
                d={chartData.paths.IRBO}
                fill="none"
                stroke={TICKER_COLORS.IRBO}
                strokeWidth="2"
              />
            )}

            {/* Top-left legend */}
            {data && (
              <g transform={`translate(${chartData.margins.left}, ${chartData.margins.top + 2})`}>
                {(() => {
                  const botzValue = Number(data.latest.BOTZ);
                  const roboValue = Number(data.latest.ROBO);
                  const irboValue = Number(data.latest.IRBO);
                  return (
                    <>
                      <text x={0} y={0} fontSize="10" fill={TICKER_COLORS.BOTZ} fontFamily="monospace" fontWeight="500">
                        BOTZ
                      </text>
                      <text x={36} y={0} fontSize="10" fill={isFinite(botzValue) && botzValue >= 0 ? '#00ff88' : '#ff4444'} fontFamily="monospace">
                        {formatPercent(botzValue)}
                      </text>
                      <text x={0} y={14} fontSize="10" fill={TICKER_COLORS.ROBO} fontFamily="monospace" fontWeight="500">
                        ROBO
                      </text>
                      <text x={36} y={14} fontSize="10" fill={isFinite(roboValue) && roboValue >= 0 ? '#00ff88' : '#ff4444'} fontFamily="monospace">
                        {formatPercent(roboValue)}
                      </text>
                      <text x={0} y={28} fontSize="10" fill={TICKER_COLORS.IRBO} fontFamily="monospace" fontWeight="500">
                        IRBO
                      </text>
                      <text x={36} y={28} fontSize="10" fill={isFinite(irboValue) && irboValue >= 0 ? '#00ff88' : '#ff4444'} fontFamily="monospace">
                        {formatPercent(irboValue)}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}


            {/* Hover crosshair */}
            {hoveredPoint !== null && data && data.points[hoveredPoint] && data.points.length > 1 && (
              <g>
                {(() => {
                  const xDenom = data.points.length - 1;
                  if (xDenom === 0) return null;
                  const x = chartData.margins.left + (hoveredPoint / xDenom) * chartData.innerW;
                  if (!isFinite(x)) return null;
                  return (
                    <line
                      x1={x}
                      y1={chartData.margins.top}
                      x2={x}
                      y2={chartData.margins.top + chartData.innerH}
                      stroke="#666"
                      strokeWidth="1"
                      opacity="0.4"
                    />
                  );
                })()}
              </g>
            )}
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">No data available</div>
          </div>
        )}
      </div>

      {/* Footer with time range toggles */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800/50">
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={`px-2 py-1 text-xs font-mono transition-colors ${
                selectedRange === range.value
                  ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
