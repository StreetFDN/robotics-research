'use client';

import { useMemo } from 'react';
import type { FundingRoundData } from '@/types/funding';

interface FundingChartProps {
  rounds: FundingRoundData[];
  width?: number;
  height?: number;
}

/**
 * Simple SVG chart for funding rounds valuation over time
 */
export default function FundingChart({ rounds, width = 280, height = 80 }: FundingChartProps) {
  const chartData = useMemo(() => {
    // Filter rounds with both valuation and time
    const validRounds = rounds.filter(
      (r) => r.valuationUsd !== undefined && r.time !== undefined
    );

    if (validRounds.length === 0) {
      return null;
    }

    // Parse dates and sort by time
    const dataPoints = validRounds
      .map((r) => {
        const [month, year] = r.time!.split('/').map(Number);
        const date = new Date(year, month - 1, 1);
        return {
          timestamp: date.getTime(),
          valuation: r.valuationUsd!,
          round: r.round,
          time: r.time!,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    if (dataPoints.length === 0) {
      return null;
    }

    // Chart dimensions
    const margins = { top: 8, right: 8, bottom: 20, left: 40 };
    const innerW = width - margins.left - margins.right;
    const innerH = height - margins.top - margins.bottom;

    // Calculate scales
    const minTime = Math.min(...dataPoints.map((d) => d.timestamp));
    const maxTime = Math.max(...dataPoints.map((d) => d.timestamp));
    const timeRange = maxTime - minTime || 1;

    const minVal = Math.min(...dataPoints.map((d) => d.valuation));
    const maxVal = Math.max(...dataPoints.map((d) => d.valuation));
    const valRange = maxVal - minVal || 1;

    // Add padding to y-axis (10% on top)
    const valPadding = valRange * 0.1;
    const scaledMinVal = Math.max(0, minVal - valPadding);
    const scaledMaxVal = maxVal + valPadding;
    const scaledValRange = scaledMaxVal - scaledMinVal || 1;

    // Calculate positions and build path
    const dataPointsWithPositions = dataPoints.map((d) => {
      const x = margins.left + ((d.timestamp - minTime) / timeRange) * innerW;
      const y =
        margins.top +
        innerH -
        ((d.valuation - scaledMinVal) / scaledValRange) * innerH;
      return {
        ...d,
        x,
        y,
      };
    });

    const pathData = dataPointsWithPositions
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.x} ${d.y}`)
      .join(' ');

    // Format valuation for display
    const formatValuation = (val: number): string => {
      if (val >= 1_000_000_000) {
        return `$${(val / 1_000_000_000).toFixed(1)}B`;
      } else if (val >= 1_000_000) {
        return `$${(val / 1_000_000).toFixed(0)}M`;
      } else if (val >= 1_000) {
        return `$${(val / 1_000).toFixed(0)}K`;
      }
      return `$${val.toFixed(0)}`;
    };

    // Generate y-axis ticks
    const numTicks = 4;
    const tickStep = scaledValRange / (numTicks - 1);
    const ticks: Array<{ value: number; label: string; y: number }> = [];
    for (let i = 0; i < numTicks; i++) {
      const value = scaledMinVal + i * tickStep;
      const y = margins.top + innerH - (i / (numTicks - 1)) * innerH;
      ticks.push({
        value,
        label: formatValuation(value),
        y,
      });
    }

    // Generate x-axis labels (show first, middle, last)
    const xLabels: Array<{ time: string; x: number }> = [];
    if (dataPoints.length === 1) {
      xLabels.push({
        time: dataPoints[0].time,
        x: margins.left + innerW / 2,
      });
    } else if (dataPoints.length > 1) {
      xLabels.push({
        time: dataPoints[0].time,
        x: margins.left,
      });
      if (dataPoints.length > 2) {
        xLabels.push({
          time: dataPoints[Math.floor(dataPoints.length / 2)].time,
          x: margins.left + innerW / 2,
        });
      }
      xLabels.push({
        time: dataPoints[dataPoints.length - 1].time,
        x: margins.left + innerW,
      });
    }

    return {
      width,
      height,
      margins,
      innerW,
      innerH,
      pathData,
      dataPoints: dataPointsWithPositions,
      ticks,
      xLabels,
      formatValuation,
    };
  }, [rounds, width, height]);

  if (!chartData) {
    return (
      <div className="text-gray-500 text-[10px] text-center py-2">
        No valuation data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        width={chartData.width}
        height={chartData.height}
        className="overflow-visible"
      >
        {/* Y-axis grid lines */}
        {chartData.ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={chartData.margins.left}
              y1={tick.y}
              x2={chartData.margins.left + chartData.innerW}
              y2={tick.y}
              stroke="#374151"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <text
              x={chartData.margins.left - 4}
              y={tick.y + 3}
              fill="#9CA3AF"
              fontSize="9"
              textAnchor="end"
              className="font-mono"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Chart line */}
        {chartData.pathData && (
          <path
            d={chartData.pathData}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {chartData.dataPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="#ef4444"
            stroke="#1f2937"
            strokeWidth="1"
          />
        ))}

        {/* X-axis labels */}
        {chartData.xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={chartData.height - 6}
            fill="#9CA3AF"
            fontSize="8"
            textAnchor={
              i === 0
                ? 'start'
                : i === chartData.xLabels.length - 1
                  ? 'end'
                  : 'middle'
            }
            className="font-mono"
          >
            {label.time}
          </text>
        ))}
      </svg>
    </div>
  );
}

