'use client';

import { useMemo, useState, useEffect } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';
import type { FundingRoundData } from '@/types/funding';
import { Event } from '@/types';

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  source: string;
  publishedAt: string;
  url: string;
  type: string;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

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
    <section className="w-full px-6 py-6 border-t border-white/[0.08] bg-[#08090C]">
      {/* Section Header */}
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h2 className="text-[11px] font-medium text-white/48 uppercase tracking-[0.1em] mb-1">PRIVATE MARKET INTELLIGENCE</h2>
          <div className="text-[13px] font-medium text-white">Robotics Startup Tracking</div>
        </div>
        <div className="text-[9px] font-mono text-white/24">{privateCompanies.length} ENTITIES</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        {/* Cumulative Valuation */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm p-4">
          <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider mb-2">CUMULATIVE VALUATION</div>
          <div className="text-[24px] font-mono font-medium text-[#00FFE0] leading-none mb-1">
            {formatValuation(currentValuation)}
          </div>
          <div className="text-[10px] font-mono text-white/40">
            {privateCompanies.length} companies tracked
          </div>
        </div>

        {/* Total Rounds */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm p-4">
          <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider mb-2">TOTAL ROUNDS</div>
          <div className="text-[24px] font-mono font-medium text-white leading-none mb-1">
            {privateCompanies.reduce((sum, c) => sum + (c.fundingRounds?.length || 0), 0)}
          </div>
          <div className="text-[10px] font-mono text-white/40">Funding rounds recorded</div>
        </div>

        {/* Avg Valuation */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm p-4">
          <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider mb-2">AVG VALUATION</div>
          <div className="text-[24px] font-mono font-medium text-white leading-none mb-1">
            {formatValuation(
              currentValuation /
                Math.max(
                  1,
                  privateCompanies.filter((c) => c.fundingRounds?.some((r) => r.valuationUsd)).length
                )
            )}
          </div>
          <div className="text-[10px] font-mono text-white/40">Per company</div>
        </div>
      </div>

      {/* Cumulative Valuation Chart */}
      {chartData && (
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm p-4 mb-5">
          <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider mb-3">CUMULATIVE VALUATION HISTORY</div>
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
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
              ))}

              {/* Path */}
              {chartData.pathData && (
                <path
                  d={chartData.pathData}
                  fill="none"
                  stroke="#00FFE0"
                  strokeWidth="1.5"
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
                  r="2.5"
                  fill="#00FFE0"
                  stroke="#08090C"
                  strokeWidth="1"
                />
              ))}

              {/* Y-axis labels */}
              {chartData.ticks.map((tick, i) => (
                <text
                  key={`y-label-${i}`}
                  x={chartData.margins.left - 10}
                  y={tick.y + 3}
                  fill="rgba(255,255,255,0.32)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="monospace"
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
                  fill="rgba(255,255,255,0.32)"
                  fontSize="9"
                  textAnchor={
                    i === 0
                      ? 'start'
                      : i === chartData.xLabels.length - 1
                        ? 'end'
                        : 'middle'
                  }
                  fontFamily="monospace"
                >
                  {label.time}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Newsflow Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-mono text-white/72 uppercase tracking-wider">EVENT STREAM</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-pulse" />
                <span className="text-[9px] font-mono text-white/40">LIVE</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '300px' }}>
            <EventStreamContent />
          </div>
        </div>
      </div>
    </section>
  );
}

// EventStream content component with live NewsAPI integration
function EventStreamContent() {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Fetch robotics news on mount
  useEffect(() => {
    async function fetchNews() {
      try {
        setNewsLoading(true);
        const response = await fetch('/api/news/robotics?days=7&limit=20');
        const data = await response.json();

        if (data.ok && data.data?.articles) {
          setNewsArticles(data.data.articles);
          setNewsError(null);
        } else {
          setNewsError(data.error || 'Failed to fetch news');
        }
      } catch (err) {
        console.error('[EventStream] News fetch error:', err);
        setNewsError('Failed to fetch news');
      } finally {
        setNewsLoading(false);
      }
    }

    fetchNews();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const typeColors: Record<string, string> = {
    funding: 'bg-[#00FFE0]/10 text-[#00FFE0] border-[#00FFE0]/20',
    product: 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20',
    partnership: 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20',
    acquisition: 'bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/20',
    hiring: 'bg-white/10 text-white/72 border-white/20',
    research: 'bg-[#00FFE0]/10 text-[#00FFE0] border-[#00FFE0]/20',
    patent: 'bg-white/5 text-white/48 border-white/10',
    news: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20',
    other: 'bg-white/5 text-white/32 border-white/10',
  };

  if (newsLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="w-4 h-4 border border-[#00FFE0]/50 border-t-[#00FFE0] rounded-full animate-spin" />
        <span className="ml-2 text-[10px] font-mono text-white/32">Loading news...</span>
      </div>
    );
  }

  if (newsError || newsArticles.length === 0) {
    return (
      <div className="p-4 text-[11px] font-mono text-white/32">
        {newsError || 'No news found'}
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {newsArticles.map((article) => {
        const publishedDate = new Date(article.publishedAt);
        return (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.02]"
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm border ${typeColors[article.type] || typeColors.news}`}
                >
                  {article.type}
                </span>
                <span className="text-[9px] text-white/32 font-mono">
                  {article.source}
                </span>
              </div>
              <span className="text-[9px] text-white/24 font-mono">
                {formatTimeAgo(publishedDate)}
              </span>
            </div>
            <h3 className="text-[12px] font-medium text-white/88 mb-1 leading-snug line-clamp-2">{article.title}</h3>
            {article.description && (
              <p className="text-[10px] text-white/48 mb-1.5 line-clamp-2">{article.description}</p>
            )}
            <div className="flex items-center gap-1 text-[9px] font-mono text-[#00FFE0]/72">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              READ MORE
            </div>
          </a>
        );
      })}
    </div>
  );
}

