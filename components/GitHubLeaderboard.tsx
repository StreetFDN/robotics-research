'use client';

import { useState, useEffect, useMemo } from 'react';
import IntelPanel, { IntelPanelEmpty, IntelPanelError } from './ui/IntelPanel';

interface OrgEntry {
  name: string;
  displayName: string;
  commitsWeek: number;
  commitsMonth: number;
  starsTotal: number;
  topRepo: { name: string; stars: number };
  trend: 'up' | 'down' | 'stable';
  avatarUrl: string;
}

interface LeaderboardResponse {
  ok: boolean;
  data?: { orgs: OrgEntry[] };
  error?: string;
}

type SortKey = 'commitsWeek' | 'starsTotal' | 'topRepo';

/**
 * Shimmer skeleton for loading state
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2 bg-white/[0.02] rounded-sm">
          <div className="w-6 h-6 bg-white/[0.08] rounded-full" />
          <div className="w-8 h-8 bg-white/[0.06] rounded-full" />
          <div className="flex-1">
            <div className="h-3 w-24 bg-white/[0.08] rounded mb-1" />
            <div className="h-2 w-16 bg-white/[0.06] rounded" />
          </div>
          <div className="h-4 w-12 bg-white/[0.06] rounded" />
          <div className="h-4 w-12 bg-white/[0.06] rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Rank badge with medal colors
 */
function RankBadge({ rank }: { rank: number }) {
  const colors = {
    1: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30',
    2: 'bg-[#C0C0C0]/20 text-[#C0C0C0] border-[#C0C0C0]/30',
    3: 'bg-[#CD7F32]/20 text-[#CD7F32] border-[#CD7F32]/30',
  };
  const style = colors[rank as 1 | 2 | 3] || 'bg-white/[0.04] text-white/40 border-white/[0.08]';

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border ${style}`}>
      {rank}
    </div>
  );
}

/**
 * Trend indicator arrow
 */
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <span className="text-[#00FF88]">▲</span>;
  }
  if (trend === 'down') {
    return <span className="text-[#FF4444]">▼</span>;
  }
  return <span className="text-white/24">—</span>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * GitHubLeaderboard - Sprint 5
 * Table showing top robotics orgs ranked by weekly commits
 */
export default function GitHubLeaderboard() {
  const [data, setData] = useState<OrgEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('commitsWeek');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/github/leaderboard');
        const result: LeaderboardResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch leaderboard');
        }

        setData(result.data.orgs);
      } catch (err: any) {
        console.error('[GitHubLeaderboard] Fetch error:', err);
        setError(err.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [refreshKey]);

  // Sort data by selected key
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortKey === 'commitsWeek') return b.commitsWeek - a.commitsWeek;
      if (sortKey === 'starsTotal') return b.starsTotal - a.starsTotal;
      if (sortKey === 'topRepo') return b.topRepo.stars - a.topRepo.stars;
      return 0;
    });
  }, [data, sortKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <IntelPanel
      title="ORGANIZATION LEADERBOARD"
      subtitle="Weekly Commit Rankings"
      headerRight={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-[9px] font-mono text-white/32 hover:text-[#00FFE0] disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 2V5L11 3.5 8 2Z" fill="currentColor" />
          </svg>
        </button>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <IntelPanelError message={error} onRetry={handleRefresh} />
      ) : sortedData.length === 0 ? (
        <IntelPanelEmpty message="No leaderboard data available" minHeight="150px" />
      ) : (
        <div className="space-y-3">
          {/* Sort Controls */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-white/32">
            <span>SORT BY:</span>
            {(['commitsWeek', 'starsTotal', 'topRepo'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  sortKey === key
                    ? 'bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/20'
                    : 'hover:text-white/48'
                }`}
              >
                {key === 'commitsWeek' ? 'COMMITS' : key === 'starsTotal' ? 'STARS' : 'TOP REPO'}
              </button>
            ))}
          </div>

          {/* Leaderboard Table */}
          <div className="space-y-1">
            {sortedData.map((org, index) => (
              <div
                key={org.name}
                className="flex items-center gap-3 p-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-sm border border-white/[0.04] hover:border-white/[0.08] transition-colors cursor-pointer"
              >
                {/* Rank */}
                <RankBadge rank={index + 1} />

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                  {org.avatarUrl ? (
                    <img src={org.avatarUrl} alt={org.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-white/32">
                      {org.displayName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Org Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-white truncate">
                    {org.displayName}
                  </div>
                  <div className="text-[10px] font-mono text-white/32 truncate">
                    Top: {org.topRepo.name}
                  </div>
                </div>

                {/* Commits/Week */}
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] font-mono font-medium text-[#00FFE0]">
                    {formatNumber(org.commitsWeek)}
                  </div>
                  <div className="text-[9px] font-mono text-white/24">commits/wk</div>
                </div>

                {/* Stars */}
                <div className="text-right flex-shrink-0 w-16">
                  <div className="text-[12px] font-mono text-[#FFB800]">
                    ⭐ {formatNumber(org.starsTotal)}
                  </div>
                </div>

                {/* Trend */}
                <div className="w-6 text-center">
                  <TrendArrow trend={org.trend} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/24 flex justify-between">
            <span>Source: GitHub API</span>
            <span>Updated hourly</span>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
