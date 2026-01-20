'use client';

import { useState, useEffect } from 'react';

interface FundingRound {
  company: string;
  amount: number;
  round?: string;
  date: string;
  investors?: string[];
  valuation?: number | null;
  description?: string;
  source?: string;
  url?: string;
}

interface FundingResponse {
  ok: boolean;
  data?: {
    rounds: FundingRound[];
    totalRounds: number;
    totalRaised: number;
    avgRoundSize: number;
    period: string;
    sources: {
      curated: number;
      newsApi: number;
    };
  };
  error?: string;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(0)}M`;
  } else if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getRoundColor(round?: string): string {
  if (!round) return '#888888';
  const r = round.toLowerCase();
  if (r.includes('series f') || r.includes('series e') || r.includes('series d')) return '#FF3B3B';
  if (r.includes('series c')) return '#FF8C00';
  if (r.includes('series b')) return '#FFB800';
  if (r.includes('series a')) return '#00FF88';
  if (r.includes('seed')) return '#00FFE0';
  if (r.includes('ipo')) return '#9D4EDD';
  return '#888888';
}

export default function FundingNews() {
  const [data, setData] = useState<FundingResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchFunding = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/funding?days=365&limit=30');
        const result: FundingResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch funding data');
        }

        setData(result.data);
        setError(null);
      } catch (err: any) {
        console.error('[FundingNews] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFunding();
  }, []);

  const displayRounds = expanded ? data?.rounds : data?.rounds.slice(0, 8);

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/[0.08] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">
            💰 Robotics Funding Rounds
          </h2>
          <div className="text-[9px] font-mono text-white/24 mt-0.5">
            2024-2025 funding data • NewsAPI + Curated
          </div>
        </div>
        {data && (
          <div className="text-right">
            <div className="text-[14px] font-mono font-bold text-[#00FF88]">
              {formatAmount(data.totalRaised)}
            </div>
            <div className="text-[8px] font-mono text-white/32">
              {data.totalRounds} rounds
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <div className="text-[11px] font-mono text-[#FF3B3B]">{error}</div>
          </div>
        ) : data ? (
          <div className="space-y-1">
            {displayRounds?.map((round, i) => (
              <div
                key={`${round.company}-${round.date}-${i}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-white/[0.04] transition-colors group"
              >
                {/* Rank/Amount Badge */}
                <div
                  className="flex-shrink-0 w-16 text-center py-1 rounded-sm font-mono text-[11px] font-bold"
                  style={{
                    backgroundColor: `${getRoundColor(round.round)}20`,
                    color: getRoundColor(round.round),
                  }}
                >
                  {formatAmount(round.amount)}
                </div>

                {/* Company & Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-white/90 truncate">
                      {round.company}
                    </span>
                    {round.round && (
                      <span
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm"
                        style={{
                          backgroundColor: `${getRoundColor(round.round)}15`,
                          color: getRoundColor(round.round),
                        }}
                      >
                        {round.round}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-white/32 truncate mt-0.5">
                    {round.description || round.investors?.slice(0, 3).join(', ') || 'Robotics/AI company'}
                  </div>
                </div>

                {/* Date & Source */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-[9px] font-mono text-white/40">
                    {formatDate(round.date)}
                  </div>
                  <div className="text-[8px] font-mono text-white/20">
                    {round.source === 'NewsAPI' ? '🔴 Breaking' : ''}
                  </div>
                </div>

                {/* Link indicator */}
                {round.url && (
                  <a
                    href={round.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-[#00FFE0]"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4H4a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-2m-4-8h6m0 0v6m0-6L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
              </div>
            ))}

            {/* Show More/Less */}
            {data.rounds.length > 8 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-2 py-2 text-[10px] font-mono text-[#00FFE0]/70 hover:text-[#00FFE0] transition-colors border border-white/[0.06] rounded hover:bg-white/[0.02]"
              >
                {expanded ? '▲ Show Less' : `▼ Show All ${data.rounds.length} Rounds`}
              </button>
            )}

            {/* Stats Footer */}
            <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-[14px] font-mono font-bold text-white/80">
                  {data.totalRounds}
                </div>
                <div className="text-[8px] font-mono text-white/32 uppercase">Rounds</div>
              </div>
              <div>
                <div className="text-[14px] font-mono font-bold text-white/80">
                  {formatAmount(data.avgRoundSize)}
                </div>
                <div className="text-[8px] font-mono text-white/32 uppercase">Avg Size</div>
              </div>
              <div>
                <div className="text-[14px] font-mono font-bold text-white/80">
                  {data.sources.curated + data.sources.newsApi}
                </div>
                <div className="text-[8px] font-mono text-white/32 uppercase">Sources</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
