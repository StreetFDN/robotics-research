'use client';

import { SentimentDot } from './SentimentIndicator';

interface HeadlineCardProps {
  /** Article headline text */
  title: string;
  /** News source name */
  source: string;
  /** Relative time string (e.g., "2h ago") */
  timeAgo: string;
  /** Sentiment score -1 to 1 */
  sentiment: number;
  /** Optional article URL */
  url?: string;
  /** Optional className */
  className?: string;
}

/**
 * External link icon
 */
const ExternalLinkIcon = () => (
  <svg
    className="w-3 h-3"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

/**
 * HeadlineCard - Compact news headline display
 *
 * Shows a single headline with source, time, and sentiment indicator.
 * Used in EarlyWarningPanel for recent news coverage.
 */
export default function HeadlineCard({
  title,
  source,
  timeAgo,
  sentiment,
  url,
  className = '',
}: HeadlineCardProps) {
  const CardWrapper = url ? 'a' : 'div';
  const cardProps = url
    ? {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  return (
    <CardWrapper
      {...cardProps}
      className={`
        group block px-3 py-2.5
        bg-white/[0.02] hover:bg-white/[0.04]
        border border-white/[0.06] hover:border-white/[0.10]
        rounded-sm transition-all duration-150
        ${url ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      <div className="flex items-start gap-2.5">
        {/* Sentiment dot */}
        <div className="flex-shrink-0 pt-1">
          <SentimentDot sentiment={sentiment} size={6} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title - 2 line clamp */}
          <h4
            className="text-[11px] font-medium text-white/72 leading-tight
                       line-clamp-2 group-hover:text-white/90 transition-colors"
          >
            {title}
          </h4>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5">
            {/* Source badge */}
            <span
              className="text-[9px] font-mono uppercase tracking-wider
                         px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06]
                         rounded-sm text-white/40"
            >
              {source}
            </span>

            {/* Separator */}
            <span className="text-white/16">•</span>

            {/* Time ago */}
            <span className="text-[9px] font-mono text-white/32">
              {timeAgo}
            </span>

            {/* External link icon (shows on hover if URL exists) */}
            {url && (
              <span
                className="ml-auto text-white/0 group-hover:text-white/32
                           transition-colors"
              >
                <ExternalLinkIcon />
              </span>
            )}
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}

/**
 * HeadlineCardSkeleton - Loading state placeholder
 */
export function HeadlineCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-sm
        ${className}
      `}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08] animate-pulse mt-1" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-3 bg-white/[0.04] rounded animate-pulse w-3/4" />
          <div className="flex gap-2 mt-1.5">
            <div className="h-4 w-16 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-4 w-12 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * HeadlineCardList - Vertical list of headline cards
 */
export function HeadlineCardList({
  headlines,
  loading = false,
  emptyMessage = 'No recent headlines',
  className = '',
}: {
  headlines: Array<{
    title: string;
    source: string;
    timeAgo: string;
    sentiment: number;
    url?: string;
  }>;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <HeadlineCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (headlines.length === 0) {
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

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {headlines.map((headline, index) => (
        <HeadlineCard
          key={`${headline.source}-${index}`}
          title={headline.title}
          source={headline.source}
          timeAgo={headline.timeAgo}
          sentiment={headline.sentiment}
          url={headline.url}
        />
      ))}
    </div>
  );
}

/**
 * HeadlineCardCompact - Even more compact single-line variant
 */
export function HeadlineCardCompact({
  title,
  source,
  sentiment,
  url,
  className = '',
}: {
  title: string;
  source: string;
  sentiment: number;
  url?: string;
  className?: string;
}) {
  const CardWrapper = url ? 'a' : 'div';
  const cardProps = url
    ? {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {};

  return (
    <CardWrapper
      {...cardProps}
      className={`
        group flex items-center gap-2 px-2 py-1.5
        hover:bg-white/[0.02] rounded-sm transition-colors
        ${url ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      <SentimentDot sentiment={sentiment} size={4} />
      <span
        className="flex-1 text-[10px] text-white/56 truncate
                   group-hover:text-white/72 transition-colors"
      >
        {title}
      </span>
      <span className="text-[8px] font-mono uppercase text-white/24 flex-shrink-0">
        {source}
      </span>
    </CardWrapper>
  );
}
