'use client';

import { useState, useEffect } from 'react';
import IntelPanel, { IntelPanelEmpty, IntelPanelError } from './ui/IntelPanel';

interface ContributorOrg {
  org: string;
  repo: string;
  commits: number;
}

interface ContributorFlow {
  username: string;
  avatarUrl: string;
  contributions: ContributorOrg[];
}

interface ContributorsResponse {
  ok: boolean;
  data?: { flows: ContributorFlow[] };
  error?: string;
}

/**
 * Shimmer skeleton for loading state
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-sm border border-white/[0.04]">
          <div className="w-8 h-8 rounded-full bg-white/[0.08]" />
          <div className="flex-1">
            <div className="h-3 w-24 bg-white/[0.08] rounded mb-2" />
            <div className="flex gap-2">
              <div className="h-3 w-16 bg-white/[0.06] rounded" />
              <div className="h-3 w-4 bg-white/[0.06] rounded" />
              <div className="h-3 w-16 bg-white/[0.06] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Flow arrow between orgs
 */
function FlowArrow() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" className="text-[#00FFE0]/40 flex-shrink-0">
      <path
        d="M0 6h12M9 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * ContributorFlow - Sprint 5
 * Shows contributor movement between organizations
 */
export default function ContributorFlow() {
  const [data, setData] = useState<ContributorFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchContributors = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/github/contributors');
        const result: ContributorsResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch contributor data');
        }

        setData(result.data.flows);
      } catch (err: any) {
        console.error('[ContributorFlow] Fetch error:', err);
        setError(err.message || 'Failed to load contributors');
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Get unique orgs from a contributor's contributions
  const getOrgFlow = (contributions: ContributorOrg[]): string[] => {
    const orgs = [...new Set(contributions.map((c) => c.org))];
    return orgs;
  };

  return (
    <IntelPanel
      title="CONTRIBUTOR FLOW"
      subtitle="Cross-Organization Activity"
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
      ) : data.length === 0 ? (
        <IntelPanelEmpty message="No cross-org contributor data found" minHeight="150px" />
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.02] rounded-sm p-3 border border-white/[0.04]">
              <div className="text-[18px] font-mono font-medium text-[#00FFE0]">
                {data.length}
              </div>
              <div className="text-[9px] font-mono text-white/32 uppercase">
                Cross-Org Contributors
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-sm p-3 border border-white/[0.04]">
              <div className="text-[18px] font-mono font-medium text-white">
                {[...new Set(data.flatMap((d) => d.contributions.map((c) => c.org)))].length}
              </div>
              <div className="text-[9px] font-mono text-white/32 uppercase">
                Organizations
              </div>
            </div>
          </div>

          {/* Contributor List */}
          <div className="space-y-2">
            {data.slice(0, 10).map((contributor) => {
              const orgs = getOrgFlow(contributor.contributions);
              const totalCommits = contributor.contributions.reduce((sum, c) => sum + c.commits, 0);

              return (
                <div
                  key={contributor.username}
                  className="bg-white/[0.02] hover:bg-white/[0.04] rounded-sm p-3 border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                >
                  {/* Contributor Header */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                      {contributor.avatarUrl ? (
                        <img
                          src={contributor.avatarUrl}
                          alt={contributor.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-white/32">
                          {contributor.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://github.com/${contributor.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono font-medium text-white hover:text-[#00FFE0] transition-colors"
                      >
                        @{contributor.username}
                      </a>
                      <div className="text-[9px] font-mono text-white/32">
                        {totalCommits} commits across {orgs.length} orgs
                      </div>
                    </div>
                  </div>

                  {/* Organization Flow */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {orgs.map((org, index) => (
                      <div key={org} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/60 bg-white/[0.04] px-2 py-0.5 rounded-sm">
                          {org}
                        </span>
                        {index < orgs.length - 1 && <FlowArrow />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          {data.length > 0 && (
            <div className="p-3 bg-[#00FFE0]/[0.04] rounded-sm border border-[#00FFE0]/10">
              <div className="text-[10px] font-mono text-[#00FFE0]/80">
                <span className="text-[#00FFE0] font-medium">INSIGHT:</span>{' '}
                {data.length} engineers have contributed to multiple robotics organizations,
                indicating strong talent mobility in the ecosystem.
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/24 flex justify-between">
            <span>Source: GitHub Contributors API</span>
            <span>Cached 24h</span>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
