'use client';

import { useEffect, useState, useMemo } from 'react';

interface IndexDataPoint {
  date: Date;
  value: number;
}

interface IndexResponse {
  indexLevels: Array<{ date: string; value: number }>;
  weights: Record<string, number>;
  latestValue: number;
  dayChange: number;
  dayChangePercent: number;
  constituents: Array<{
    ticker: string;
    weight: number;
    marketCap: number;
    currentPrice: number;
  }>;
  baseValue: number;
  range: string;
}

const TIME_RANGES = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'YTD', value: 'YTD' },
] as const;

export default function RoboticsIndexChart() {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('1Y');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchIndexData(selectedRange);
  }, [selectedRange]);

  const fetchIndexData = async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/indices/robotics?range=${range}`);
      const result = await response.json();
      
      if (result.ok && result.data) {
        // Convert date strings to Date objects
        const processedData = {
          ...result.data,
          indexLevels: result.data.indexLevels.map((point: { date: string; value: number }) => ({
            date: new Date(point.date),
            value: point.value,
          })),
        };
        setData(processedData);
      } else {
        setError(result.error || 'Failed to fetch index data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!data || !data.indexLevels || data.indexLevels.length === 0) return null;

    const points = data.indexLevels;
    const width = 100;
    const height = 180;
    const padding = { top: 20, right: 10, bottom: 20, left: 50 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate min/max for scaling
    const values = points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const paddingFactor = 0.1;
    const paddedMin = minValue - valueRange * paddingFactor;
    const paddedMax = maxValue + valueRange * paddingFactor;
    const paddedRange = paddedMax - paddedMin;

    // Generate path
    const pathData = points.map((point, index) => {
      const x = (index / (points.length - 1)) * chartWidth;
      const y = chartHeight - ((point.value - paddedMin) / paddedRange) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Format Y-axis labels
    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
      const value = paddedMax - (paddedRange / (yTicks - 1)) * i;
      return {
        value,
        label: value.toFixed(1),
        y: (i / (yTicks - 1)) * chartHeight,
      };
    });

    // Format X-axis labels (show first, middle, last dates)
    const xLabels = [];
    if (points.length > 0) {
      xLabels.push({ date: points[0].date, x: 0 });
      if (points.length > 1) {
        xLabels.push({ date: points[Math.floor(points.length / 2)].date, x: chartWidth / 2 });
        xLabels.push({ date: points[points.length - 1].date, x: chartWidth });
      }
    }

    return {
      pathData,
      yLabels,
      xLabels,
      minValue: paddedMin,
      maxValue: paddedMax,
    };
  }, [data]);

  const isPositive = data ? data.dayChange >= 0 : true;

  return (
    <div className="flex flex-col min-w-0 bg-transparent rounded-sm min-h-[260px] h-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] flex-shrink-0 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase text-white/48 tracking-wider">ROBOTICS INDEX</span>
        </div>
        <div className="flex items-center gap-4">
          {data && (
            <div className="flex items-center gap-2 text-right">
              <div>
                <div className="text-[12px] font-mono text-white">{data.latestValue.toFixed(2)}</div>
                <div className={`text-[10px] font-mono ${isPositive ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
                  {isPositive ? '+' : ''}{data.dayChange.toFixed(2)} ({isPositive ? '+' : ''}{data.dayChangePercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative px-4 py-3 min-w-0 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-red-400">Error: {error}</div>
          </div>
        ) : chartData ? (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 180"
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00FFE0" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#00FFE0" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <g>
              {chartData.yLabels.map((label, i) => (
                <line
                  key={i}
                  x1={10}
                  y1={label.y + 20}
                  x2={90}
                  y2={label.y + 20}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="0.3"
                />
              ))}
            </g>

            {/* Y-axis labels */}
            <g>
              {chartData.yLabels.map((label, i) => (
                <text
                  key={i}
                  x={8}
                  y={label.y + 20 + 2}
                  fontSize="2.8"
                  fill="rgba(255,255,255,0.32)"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {label.label}
                </text>
              ))}
            </g>

            {/* X-axis labels */}
            <g>
              {chartData.xLabels.map((label, i) => (
                <text
                  key={i}
                  x={10 + label.x}
                  y={175}
                  fontSize="2.6"
                  fill="rgba(255,255,255,0.32)"
                  textAnchor={i === 0 ? 'start' : i === chartData.xLabels.length - 1 ? 'end' : 'middle'}
                  fontFamily="monospace"
                >
                  {new Date(label.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              ))}
            </g>

            {/* Area fill */}
            <path
              d={`${chartData.pathData} L ${100 - 10 - 10} ${180 - 20 - 20} L 10 ${180 - 20 - 20} Z`}
              fill="url(#lineGradient)"
            />

            {/* Line */}
            <path
              d={chartData.pathData}
              fill="none"
              stroke="#00FFE0"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">No data available</div>
          </div>
        )}
      </div>

      {/* Footer with time range toggles */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.08] flex-shrink-0 min-w-0 gap-2">
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
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] font-mono uppercase text-white/32 hover:text-white/48 transition-colors flex-shrink-0"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Details drawer */}
      {showDetails && data && (
        <div className="border-t border-white/[0.08] bg-[#14171D] max-h-48 overflow-y-auto rounded-b-sm">
          <div className="p-3 text-[10px]">
            <div className="text-white/48 mb-2 font-mono uppercase">Constituent Weights:</div>
            <div className="space-y-1">
              {data.constituents
                .sort((a, b) => b.weight - a.weight)
                .map((constituent) => (
                  <div key={constituent.ticker} className="flex justify-between text-white/32">
                    <span className="font-mono">{constituent.ticker}</span>
                    <span className="text-white/48 font-mono">{(constituent.weight * 100).toFixed(2)}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


