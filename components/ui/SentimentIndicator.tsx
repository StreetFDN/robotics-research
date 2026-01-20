'use client';

import { useMemo } from 'react';

type SentimentLabel = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface SentimentIndicatorProps {
  /** Sentiment score from -1 (bearish) to 1 (bullish) */
  sentiment: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show text label */
  showLabel?: boolean;
  /** Visual style variant */
  variant?: 'bar' | 'gauge' | 'dot';
  /** Optional className */
  className?: string;
}

// Color palette per Palantir/CIA aesthetic
const SENTIMENT_COLORS = {
  positive: '#00FF88',
  negative: '#FF3B3B',
  neutral: '#666666',
};

// Thresholds for sentiment classification
const SENTIMENT_THRESHOLDS = {
  bullish: 0.3,
  bearish: -0.3,
};

/**
 * Get sentiment label from numeric score
 */
function getSentimentLabel(sentiment: number): SentimentLabel {
  if (sentiment > SENTIMENT_THRESHOLDS.bullish) return 'BULLISH';
  if (sentiment < SENTIMENT_THRESHOLDS.bearish) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Get color for sentiment score
 */
function getSentimentColor(sentiment: number): string {
  if (sentiment > SENTIMENT_THRESHOLDS.bullish) return SENTIMENT_COLORS.positive;
  if (sentiment < SENTIMENT_THRESHOLDS.bearish) return SENTIMENT_COLORS.negative;
  return SENTIMENT_COLORS.neutral;
}

/**
 * SentimentIndicator - Visual sentiment display
 *
 * Shows market/news sentiment as a colored indicator with label.
 * Used in EarlyWarningPanel and news-related visualizations.
 */
export default function SentimentIndicator({
  sentiment,
  size = 'md',
  showLabel = true,
  variant = 'bar',
  className = '',
}: SentimentIndicatorProps) {
  const label = useMemo(() => getSentimentLabel(sentiment), [sentiment]);
  const color = useMemo(() => getSentimentColor(sentiment), [sentiment]);

  // Clamp sentiment to valid range
  const clampedSentiment = Math.max(-1, Math.min(1, sentiment));

  // Size configurations
  const sizeStyles = {
    sm: {
      bar: { width: 48, height: 4 },
      gauge: { size: 32 },
      dot: { size: 6 },
      text: 'text-[8px]',
      gap: 'gap-1.5',
    },
    md: {
      bar: { width: 64, height: 6 },
      gauge: { size: 48 },
      dot: { size: 8 },
      text: 'text-[9px]',
      gap: 'gap-2',
    },
    lg: {
      bar: { width: 80, height: 8 },
      gauge: { size: 64 },
      dot: { size: 10 },
      text: 'text-[10px]',
      gap: 'gap-2.5',
    },
  };

  const styles = sizeStyles[size];

  // Render variants
  if (variant === 'dot') {
    return (
      <div className={`inline-flex items-center ${styles.gap} ${className}`}>
        <span
          className="rounded-full"
          style={{
            width: styles.dot.size,
            height: styles.dot.size,
            backgroundColor: color,
            boxShadow: `0 0 ${styles.dot.size}px ${color}40`,
          }}
        />
        {showLabel && (
          <span
            className={`${styles.text} font-mono uppercase tracking-wider`}
            style={{ color }}
          >
            {label}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'gauge') {
    // Circular gauge showing sentiment position
    const gaugeSize = styles.gauge.size;
    const strokeWidth = gaugeSize * 0.1;
    const radius = (gaugeSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Map sentiment (-1 to 1) to arc position (0 to 1)
    const normalizedSentiment = (clampedSentiment + 1) / 2;

    return (
      <div className={`inline-flex flex-col items-center ${styles.gap} ${className}`}>
        <svg
          width={gaugeSize}
          height={gaugeSize / 2 + strokeWidth}
          viewBox={`0 0 ${gaugeSize} ${gaugeSize / 2 + strokeWidth}`}
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2} ${gaugeSize / 2} A ${radius} ${radius} 0 0 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize / 2}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Gradient segments */}
          <defs>
            <linearGradient id="sentiment-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={SENTIMENT_COLORS.negative} />
              <stop offset="50%" stopColor={SENTIMENT_COLORS.neutral} />
              <stop offset="100%" stopColor={SENTIMENT_COLORS.positive} />
            </linearGradient>
          </defs>

          {/* Value indicator dot */}
          {(() => {
            const angle = Math.PI * (1 - normalizedSentiment);
            const x = gaugeSize / 2 + radius * Math.cos(angle);
            const y = gaugeSize / 2 - radius * Math.sin(angle);
            return (
              <circle
                cx={x}
                cy={y}
                r={strokeWidth * 0.8}
                fill={color}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
            );
          })()}
        </svg>

        {showLabel && (
          <span
            className={`${styles.text} font-mono uppercase tracking-wider`}
            style={{ color }}
          >
            {label}
          </span>
        )}
      </div>
    );
  }

  // Default: bar variant
  // Horizontal bar with center neutral point
  const barWidth = styles.bar.width;
  const barHeight = styles.bar.height;
  const fillWidth = Math.abs(clampedSentiment) * (barWidth / 2);
  const isPositive = clampedSentiment >= 0;

  return (
    <div className={`inline-flex items-center ${styles.gap} ${className}`}>
      {/* Sentiment bar */}
      <div
        className="relative rounded-full bg-white/[0.08] overflow-hidden"
        style={{ width: barWidth, height: barHeight }}
      >
        {/* Center marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: '50%' }}
        />

        {/* Fill bar */}
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
          style={{
            width: fillWidth,
            left: isPositive ? '50%' : `calc(50% - ${fillWidth}px)`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>

      {showLabel && (
        <span
          className={`${styles.text} font-mono uppercase tracking-wider min-w-[52px]`}
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * SentimentDot - Minimal dot-only indicator
 */
export function SentimentDot({
  sentiment,
  size = 6,
  className = '',
}: {
  sentiment: number;
  size?: number;
  className?: string;
}) {
  const color = getSentimentColor(sentiment);

  return (
    <span
      className={`inline-block rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      title={getSentimentLabel(sentiment)}
    />
  );
}

/**
 * SentimentBadge - Compact badge with score
 */
export function SentimentBadge({
  sentiment,
  showScore = false,
  className = '',
}: {
  sentiment: number;
  showScore?: boolean;
  className?: string;
}) {
  const label = getSentimentLabel(sentiment);
  const color = getSentimentColor(sentiment);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm
                  border font-mono text-[9px] uppercase tracking-wider ${className}`}
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
        color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
      {showScore && (
        <span className="opacity-60">
          ({sentiment > 0 ? '+' : ''}{(sentiment * 100).toFixed(0)}%)
        </span>
      )}
    </span>
  );
}
