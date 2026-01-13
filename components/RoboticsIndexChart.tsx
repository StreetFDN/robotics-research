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
    <div className="flex flex-col bg-[#0a0e27] border-b border-gray-800" style={{ height: '260px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#00d4ff] tracking-wider">ROBOTICS INDEX</span>
        </div>
        <div className="flex items-center gap-4">
          {data && (
            <div className="flex items-center gap-2 text-right">
              <div>
                <div className="text-sm font-mono text-white">{data.latestValue.toFixed(2)}</div>
                <div className={`text-xs font-mono ${isPositive ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                  {isPositive ? '+' : ''}{data.dayChange.toFixed(2)} ({isPositive ? '+' : ''}{data.dayChangePercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative px-4 py-3" style={{ minHeight: 0 }}>
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
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            <g opacity="0.2">
              {chartData.yLabels.map((label, i) => (
                <line
                  key={i}
                  x1={10}
                  y1={label.y + 20}
                  x2={90}
                  y2={label.y + 20}
                  stroke="#666"
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
                  fontSize="2.5"
                  fill="#888"
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
                  fontSize="2.5"
                  fill="#888"
                  textAnchor={i === 0 ? 'start' : i === chartData.xLabels.length - 1 ? 'end' : 'middle'}
                  fontFamily="monospace"
                >
                  {label.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
              stroke="#00d4ff"
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
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Details drawer */}
      {showDetails && data && (
        <div className="border-t border-gray-800/50 bg-[#0a0e27] max-h-48 overflow-y-auto">
          <div className="p-3 text-xs">
            <div className="text-gray-400 mb-2 font-semibold">Constituent Weights:</div>
            <div className="space-y-1">
              {data.constituents
                .sort((a, b) => b.weight - a.weight)
                .map((constituent) => (
                  <div key={constituent.ticker} className="flex justify-between text-gray-500">
                    <span className="font-mono">{constituent.ticker}</span>
                    <span className="text-gray-400">{(constituent.weight * 100).toFixed(2)}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

