'use client';

import { useEffect, useState, useMemo, useRef } from 'react';

interface DataPoint {
  t: number; // Unix timestamp in milliseconds
  v: number; // Price value
}

interface StockResponse {
  ticker: string;
  name: string;
  points: DataPoint[];
  last: {
    v: number;
    changeAbs: number;
    changePct: number;
  };
  range: string;
}

const TIME_RANGES = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'YTD', value: 'YTD' },
] as const;

const CHART_COLOR = '#00FFE0'; // Primary cyan per design spec

// Calculate optimal tick step for y-axis
function calculateTickStep(min: number, max: number, targetTicks: number = 6): number {
  const range = max - min;
  const rawStep = range / (targetTicks - 1);
  
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  
  let step: number;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  
  return step * magnitude;
}

interface StockChartCardProps {
  ticker: string;
  displayName: string;
  defaultRange?: string;
}

export default function StockChartCard({ ticker, displayName, defaultRange = '1Y' }: StockChartCardProps) {
  const [data, setData] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>(defaultRange);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  // Measure container with ResizeObserver
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

    const rect = container.getBoundingClientRect();
    if (rect.width >= 50 && rect.height >= 50) {
      setContainerSize({ width: rect.width, height: rect.height });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchStockData(selectedRange);
  }, [ticker, selectedRange]);

  const fetchStockData = async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/market/history?ticker=${ticker}&range=${range}`);
      const result = await response.json();
      
      if (result.ok && result.data) {
        setData(result.data);
        setError(null);
      } else {
        const errorMsg = result.error || 'Failed to fetch stock data';
        const errorDetails = result.details ? `: ${result.details}` : '';
        setError(`${errorMsg}${errorDetails}`);
      }
    } catch (err: any) {
      console.error(`[StockChartCard] Fetch error for ${ticker}:`, err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data || !data.points || data.points.length === 0 || !containerSize) return null;

    const validPoints = data.points.filter((p) => {
      return p.t != null && !isNaN(p.t) && isFinite(p.t) && 
             p.v != null && typeof p.v === 'number' && isFinite(p.v) && p.v > 0;
    });

    if (validPoints.length < 2) return null;

    const points = validPoints;
    
    // Chart dimensions
    const width = containerSize.width;
    const height = containerSize.height;
    
    const margins = {
      left: 10,
      right: 50,
      top: 20,
      bottom: 24,
    };
    
    const innerW = width - margins.left - margins.right;
    const innerH = height - margins.top - margins.bottom;
    
    if (innerW <= 0 || innerH <= 0) return null;

    // Compute yMin/yMax from visible values
    const values = points.map(p => p.v);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    let valueRange = maxValue - minValue;
    
    if (valueRange === 0) {
      valueRange = Math.abs(minValue) * 0.1 || 1;
    }
    
    const paddingAmount = Math.max(valueRange * 0.05, (maxValue - minValue) * 0.08);
    let paddedMin = minValue - paddingAmount;
    let paddedMax = maxValue + paddingAmount;
    let paddedRange = paddedMax - paddedMin;
    
    if (paddedRange <= 0) return null;

    // Generate y-axis ticks
    const tickStep = calculateTickStep(paddedMin, paddedMax, 6);
    const firstTick = Math.ceil(paddedMin / tickStep) * tickStep;
    const ticks: Array<{ value: number; y: number }> = [];
    
    for (let value = firstTick; value <= paddedMax + tickStep * 0.5; value += tickStep) {
      const y = margins.top + innerH - ((value - paddedMin) / paddedRange) * innerH;
      if (y >= margins.top && y <= margins.top + innerH) {
        ticks.push({ value, y });
      }
    }

    // Generate path
    const pathData = points.map((point, index) => {
      const xDenom = points.length - 1;
      if (xDenom === 0) return null;
      
      const x = margins.left + (index / xDenom) * innerW;
      const y = margins.top + innerH - ((point.v - paddedMin) / paddedRange) * innerH;
      
      if (!isFinite(x) || !isFinite(y)) return null;
      
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).filter((cmd): cmd is string => cmd !== null).join(' ');

    // X-axis labels
    const xLabels = [];
    if (points.length > 0) {
      const firstDate = new Date(points[0].t);
      const middleDate = new Date(points[Math.floor(points.length / 2)].t);
      const lastDate = new Date(points[points.length - 1].t);
      
      xLabels.push({ date: firstDate, x: margins.left });
      xLabels.push({ date: middleDate, x: margins.left + innerW / 2 });
      xLabels.push({ date: lastDate, x: margins.left + innerW });
    }

    return {
      pathData,
      ticks,
      xLabels,
      width,
      height,
      margins,
      innerW,
      innerH,
    };
  }, [data, containerSize]);

  const formatPrice = (value: number) => {
    const numValue = Number(value);
    if (!isFinite(numValue)) return 'N/A';
    return numValue.toFixed(2);
  };

  const formatPercent = (value: number) => {
    const numValue = Number(value);
    if (!isFinite(numValue)) return 'N/A';
    const sign = numValue >= 0 ? '+' : '';
    return `${sign}${numValue.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-col min-w-0 bg-transparent rounded-sm min-h-[260px] h-[260px]">
      {/* Header */}
      <div className="flex items-start justify-between px-3 py-2 border-b border-white/[0.08] flex-shrink-0 min-w-0">
        <div className="flex flex-col">
          <div className="text-[10px] font-mono text-white/48 uppercase">{ticker}</div>
          <div className="text-[10px] font-mono text-white/32">{displayName}</div>
        </div>
        {data && (
          <div className="text-right">
            <div className="text-[12px] font-mono text-white">{formatPrice(data.last.v)}</div>
            <div className={`text-[10px] font-mono ${data.last.changeAbs >= 0 ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
              {data.last.changeAbs >= 0 ? '+' : ''}{formatPrice(data.last.changeAbs)} ({formatPercent(data.last.changePct)})
            </div>
          </div>
        )}
      </div>

      {/* Chart Area */}
      <div
        ref={containerRef}
        className="flex-1 relative w-full min-w-0 min-h-0 overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-red-400 text-center px-2">{error}</div>
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
            {/* Gridlines */}
            <g>
              {chartData.ticks.map((tick, i) => (
                <line
                  key={i}
                  x1={chartData.margins.left}
                  y1={tick.y}
                  x2={chartData.margins.left + chartData.innerW}
                  y2={tick.y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="0.5"
                />
              ))}
            </g>

            {/* Right-side y-axis labels */}
            <g>
              {chartData.ticks.map((tick, i) => (
                <text
                  key={i}
                  x={chartData.margins.left + chartData.innerW + 4}
                  y={tick.y + 3}
                  fontSize="10"
                  fill="rgba(255,255,255,0.32)"
                  textAnchor="start"
                  fontFamily="monospace"
                >
                  {tick.value.toFixed(2)}
                </text>
              ))}
            </g>

            {/* X-axis labels */}
            <g>
              {chartData.xLabels.map((label, i) => (
                <text
                  key={i}
                  x={label.x}
                  y={chartData.height - 6}
                  fontSize="10"
                  fill="rgba(255,255,255,0.32)"
                  textAnchor={i === 0 ? 'start' : i === chartData.xLabels.length - 1 ? 'end' : 'middle'}
                  fontFamily="monospace"
                >
                  {label.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              ))}
            </g>

            {/* Line */}
            {chartData.pathData && chartData.pathData.length > 0 && (
              <path
                d={chartData.pathData}
                fill="none"
                stroke={CHART_COLOR}
                strokeWidth="1.5"
              />
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
                    <>
                      <line
                        x1={x}
                        y1={chartData.margins.top}
                        x2={x}
                        y2={chartData.margins.top + chartData.innerH}
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth="1"
                      />
                      {/* Tooltip */}
                      <rect
                        x={x - 30}
                        y={chartData.margins.top + 4}
                        width={60}
                        height={16}
                        fill="#14171D"
                        rx="2"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={chartData.margins.top + 15}
                        fontSize="12"
                        fill={CHART_COLOR}
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {formatPrice(data.points[hoveredPoint].v)}
                      </text>
                    </>
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
      <div className="flex items-center justify-center px-3 py-2 border-t border-white/[0.08] flex-shrink-0 min-w-0">
        <div className="flex gap-0.5 flex-shrink-0">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={`px-1.5 py-0.5 text-[10px] font-mono uppercase transition-colors rounded-sm ${
                selectedRange === range.value
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/32 hover:text-white/48 bg-transparent'
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


