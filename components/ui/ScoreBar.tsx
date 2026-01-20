'use client';

import { useEffect, useState } from 'react';

interface ScoreBarProps {
  /** Score value from 0 to 100 */
  score: number;
  /** Label displayed on the left side */
  label: string;
  /** Optional custom color for the bar fill (defaults to cyan) */
  color?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show score value on right side */
  showScore?: boolean;
  /** Optional className */
  className?: string;
}

// Default color per Palantir/CIA aesthetic
const DEFAULT_COLOR = '#00FFE0';

/**
 * ScoreBar - Horizontal bar visualization for scores/metrics
 *
 * Displays a labeled horizontal bar with animated fill.
 * Used for power factors, similarity scores, and other metrics.
 */
export default function ScoreBar({
  score,
  label,
  color = DEFAULT_COLOR,
  size = 'md',
  showScore = true,
  className = '',
}: ScoreBarProps) {
  // Animate fill on mount
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    // Clamp score to valid range
    const clampedScore = Math.max(0, Math.min(100, score));
    // Small delay for mount animation
    const timer = setTimeout(() => {
      setAnimatedWidth(clampedScore);
    }, 50);
    return () => clearTimeout(timer);
  }, [score]);

  // Size-based styling
  const sizeStyles = {
    sm: {
      bar: 'h-1',
      text: 'text-[9px]',
      gap: 'gap-2',
    },
    md: {
      bar: 'h-2',
      text: 'text-[10px]',
      gap: 'gap-3',
    },
  };

  const styles = sizeStyles[size];

  return (
    <div className={`flex items-center ${styles.gap} ${className}`}>
      {/* Label */}
      <span
        className={`${styles.text} font-mono uppercase tracking-wider text-white/48 min-w-[100px] flex-shrink-0`}
      >
        {label}
      </span>

      {/* Bar container */}
      <div
        className={`flex-1 ${styles.bar} rounded-full bg-white/[0.08] overflow-hidden`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>

      {/* Score value */}
      {showScore && (
        <span
          className={`${styles.text} font-mono tabular-nums text-white/64 min-w-[32px] text-right flex-shrink-0`}
        >
          {Math.round(score)}
        </span>
      )}
    </div>
  );
}

/**
 * ScoreBarCompact - Minimal version without label
 */
export function ScoreBarCompact({
  score,
  color = DEFAULT_COLOR,
  className = '',
}: {
  score: number;
  color?: string;
  className?: string;
}) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(Math.max(0, Math.min(100, score)));
    }, 50);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div
      className={`h-1 rounded-full bg-white/[0.08] overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${animatedWidth}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/**
 * ScoreBarGroup - Vertical stack of score bars
 */
export function ScoreBarGroup({
  items,
  size = 'md',
  className = '',
}: {
  items: Array<{ label: string; score: number; color?: string }>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const gapClass = size === 'sm' ? 'gap-1.5' : 'gap-2';

  return (
    <div className={`flex flex-col ${gapClass} ${className}`}>
      {items.map((item, index) => (
        <ScoreBar
          key={`${item.label}-${index}`}
          label={item.label}
          score={item.score}
          color={item.color}
          size={size}
        />
      ))}
    </div>
  );
}
