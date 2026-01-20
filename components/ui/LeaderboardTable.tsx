'use client';

import { useState, useMemo, ReactNode } from 'react';

export interface LeaderboardColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

interface LeaderboardTableProps<T extends { id?: string; name?: string }> {
  /** Data rows */
  data: T[];
  /** Column definitions */
  columns: LeaderboardColumn<T>[];
  /** Enable sorting */
  sortable?: boolean;
  /** Current sort key */
  sortKey?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Sort change handler */
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Show rank badges for top 3 */
  showRankBadges?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Empty message */
  emptyMessage?: string;
  /** Optional className */
  className?: string;
}

// Rank badge colors
const RANK_COLORS = {
  1: { bg: '#FFD700', text: '#000' }, // Gold
  2: { bg: '#C0C0C0', text: '#000' }, // Silver
  3: { bg: '#CD7F32', text: '#fff' }, // Bronze
};

/**
 * RankBadge - Colored rank indicator
 */
function RankBadge({ rank }: { rank: number }) {
  const colors = RANK_COLORS[rank as keyof typeof RANK_COLORS];

  if (colors) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-mono font-bold"
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-mono text-white/32">
      {rank}
    </span>
  );
}

/**
 * SortIcon - Sort direction indicator
 */
function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 ${active ? 'text-[#00FFE0]' : 'text-white/16'}`}>
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

/**
 * LeaderboardTable - Sortable ranked table for leaderboards
 *
 * Features rank badges, sortable columns, and hover states.
 * Used for GitHubLeaderboard and other ranked lists.
 */
export default function LeaderboardTable<T extends { id?: string; name?: string }>({
  data,
  columns,
  sortable = true,
  sortKey,
  sortDirection = 'desc',
  onSort,
  onRowClick,
  showRankBadges = true,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
}: LeaderboardTableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState(sortKey);
  const [internalSortDir, setInternalSortDir] = useState(sortDirection);

  const activeSortKey = sortKey ?? internalSortKey;
  const activeSortDir = sortDirection ?? internalSortDir;

  // Sort data if no external handler
  const sortedData = useMemo(() => {
    if (onSort || !activeSortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[activeSortKey];
      const bVal = (b as Record<string, unknown>)[activeSortKey];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return activeSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return activeSortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, activeSortKey, activeSortDir, onSort]);

  const handleSort = (key: string) => {
    if (!sortable) return;

    const newDir = activeSortKey === key && activeSortDir === 'desc' ? 'asc' : 'desc';

    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSortKey(key);
      setInternalSortDir(newDir);
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-white/[0.02] rounded-sm animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={`
          px-4 py-8 text-center border border-dashed border-white/[0.08] rounded-sm
          ${className}
        `}
      >
        <span className="text-[10px] font-mono text-white/32">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        {/* Header */}
        <thead>
          <tr className="border-b border-white/[0.06]">
            {showRankBadges && (
              <th className="py-2 px-2 text-left w-10">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/32">
                  #
                </span>
              </th>
            )}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`
                  py-2 px-2 text-${col.align || 'left'}
                  ${sortable && col.sortable !== false ? 'cursor-pointer hover:bg-white/[0.02]' : ''}
                `}
                style={{ width: col.width }}
                onClick={() => col.sortable !== false && handleSort(String(col.key))}
              >
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">
                  {col.label}
                  {sortable && col.sortable !== false && (
                    <SortIcon
                      active={activeSortKey === String(col.key)}
                      direction={activeSortKey === String(col.key) ? activeSortDir : 'desc'}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={row.id || row.name || index}
              className={`
                border-b border-white/[0.04] transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'}
              `}
              onClick={() => onRowClick?.(row, index)}
            >
              {showRankBadges && (
                <td className="py-2.5 px-2">
                  <RankBadge rank={index + 1} />
                </td>
              )}
              {columns.map((col) => {
                const value = (row as Record<string, unknown>)[String(col.key)];
                return (
                  <td
                    key={String(col.key)}
                    className={`py-2.5 px-2 text-${col.align || 'left'}`}
                  >
                    {col.render ? (
                      col.render(value, row, index)
                    ) : (
                      <span className="text-[11px] font-mono text-white/72">
                        {String(value ?? '')}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * LeaderboardSkeleton - Loading placeholder
 */
export function LeaderboardSkeleton({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* Header skeleton */}
      <div className="flex gap-4 py-2 border-b border-white/[0.06]">
        {[...Array(columns)].map((_, i) => (
          <div
            key={i}
            className="h-3 bg-white/[0.04] rounded animate-pulse"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>
      {/* Row skeletons */}
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className="flex gap-4 py-3 border-b border-white/[0.04]"
        >
          {[...Array(columns)].map((_, j) => (
            <div
              key={j}
              className="h-4 bg-white/[0.02] rounded animate-pulse"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * TrendArrow - Up/down/stable indicator
 */
export function TrendArrow({
  trend,
  size = 'sm',
}: {
  trend: 'up' | 'down' | 'stable';
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'text-[10px]' : 'text-[12px]';

  if (trend === 'up') {
    return <span className={`${sizeClass} text-[#00FF88]`}>▲</span>;
  }
  if (trend === 'down') {
    return <span className={`${sizeClass} text-[#FF3B3B]`}>▼</span>;
  }
  return <span className={`${sizeClass} text-white/24`}>―</span>;
}
