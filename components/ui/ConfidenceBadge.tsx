'use client';

import { useMemo, useState } from 'react';
import { CONFIDENCE_COLORS, ConfidenceLevel } from '@/types/confidence';
import { getConfidenceLevel, formatConfidence } from '@/utils/confidence';

interface ConfidenceBadgeProps {
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Badge size variant */
  size?: 'sm' | 'md';
  /** Optional custom className */
  className?: string;
}

// Tooltip copy per spec (A6 integration point)
const CONFIDENCE_TOOLTIPS: Record<ConfidenceLevel, string> = {
  high: 'High confidence — data is complete and recent',
  medium: 'Moderate confidence — some data may be incomplete',
  low: 'Low confidence — significant data gaps',
};

/**
 * ConfidenceBadge - Visual indicator of data reliability
 *
 * Displays a horizontal bar showing confidence level with percentage.
 * Colors follow Palantir/CIA aesthetic: green (high), amber (medium), red (low).
 */
export default function ConfidenceBadge({
  confidence,
  size = 'md',
  className = '',
}: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const level = useMemo(() => getConfidenceLevel(confidence), [confidence]);
  const percentage = useMemo(() => formatConfidence(confidence), [confidence]);
  const color = CONFIDENCE_COLORS[level];

  // Clamp confidence for bar width
  const barWidth = Math.max(0, Math.min(1, confidence)) * 100;

  // Size-based styling
  const sizeStyles = {
    sm: {
      container: 'gap-1.5',
      bar: 'w-12 h-1',
      text: 'text-[8px]',
    },
    md: {
      container: 'gap-2',
      bar: 'w-16 h-1.5',
      text: 'text-[9px]',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div
      className={`relative inline-flex items-center ${styles.container} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Confidence bar */}
      <div
        className={`${styles.bar} rounded-full bg-white/[0.08] overflow-hidden`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${barWidth}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Percentage label */}
      <span
        className={`${styles.text} font-mono tabular-nums text-white/48`}
        style={{ color }}
      >
        {percentage}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
                     bg-black/90 backdrop-blur-sm border border-white/[0.08] rounded-sm
                     whitespace-nowrap z-50 pointer-events-none"
        >
          <span className="text-[9px] font-mono text-white/64">
            {CONFIDENCE_TOOLTIPS[level]}
          </span>
          {/* Tooltip arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                       border-l-4 border-r-4 border-t-4
                       border-l-transparent border-r-transparent border-t-black/90"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline confidence indicator for tight spaces
 */
export function ConfidenceIndicator({
  confidence,
  className = '',
}: {
  confidence: number;
  className?: string;
}) {
  const level = getConfidenceLevel(confidence);
  const color = CONFIDENCE_COLORS[level];
  const percentage = formatConfidence(confidence);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={CONFIDENCE_TOOLTIPS[level]}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="text-[9px] font-mono text-white/40"
        style={{ color }}
      >
        {percentage}
      </span>
    </span>
  );
}
