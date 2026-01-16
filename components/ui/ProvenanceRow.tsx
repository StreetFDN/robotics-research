'use client';

import { useMemo } from 'react';

export type ProvenanceStatus = 'LIVE' | 'DEGRADED' | 'STALE';

interface ProvenanceRowProps {
  sourceLabel: string;
  updatedAt?: Date | number | null;
  status?: ProvenanceStatus;
}

// Premium status colors per Master spec
const STATUS_COLORS: Record<ProvenanceStatus, string> = {
  LIVE: '#00FF88',
  DEGRADED: '#FFB800',
  STALE: '#FF3B3B',
};

function formatRelativeTime(timestamp: Date | number): string {
  const now = Date.now();
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const diffMs = now - ts;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProvenanceRow({
  sourceLabel,
  updatedAt,
  status = 'LIVE',
}: ProvenanceRowProps) {
  const formattedTime = useMemo(() => {
    if (!updatedAt) return null;
    return formatRelativeTime(updatedAt);
  }, [updatedAt]);

  const statusColor = STATUS_COLORS[status];

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-t border-white/[0.06] bg-black/20">
      <span className="text-[9px] font-mono uppercase tracking-wider text-white/[0.32]">
        SOURCE: {sourceLabel}
      </span>

      {formattedTime && (
        <>
          <span className="text-white/[0.16]">•</span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-white/[0.32]">
            UPDATED: {formattedTime}
          </span>
        </>
      )}

      <span className="text-white/[0.16]">•</span>
      <div className="flex items-center gap-1.5">
        <span
          className="w-1 h-1 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/[0.32]">
          {status}
        </span>
      </div>
    </div>
  );
}
