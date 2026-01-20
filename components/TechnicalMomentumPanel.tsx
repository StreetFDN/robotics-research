'use client';

import { useState, useEffect } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import IntelPanel, { IntelPanelEmpty } from './ui/IntelPanel';

interface RepoStats {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  pushedAt: string;
}

interface TechnicalMomentum {
  organization: string;
  totalStars: number;
  totalForks: number;
  repoCount: number;
  topRepos: RepoStats[];
  weeklyCommits: number;
  monthlyCommits: number;
  starVelocity: number;
  commitVelocity: number;
  activityScore: number;
  lastActivity: string;
  topLanguages: Array<{ language: string; count: number }>;
  found: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
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

/**
 * Shimmer skeleton loading component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Activity Score Skeleton */}
      <div className="bg-white/[0.04] rounded-sm p-3 border border-white/[0.06]">
        <div className="flex justify-between mb-2">
          <div className="h-2 w-20 bg-white/[0.08] rounded" />
          <div className="h-4 w-12 bg-white/[0.06] rounded" />
        </div>
        <div className="h-2 w-full bg-white/[0.06] rounded-full" />
      </div>
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/[0.04] rounded-sm p-2.5 border border-white/[0.06] text-center">
            <div className="h-5 w-10 bg-white/[0.08] rounded mx-auto mb-1" />
            <div className="h-2 w-8 bg-white/[0.06] rounded mx-auto" />
          </div>
        ))}
      </div>
      {/* Languages Skeleton */}
      <div>
        <div className="h-2 w-20 bg-white/[0.08] rounded mb-2" />
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 w-14 bg-white/[0.06] rounded-sm" />
          ))}
        </div>
      </div>
      {/* Repos Skeleton */}
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white/[0.04] rounded-sm p-2.5 border border-white/[0.06]">
            <div className="flex justify-between mb-2">
              <div className="h-4 w-24 bg-white/[0.08] rounded" />
              <div className="h-3 w-10 bg-white/[0.06] rounded" />
            </div>
            <div className="h-3 w-full bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TechnicalMomentumPanel() {
  const { selectedPrivateCompany } = useGlobeStore();
  const [data, setData] = useState<TechnicalMomentum | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchGitHub = async (companyName: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/github?company=${encodeURIComponent(companyName)}`
      );
      const result = await response.json();

      if (result.ok && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch GitHub data');
      }
    } catch (err) {
      console.error('[GitHub] Fetch error:', err);
      setError('Failed to fetch GitHub data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPrivateCompany) {
      setData(null);
      return;
    }

    fetchGitHub(selectedPrivateCompany.name);
  }, [selectedPrivateCompany, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!selectedPrivateCompany) {
    return null;
  }

  const companyDisplayName = data?.organization || selectedPrivateCompany.name;

  return (
    <IntelPanel
      title="TECHNICAL MOMENTUM"
      subtitle={companyDisplayName}
      headerRight={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-[9px] font-mono text-white/32 hover:text-[#00FFE0] disabled:opacity-50 transition-colors flex items-center gap-1"
          title="Refresh GitHub data"
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
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="w-8 h-8 mb-2 text-[#FF4444]/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[11px] font-mono text-white/32">{error}</span>
          <button onClick={handleRefresh} className="mt-2 text-[10px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80">
            Try Again
          </button>
        </div>
      ) : !data || !data.found ? (
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="w-8 h-8 mb-2 text-white/16">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[11px] font-mono text-white/32">No GitHub presence found</span>
          <span className="text-[9px] font-mono text-white/16 mt-1">This company may not have public repos</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Activity Score */}
          <div className="bg-black/20 rounded-sm p-3 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
                ACTIVITY SCORE
              </span>
              <span className="text-[14px] font-mono font-medium text-white">
                {data.activityScore}/100
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${data.activityScore}%`,
                  backgroundColor: data.activityScore >= 70 ? '#00FF88' : data.activityScore >= 40 ? '#FFB800' : '#FF4444'
                }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06] text-center">
              <div className="text-[14px] font-mono font-medium text-[#FFB800]">
                ⭐ {formatNumber(data.totalStars)}
              </div>
              <div className="text-[8px] font-mono text-white/32 uppercase">Stars</div>
            </div>
            <div className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06] text-center">
              <div className="text-[14px] font-mono font-medium text-white/80">
                {formatNumber(data.totalForks)}
              </div>
              <div className="text-[8px] font-mono text-white/32 uppercase">Forks</div>
            </div>
            <div className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06] text-center">
              <div className="text-[14px] font-mono font-medium text-white/80">
                {data.repoCount}
              </div>
              <div className="text-[8px] font-mono text-white/32 uppercase">Repos</div>
            </div>
          </div>

          {/* Velocity Stats */}
          {(data.starVelocity > 0 || data.commitVelocity > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {data.starVelocity > 0 && (
                <div className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06]">
                  <div className="text-[9px] font-mono text-white/40 uppercase mb-1">Star Velocity</div>
                  <div className="text-[12px] font-mono text-[#00FF88]">
                    +{formatNumber(data.starVelocity)}/mo
                  </div>
                </div>
              )}
              {data.commitVelocity > 0 && (
                <div className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06]">
                  <div className="text-[9px] font-mono text-white/40 uppercase mb-1">Commit Rate</div>
                  <div className="text-[12px] font-mono text-[#00FFE0]">
                    {data.commitVelocity}/week
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top Languages */}
          {data.topLanguages.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
                TOP LANGUAGES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.topLanguages.map((lang) => (
                  <span
                    key={lang.language}
                    className="text-[9px] font-mono px-2 py-0.5 rounded-sm border border-white/[0.08]"
                    style={{
                      backgroundColor: `${LANGUAGE_COLORS[lang.language] || '#666'}20`,
                      color: LANGUAGE_COLORS[lang.language] || '#999'
                    }}
                  >
                    {lang.language}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Repos */}
          {data.topRepos.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
                TOP REPOSITORIES
              </div>
              <div className="space-y-2">
                {data.topRepos.slice(0, 3).map((repo) => (
                  <a
                    key={repo.fullName}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-black/20 rounded-sm p-2.5 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-medium text-white/80 truncate flex-1 mr-2">
                        {repo.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#FFB800]">
                        ⭐ {formatNumber(repo.stars)}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-[9px] text-white/40 line-clamp-1 mb-1">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[8px] font-mono text-white/24">
                      {repo.language && (
                        <span style={{ color: LANGUAGE_COLORS[repo.language] || '#666' }}>
                          {repo.language}
                        </span>
                      )}
                      <span>Updated {formatTimeAgo(repo.pushedAt)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Last Activity */}
          <div className="pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-white/24">
                Last activity: {formatTimeAgo(data.lastActivity)}
              </span>
              <a
                href={`https://github.com/${data.organization}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-[#00FFE0]/60 hover:text-[#00FFE0]"
              >
                VIEW ON GITHUB →
              </a>
            </div>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
