'use client';

import { useState } from 'react';

interface ReleaseInfo {
  /** Organization/owner name */
  org: string;
  /** Repository name */
  repo: string;
  /** Version string (e.g., "v2.1.0") */
  version: string;
  /** Release name/title */
  name?: string;
  /** Release date ISO string */
  date: string;
  /** Release notes/changelog (markdown) */
  notes?: string;
  /** GitHub release URL */
  url: string;
  /** Is this a major release (v1.0, v2.0, etc.) */
  isMajor?: boolean;
  /** Is this a prerelease */
  isPrerelease?: boolean;
}

interface ReleaseCardProps {
  /** Release information */
  release: ReleaseInfo;
  /** Show org/repo header */
  showRepo?: boolean;
  /** Expandable changelog */
  expandable?: boolean;
  /** Initially expanded */
  defaultExpanded?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Parse semver to determine release type
 */
function getReleaseType(version: string): 'major' | 'minor' | 'patch' | 'prerelease' {
  // Remove 'v' prefix
  const v = version.replace(/^v/, '');

  // Check for prerelease indicators
  if (v.includes('-') || v.includes('alpha') || v.includes('beta') || v.includes('rc')) {
    return 'prerelease';
  }

  // Parse semver
  const parts = v.split('.');
  if (parts.length >= 3) {
    const [major, minor, patch] = parts.map((p) => parseInt(p, 10));

    // Check if it's a .0.0 release (major)
    if (minor === 0 && patch === 0 && major > 0) {
      return 'major';
    }

    // Check if it's a .x.0 release (minor)
    if (patch === 0) {
      return 'minor';
    }
  }

  return 'patch';
}

// Release type colors
const RELEASE_COLORS = {
  major: { bg: '#FF3B3B', text: '#fff' },    // Red for major
  minor: { bg: '#FFB800', text: '#000' },    // Yellow for minor
  patch: { bg: '#666666', text: '#fff' },    // Gray for patch
  prerelease: { bg: '#00FFE0', text: '#000' }, // Cyan for prerelease
};

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateStr);
}

/**
 * VersionBadge - Colored version indicator
 */
export function VersionBadge({
  version,
  type,
  size = 'md',
}: {
  version: string;
  type?: 'major' | 'minor' | 'patch' | 'prerelease';
  size?: 'sm' | 'md';
}) {
  const releaseType = type || getReleaseType(version);
  const colors = RELEASE_COLORS[releaseType];

  const sizeStyles = {
    sm: 'text-[8px] px-1.5 py-0.5',
    md: 'text-[9px] px-2 py-0.5',
  };

  return (
    <span
      className={`font-mono font-medium rounded-sm ${sizeStyles[size]}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {version}
    </span>
  );
}

/**
 * ReleaseCard - GitHub release display card
 *
 * Shows release version, date, and expandable changelog.
 * Used in ReleaseRadar panel.
 */
export default function ReleaseCard({
  release,
  showRepo = true,
  expandable = true,
  defaultExpanded = false,
  className = '',
}: ReleaseCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const releaseType = release.isMajor ? 'major' : getReleaseType(release.version);

  const hasNotes = release.notes && release.notes.trim().length > 0;

  return (
    <div
      className={`
        bg-black/20 rounded-sm border border-white/[0.06]
        hover:border-white/[0.10] transition-colors
        ${className}
      `}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            {showRepo && (
              <div className="text-[9px] font-mono text-white/32 mb-0.5">
                {release.org}/{release.repo}
              </div>
            )}
            <div className="flex items-center gap-2">
              <VersionBadge version={release.version} type={releaseType} />
              {release.isPrerelease && (
                <span className="text-[8px] font-mono text-white/32 uppercase">
                  Pre-release
                </span>
              )}
            </div>
          </div>
          <span className="text-[9px] font-mono text-white/32 flex-shrink-0">
            {formatTimeAgo(release.date)}
          </span>
        </div>

        {/* Release name */}
        {release.name && release.name !== release.version && (
          <p className="text-[10px] text-white/56 line-clamp-1">
            {release.name}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {expandable && hasNotes && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[9px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80"
            >
              {expanded ? '− HIDE NOTES' : '+ SHOW NOTES'}
            </button>
          )}
          <a
            href={release.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-mono text-white/32 hover:text-white/48 ml-auto"
          >
            VIEW ON GITHUB →
          </a>
        </div>
      </div>

      {/* Expandable notes */}
      {expanded && hasNotes && (
        <div className="px-3 pb-3 pt-0 border-t border-white/[0.04]">
          <div className="mt-2 text-[9px] font-mono text-white/40 whitespace-pre-wrap line-clamp-6">
            {release.notes}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ReleaseCardSkeleton - Loading state
 */
export function ReleaseCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        bg-black/20 rounded-sm p-3 border border-white/[0.06]
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="space-y-1.5">
          <div className="h-2 w-24 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
      </div>
      <div className="h-2.5 w-full bg-white/[0.04] rounded animate-pulse mt-2" />
    </div>
  );
}

/**
 * ReleaseCardList - List of release cards
 */
export function ReleaseCardList({
  releases,
  limit,
  loading = false,
  showRepo = true,
  emptyMessage = 'No recent releases',
  className = '',
}: {
  releases: ReleaseInfo[];
  limit?: number;
  loading?: boolean;
  showRepo?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <ReleaseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div
        className={`
          px-3 py-6 text-center
          border border-dashed border-white/[0.08] rounded-sm
          ${className}
        `}
      >
        <span className="text-[10px] font-mono text-white/32">
          {emptyMessage}
        </span>
      </div>
    );
  }

  const displayReleases = limit ? releases.slice(0, limit) : releases;

  return (
    <div className={`space-y-2 ${className}`}>
      {displayReleases.map((release) => (
        <ReleaseCard
          key={`${release.org}-${release.repo}-${release.version}`}
          release={release}
          showRepo={showRepo}
        />
      ))}
    </div>
  );
}

/**
 * ReleaseTimeline - Vertical timeline of releases
 */
export function ReleaseTimeline({
  releases,
  className = '',
}: {
  releases: ReleaseInfo[];
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.08]" />

      {/* Release items */}
      <div className="space-y-4">
        {releases.map((release) => {
          const releaseType = release.isMajor ? 'major' : getReleaseType(release.version);
          const dotColor = RELEASE_COLORS[releaseType].bg;

          return (
            <div
              key={`${release.org}-${release.repo}-${release.version}`}
              className="relative pl-8"
            >
              {/* Timeline dot */}
              <div
                className="absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 border-black"
                style={{ backgroundColor: dotColor }}
              />

              {/* Content */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[9px] font-mono text-white/32">
                    {release.org}/{release.repo}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono font-medium text-white/80">
                      {release.version}
                    </span>
                    {release.name && release.name !== release.version && (
                      <span className="text-[9px] text-white/40 truncate max-w-[150px]">
                        {release.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[8px] font-mono text-white/24 flex-shrink-0">
                  {formatTimeAgo(release.date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
