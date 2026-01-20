'use client';

import { useState, useEffect, useMemo } from 'react';
import IntelPanel, { IntelPanelEmpty, IntelPanelError } from './ui/IntelPanel';

interface TrendingRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  starsDelta: number;
  language: string;
  topics: string[];
  url: string;
  createdAt: string;
}

interface TrendingResponse {
  ok: boolean;
  data?: { repos: TrendingRepo[] };
  error?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  'Python': '#3572A5',
  'C++': '#f34b7d',
  'C': '#555555',
  'JavaScript': '#f1e05a',
  'TypeScript': '#2b7489',
  'Rust': '#dea584',
  'Go': '#00ADD8',
  'Java': '#b07219',
  'CUDA': '#3A4E3A',
  'Shell': '#89e051',
  'CMake': '#DA3434',
};

const TOPIC_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'humanoid', label: 'HUMANOID' },
  { id: 'drones', label: 'DRONES' },
  { id: 'manipulation', label: 'MANIPULATION' },
  { id: 'ros', label: 'ROS' },
  { id: 'ml', label: 'ML/AI' },
];

/**
 * Shimmer skeleton for loading state
 */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/[0.02] rounded-sm p-3 border border-white/[0.04]">
          <div className="h-4 w-32 bg-white/[0.08] rounded mb-2" />
          <div className="h-3 w-full bg-white/[0.06] rounded mb-1" />
          <div className="h-3 w-2/3 bg-white/[0.06] rounded mb-3" />
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-white/[0.06] rounded" />
            <div className="h-3 w-12 bg-white/[0.08] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * TrendingRepos - Sprint 5
 * Grid of trending robotics repos with filtering
 */
export default function TrendingRepos() {
  const [data, setData] = useState<TrendingRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = activeFilter === 'all'
          ? '/api/github/trending'
          : `/api/github/trending?topic=${activeFilter}`;
        const response = await fetch(url);
        const result: TrendingResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch trending repos');
        }

        setData(result.data.repos);
      } catch (err: any) {
        console.error('[TrendingRepos] Fetch error:', err);
        setError(err.message || 'Failed to load trending repos');
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [activeFilter, refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <IntelPanel
      title="TRENDING REPOSITORIES"
      subtitle="Fastest Growing This Week"
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
      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {TOPIC_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-2.5 py-1 text-[9px] font-mono rounded-sm transition-colors whitespace-nowrap ${
              activeFilter === filter.id
                ? 'bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/20'
                : 'text-white/32 hover:text-white/48 border border-transparent'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <IntelPanelError message={error} onRetry={handleRefresh} />
      ) : data.length === 0 ? (
        <IntelPanelEmpty message="No trending repos found for this filter" minHeight="150px" />
      ) : (
        <div className="space-y-4">
          {/* Repo Grid */}
          <div className="grid grid-cols-2 gap-3">
            {data.slice(0, 6).map((repo) => (
              <a
                key={repo.fullName}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/[0.02] hover:bg-white/[0.04] rounded-sm p-3 border border-white/[0.04] hover:border-white/[0.08] transition-colors group"
              >
                {/* Repo Name */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-mono font-medium text-white group-hover:text-[#00FFE0] truncate transition-colors">
                    {repo.name}
                  </span>
                  {repo.language && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || '#666' }}
                      title={repo.language}
                    />
                  )}
                </div>

                {/* Description */}
                <p className="text-[10px] text-white/40 line-clamp-2 mb-3 min-h-[28px]">
                  {repo.description || 'No description'}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-1 text-[#FFB800]">
                    <span>⭐</span>
                    <span>{formatNumber(repo.stars)}</span>
                  </div>
                  {repo.starsDelta > 0 && (
                    <div className="text-[#00FF88] bg-[#00FF88]/10 px-1.5 py-0.5 rounded-sm">
                      +{formatNumber(repo.starsDelta)}
                    </div>
                  )}
                </div>

                {/* Topics */}
                {repo.topics && repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {repo.topics.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="text-[8px] font-mono text-white/24 bg-white/[0.04] px-1 py-0.5 rounded-sm"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/24 flex justify-between">
            <span>Source: GitHub API</span>
            <span>{data.length} repos tracked</span>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
