'use client';

import { useState, useEffect } from 'react';
import IntelPanel, { IntelPanelEmpty, IntelPanelError } from './ui/IntelPanel';

interface ReleaseInfo {
  org: string;
  repo: string;
  version: string;
  name: string;
  date: string;
  notes: string;
  url: string;
  isMajor: boolean;
}

interface ReleasesResponse {
  ok: boolean;
  data?: { releases: ReleaseInfo[] };
  error?: string;
}

/**
 * Shimmer skeleton for loading state
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-sm border border-white/[0.04]">
          <div className="w-12 h-5 bg-white/[0.08] rounded" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-white/[0.08] rounded mb-2" />
            <div className="h-3 w-full bg-white/[0.06] rounded mb-1" />
            <div className="h-3 w-20 bg-white/[0.06] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Version badge with color based on semver type
 */
function VersionBadge({ version, isMajor }: { version: string; isMajor: boolean }) {
  // Determine version type
  const isMinor = /^v?\d+\.\d+\.0$/.test(version) || /^v?\d+\.[1-9]\d*\.0$/.test(version);

  let color = 'bg-white/[0.06] text-white/48 border-white/[0.08]'; // patch
  if (isMajor) {
    color = 'bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20'; // major
  } else if (isMinor) {
    color = 'bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/20'; // minor
  }

  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border ${color}`}>
      {version}
    </span>
  );
}

/**
 * Format date as relative time
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * ReleaseRadar - Sprint 5
 * Timeline of recent releases from tracked orgs
 */
export default function ReleaseRadar() {
  const [data, setData] = useState<ReleaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchReleases = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/github/releases');
        const result: ReleasesResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch releases');
        }

        setData(result.data.releases);
      } catch (err: any) {
        console.error('[ReleaseRadar] Fetch error:', err);
        setError(err.message || 'Failed to load releases');
      } finally {
        setLoading(false);
      }
    };

    fetchReleases();
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <IntelPanel
      title="RELEASE RADAR"
      subtitle="Latest SDK & Library Updates"
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
        <IntelPanelEmpty message="No recent releases found" minHeight="150px" />
      ) : (
        <div className="space-y-4">
          {/* Release Timeline */}
          <div className="space-y-2">
            {data.slice(0, 8).map((release) => {
              const releaseId = `${release.org}/${release.repo}/${release.version}`;
              const isExpanded = expandedId === releaseId;

              return (
                <div
                  key={releaseId}
                  className="bg-white/[0.02] rounded-sm border border-white/[0.04] overflow-hidden"
                >
                  {/* Header */}
                  <button
                    onClick={() => toggleExpanded(releaseId)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    {/* Version Badge */}
                    <VersionBadge version={release.version} isMajor={release.isMajor} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-medium text-white truncate">
                          {release.repo}
                        </span>
                        <span className="text-[9px] font-mono text-white/24">
                          by {release.org}
                        </span>
                      </div>
                      {release.name && (
                        <div className="text-[10px] text-white/48 truncate mt-0.5">
                          {release.name}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <span className="text-[9px] font-mono text-white/32 flex-shrink-0">
                      {formatDate(release.date)}
                    </span>

                    {/* Expand Arrow */}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className={`text-white/24 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path
                        d="M3 1.5L7 5L3 8.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </button>

                  {/* Expanded Notes */}
                  {isExpanded && release.notes && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                      <div className="text-[9px] font-mono text-white/24 uppercase mb-1">
                        CHANGELOG
                      </div>
                      <p className="text-[10px] text-white/48 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {release.notes.slice(0, 500)}
                        {release.notes.length > 500 && '...'}
                      </p>
                      <a
                        href={release.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-[9px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80"
                      >
                        VIEW ON GITHUB →
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] font-mono text-white/24">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#FF4444]" />
              <span>Major</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#FFB800]" />
              <span>Minor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-white/32" />
              <span>Patch</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/24 flex justify-between">
            <span>Source: GitHub Releases API</span>
            <span>Last 30 days</span>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
