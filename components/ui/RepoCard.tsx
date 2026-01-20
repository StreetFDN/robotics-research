'use client';

interface RepoCardProps {
  /** Repository name (short) */
  name: string;
  /** Full name including org (e.g., "org/repo") */
  fullName?: string;
  /** Repository description */
  description?: string;
  /** GitHub URL */
  url: string;
  /** Star count */
  stars: number;
  /** Star delta (gained this week) for trending display */
  starsDelta?: number;
  /** Fork count */
  forks?: number;
  /** Primary language */
  language?: string;
  /** Last push date ISO string */
  pushedAt?: string;
  /** Topics/tags */
  topics?: string[];
  /** Show trend delta badge */
  showTrend?: boolean;
  /** Compact mode (single line) */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

// GitHub language colors
const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3572A5',
  'C++': '#f34b7d',
  C: '#555555',
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CUDA: '#3A4E3A',
  Shell: '#89e051',
  CMake: '#DA3434',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Scala: '#c22d40',
};

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format time ago
 */
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

/**
 * RepoCard - GitHub repository display card
 *
 * Shows repo name, description, stars, language, and last activity.
 * Used in TechnicalMomentumPanel and TrendingRepos.
 */
export default function RepoCard({
  name,
  description,
  url,
  stars,
  starsDelta,
  forks,
  language,
  pushedAt,
  topics,
  showTrend = false,
  compact = false,
  className = '',
}: RepoCardProps) {
  // Compact mode: single-line display
  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          flex items-center gap-3 px-2 py-1.5
          hover:bg-white/[0.02] rounded-sm transition-colors group
          ${className}
        `}
      >
        {language && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: LANGUAGE_COLORS[language] || '#666' }}
          />
        )}
        <span className="text-[10px] font-mono text-white/72 truncate flex-1 group-hover:text-white transition-colors">
          {name}
        </span>
        <span className="text-[9px] font-mono text-[#FFB800] flex-shrink-0">
          ⭐ {formatNumber(stars)}
        </span>
        {showTrend && starsDelta !== undefined && starsDelta > 0 && (
          <span className="text-[8px] font-mono text-[#00FF88] flex-shrink-0">
            +{formatNumber(starsDelta)}
          </span>
        )}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        block bg-black/20 rounded-sm p-2.5
        border border-white/[0.06] hover:border-white/[0.12]
        transition-colors group ${className}
      `}
    >
      {/* Header: name + stars */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono font-medium text-white/80 truncate flex-1 mr-2 group-hover:text-white transition-colors">
          {name}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-[#FFB800]">
            ⭐ {formatNumber(stars)}
          </span>
          {showTrend && starsDelta !== undefined && starsDelta > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#00FF88]/10 text-[#00FF88] rounded-sm">
              +{formatNumber(starsDelta)}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-[9px] text-white/40 line-clamp-2 mb-1.5">
          {description}
        </p>
      )}

      {/* Topics */}
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="text-[8px] font-mono px-1.5 py-0.5 bg-white/[0.04] text-white/40 rounded-sm"
            >
              {topic}
            </span>
          ))}
          {topics.length > 3 && (
            <span className="text-[8px] font-mono text-white/24">
              +{topics.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: language, forks, updated */}
      <div className="flex items-center gap-2 text-[8px] font-mono text-white/24">
        {language && (
          <span
            className="flex items-center gap-1"
            style={{ color: LANGUAGE_COLORS[language] || '#666' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: LANGUAGE_COLORS[language] || '#666' }}
            />
            {language}
          </span>
        )}
        {forks !== undefined && forks > 0 && (
          <span className="text-white/24">
            {formatNumber(forks)} forks
          </span>
        )}
        {pushedAt && (
          <span className="text-white/24">
            Updated {formatTimeAgo(pushedAt)}
          </span>
        )}
      </div>
    </a>
  );
}

/**
 * RepoCardSkeleton - Loading state
 */
export function RepoCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        bg-black/20 rounded-sm p-2.5 border border-white/[0.06]
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-3 w-12 bg-white/[0.04] rounded animate-pulse" />
      </div>
      <div className="h-2 bg-white/[0.04] rounded animate-pulse w-full mb-1" />
      <div className="flex gap-2">
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-2 w-16 bg-white/[0.04] rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * RepoCardList - List of repo cards
 */
export function RepoCardList({
  repos,
  limit,
  loading = false,
  emptyMessage = 'No repositories found',
  showTrend = false,
  compact = false,
  className = '',
}: {
  repos: Array<{
    name: string;
    fullName?: string;
    description?: string;
    url: string;
    stars: number;
    starsDelta?: number;
    forks?: number;
    language?: string;
    pushedAt?: string;
    topics?: string[];
  }>;
  limit?: number;
  loading?: boolean;
  emptyMessage?: string;
  showTrend?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <RepoCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
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

  const displayRepos = limit ? repos.slice(0, limit) : repos;
  const gapClass = compact ? 'space-y-0' : 'space-y-2';

  return (
    <div className={`${gapClass} ${className}`}>
      {displayRepos.map((repo) => (
        <RepoCard
          key={repo.fullName || repo.name}
          name={repo.name}
          fullName={repo.fullName}
          description={repo.description}
          url={repo.url}
          stars={repo.stars}
          starsDelta={repo.starsDelta}
          forks={repo.forks}
          language={repo.language}
          pushedAt={repo.pushedAt}
          topics={repo.topics}
          showTrend={showTrend}
          compact={compact}
        />
      ))}
    </div>
  );
}

/**
 * LanguageBadge - Programming language pill
 */
export function LanguageBadge({
  language,
  count,
  className = '',
}: {
  language: string;
  count?: number;
  className?: string;
}) {
  const color = LANGUAGE_COLORS[language] || '#666';

  return (
    <span
      className={`
        text-[9px] font-mono px-2 py-0.5 rounded-sm
        border border-white/[0.08] ${className}
      `}
      style={{
        backgroundColor: `${color}20`,
        color,
      }}
    >
      {language}
      {count !== undefined && <span className="opacity-60 ml-1">({count})</span>}
    </span>
  );
}

/**
 * LanguageBadgeList - List of language badges
 */
export function LanguageBadgeList({
  languages,
  className = '',
}: {
  languages: Array<{ language: string; count?: number }>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {languages.map((lang) => (
        <LanguageBadge
          key={lang.language}
          language={lang.language}
          count={lang.count}
        />
      ))}
    </div>
  );
}
