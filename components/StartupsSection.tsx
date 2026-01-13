'use client';

import { useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany, FundingRoundData } from '@/types/companies';
import { Event } from '@/types';

interface ValuationPoint {
  timestamp: number;
  cumulativeValuation: number;
  companyCount: number;
}

export default function StartupsSection() {
  const { privateCompanies } = useGlobeStore();

  // Calculate cumulative valuation over time
  const valuationHistory = useMemo(() => {
    const allRounds: Array<{
      timestamp: number;
      valuation: number;
      companyId: string;
      companyName: string;
    }> = [];

    privateCompanies.forEach((company) => {
      if (!company.fundingRounds) return;

      company.fundingRounds.forEach((round) => {
        if (round.valuationUsd && round.time) {
          const [month, year] = round.time.split('/').map(Number);
          if (month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
            const timestamp = new Date(year, month - 1, 1).getTime();
            allRounds.push({
              timestamp,
              valuation: round.valuationUsd,
              companyId: company.id,
              companyName: company.name,
            });
          }
        }
      });
    });

    // Sort by timestamp
    allRounds.sort((a, b) => a.timestamp - b.timestamp);

    // Build cumulative timeline
    const timeline: ValuationPoint[] = [];
    let cumulative = 0;
    const seenCompanies = new Set<string>();

    allRounds.forEach((round) => {
      // Only count the latest valuation per company at each point in time
      const existingIndex = timeline.findIndex(
        (p) => p.timestamp === round.timestamp
      );

      if (existingIndex >= 0) {
        // Update existing point - replace if this is a newer valuation for the same company
        const existing = timeline[existingIndex];
        const previousRound = allRounds
          .slice(0, allRounds.indexOf(round))
          .reverse()
          .find((r) => r.companyId === round.companyId);

        if (!previousRound || round.timestamp > previousRound.timestamp) {
          // This is the latest valuation for this company at this time
          cumulative = cumulative - (previousRound?.valuation || 0) + round.valuation;
          timeline[existingIndex] = {
            timestamp: round.timestamp,
            cumulativeValuation: cumulative,
            companyCount: seenCompanies.size,
          };
        }
      } else {
        // New timestamp point
        if (!seenCompanies.has(round.companyId)) {
          seenCompanies.add(round.companyId);
          cumulative += round.valuation;
        } else {
          // Replace previous valuation for this company
          const prevRound = allRounds
            .slice(0, allRounds.indexOf(round))
            .reverse()
            .find((r) => r.companyId === round.companyId);
          if (prevRound) {
            cumulative = cumulative - prevRound.valuation + round.valuation;
          }
        }

        timeline.push({
          timestamp: round.timestamp,
          cumulativeValuation: cumulative,
          companyCount: seenCompanies.size,
        });
      }
    });

    return timeline;
  }, [privateCompanies]);

  // Calculate current cumulative valuation
  const currentValuation = useMemo(() => {
    const companyLatestValuations = new Map<string, number>();

    privateCompanies.forEach((company) => {
      if (!company.fundingRounds) return;

      // Find latest valuation
      const latestRound = company.fundingRounds
        .filter((r) => r.valuationUsd !== undefined && r.time !== undefined)
        .sort((a, b) => {
          if (!a.time || !b.time) return 0;
          const [aMonth, aYear] = a.time.split('/').map(Number);
          const [bMonth, bYear] = b.time.split('/').map(Number);
          return new Date(bYear, bMonth - 1).getTime() - new Date(aYear, aMonth - 1).getTime();
        })[0];

      if (latestRound?.valuationUsd) {
        companyLatestValuations.set(company.id, latestRound.valuationUsd);
      }
    });

    return Array.from(companyLatestValuations.values()).reduce((sum, val) => sum + val, 0);
  }, [privateCompanies]);

  const formatValuation = (val: number): string => {
    if (val >= 1_000_000_000_000) return `$${(val / 1_000_000_000_000).toFixed(2)}T`;
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 200;
  const margins = { top: 20, right: 60, bottom: 30, left: 60 };

  const chartData = useMemo(() => {
    if (valuationHistory.length === 0) return null;

    const innerW = chartWidth - margins.left - margins.right;
    const innerH = chartHeight - margins.top - margins.bottom;

    const minTime = Math.min(...valuationHistory.map((p) => p.timestamp));
    const maxTime = Math.max(...valuationHistory.map((p) => p.timestamp));
    const timeRange = maxTime - minTime || 1;

    const minVal = 0;
    const maxVal = Math.max(...valuationHistory.map((p) => p.cumulativeValuation));
    const valRange = maxVal - minVal || 1;
    const valPadding = valRange * 0.1;
    const scaledMaxVal = maxVal + valPadding;
    const scaledValRange = scaledMaxVal - minVal || 1;

    // Build path
    const pathData = valuationHistory
      .map((point, i) => {
        const x = margins.left + ((point.timestamp - minTime) / timeRange) * innerW;
        const y =
          margins.top +
          innerH -
          ((point.cumulativeValuation - minVal) / scaledValRange) * innerH;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Generate y-axis ticks
    const numTicks = 5;
    const tickStep = scaledValRange / (numTicks - 1);
    const ticks: Array<{ value: number; label: string; y: number }> = [];
    for (let i = 0; i < numTicks; i++) {
      const value = minVal + i * tickStep;
      const y =
        margins.top +
        innerH -
        ((value - minVal) / scaledValRange) * innerH;
      ticks.push({ value, label: formatValuation(value), y });
    }

    // Generate x-axis labels
    const xLabels: Array<{ time: string; x: number }> = [];
    if (valuationHistory.length === 1) {
      xLabels.push({
        time: new Date(valuationHistory[0].timestamp).toLocaleDateString('en-US', {
          year: 'numeric',
        }),
        x: margins.left + innerW / 2,
      });
    } else if (valuationHistory.length > 1) {
      xLabels.push({
        time: new Date(valuationHistory[0].timestamp).toLocaleDateString('en-US', {
          year: 'numeric',
        }),
        x: margins.left,
      });
      if (valuationHistory.length > 2) {
        xLabels.push({
          time: new Date(valuationHistory[Math.floor(valuationHistory.length / 2)].timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
          }),
          x: margins.left + innerW / 2,
        });
      }
      xLabels.push({
        time: new Date(valuationHistory[valuationHistory.length - 1].timestamp).toLocaleDateString('en-US', {
          year: 'numeric',
        }),
        x: margins.left + innerW,
      });
    }

    return {
      width: chartWidth,
      height: chartHeight,
      margins,
      innerW,
      innerH,
      pathData,
      ticks,
      xLabels,
      dataPoints: valuationHistory.map((point) => {
        const x = margins.left + ((point.timestamp - minTime) / timeRange) * innerW;
        const y =
          margins.top +
          innerH -
          ((point.cumulativeValuation - minVal) / scaledValRange) * innerH;
        return { ...point, x, y };
      }),
    };
  }, [valuationHistory]);

  return (
    <section className="w-full px-6 py-8 border-t border-white/10 glass-subtle">
      <div className="mb-6">
        <h2 className="text-subheadline font-semibold text-white mb-1">Startups</h2>
        <div className="text-caption text-gray-500">Private robotics companies tracking</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cumulative Valuation Tracker */}
        <div className="glass rounded-lg p-6">
          <div className="text-label text-gray-500 mb-3">Cumulative Valuation</div>
          <div className="text-headline font-bold text-white tabular-nums mb-1">
            {formatValuation(currentValuation)}
          </div>
          <div className="text-caption text-gray-400">
            {privateCompanies.length} companies tracked
          </div>
        </div>

        {/* Additional stats can go here */}
        <div className="glass rounded-lg p-6">
          <div className="text-label text-gray-500 mb-3">Total Rounds</div>
          <div className="text-headline font-bold text-white tabular-nums mb-1">
            {privateCompanies.reduce((sum, c) => sum + (c.fundingRounds?.length || 0), 0)}
          </div>
          <div className="text-caption text-gray-400">Funding rounds recorded</div>
        </div>

        <div className="glass rounded-lg p-6">
          <div className="text-label text-gray-500 mb-3">Avg Valuation</div>
          <div className="text-headline font-bold text-white tabular-nums mb-1">
            {formatValuation(
              currentValuation /
                Math.max(
                  1,
                  privateCompanies.filter((c) => c.fundingRounds?.some((r) => r.valuationUsd)).length
                )
            )}
          </div>
          <div className="text-caption text-gray-400">Per company</div>
        </div>
      </div>

      {/* Cumulative Valuation Chart */}
      {chartData && (
        <div className="glass rounded-lg p-6 mb-6">
          <div className="text-label text-gray-500 mb-4">Cumulative Valuation History</div>
          <div className="overflow-x-auto">
            <svg width={chartData.width} height={chartData.height}>
              {/* Grid lines */}
              {chartData.ticks.map((tick, i) => (
                <line
                  key={`y-grid-${i}`}
                  x1={chartData.margins.left}
                  y1={tick.y}
                  x2={chartData.margins.left + chartData.innerW}
                  y2={tick.y}
                  stroke="#2A3A4A"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              ))}

              {/* Path */}
              {chartData.pathData && (
                <path
                  d={chartData.pathData}
                  fill="none"
                  stroke="#00D9FF"
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
                  fill="#00D9FF"
                  stroke="#1f2937"
                  strokeWidth="1"
                />
              ))}

              {/* Y-axis labels */}
              {chartData.ticks.map((tick, i) => (
                <text
                  key={`y-label-${i}`}
                  x={chartData.margins.left - 10}
                  y={tick.y + 3}
                  fill="#9CA3AF"
                  fontSize="10"
                  textAnchor="end"
                  className="font-mono"
                >
                  {tick.label}
                </text>
              ))}

              {/* X-axis labels */}
              {chartData.xLabels.map((label, i) => (
                <text
                  key={`x-label-${i}`}
                  x={label.x}
                  y={chartData.height - 10}
                  fill="#9CA3AF"
                  fontSize="10"
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
        </div>
      )}

      {/* Newsflow Section (rebuild EventStream) */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-subheadline font-semibold text-white">Newsflow</h2>
            <div className="text-caption text-gray-500 mt-1">Latest robotics industry events</div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
            <EventStreamContent />
          </div>
        </div>
      </div>
    </section>
  );
}

// EventStream content component (extracted from EventStream for reuse)
function EventStreamContent() {
  const { events, selectedCompany, selectedEvent, setSelectedEvent, eventFilter } = useGlobeStore();

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    if (selectedCompany) {
      filtered = filtered.filter((e) => e.company_id === selectedCompany.id);
    }
    
    if (eventFilter) {
      if (eventFilter.companyId) {
        filtered = filtered.filter((e) => e.company_id === eventFilter.companyId);
      }
      if (eventFilter.eventId) {
        filtered = filtered.filter((e) => e.id === eventFilter.eventId);
      }
    }
    
    return filtered;
  }, [events, selectedCompany, eventFilter]);

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const typeColors = {
    funding: 'bg-accent/20 text-accent',
    product: 'bg-teal/20 text-teal',
    partnership: 'bg-amber/20 text-amber',
    hiring: 'bg-white/20 text-white',
    research: 'bg-accent/20 text-accent',
    patent: 'bg-gray-600/20 text-gray-400',
    other: 'bg-gray-700/20 text-gray-500',
  };

  return (
    <>
      {sortedEvents.length === 0 ? (
        <div className="p-4 text-gray-500 text-body">No events found</div>
      ) : (
        <div className="divide-y divide-white/10">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`p-4 cursor-pointer transition-all hover:glass-subtle ${
                selectedEvent?.id === event.id ? 'glass' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-caption px-2 py-1 rounded ${typeColors[event.type]}`}
                  >
                    {event.type}
                  </span>
                </div>
                <span className="text-caption text-gray-600 font-mono">
                  {event.timestamp.toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-body font-medium text-white mb-1">{event.title}</h3>
              {event.description && (
                <p className="text-caption text-gray-400 mb-2">{event.description}</p>
              )}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption text-accent hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Source →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

