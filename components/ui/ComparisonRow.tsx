'use client';

export type ComparisonType = 'greater' | 'less' | 'equal';

interface ComparisonRowProps {
  /** Left side value/label */
  left: string;
  /** Right side value/label */
  right: string;
  /** Comparison relationship */
  comparison: ComparisonType;
  /** Optional label for the comparison metric */
  metric?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional className */
  className?: string;
}

// Comparison icons
const ComparisonIcon = ({ comparison }: { comparison: ComparisonType }) => {
  const iconClass = 'w-4 h-4';

  switch (comparison) {
    case 'greater':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      );
    case 'less':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      );
    case 'equal':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9h8M8 15h8"
          />
        </svg>
      );
  }
};

// Colors based on comparison type
const COMPARISON_COLORS: Record<ComparisonType, string> = {
  greater: 'text-[#00FF88]', // Green - left is winning
  less: 'text-[#FF3B3B]',    // Red - left is losing
  equal: 'text-white/32',    // Gray - equal
};

/**
 * ComparisonRow - Side-by-side comparison visualization
 *
 * Shows two values with a directional indicator between them.
 * Used for "Company A > Company B" type comparisons.
 */
export default function ComparisonRow({
  left,
  right,
  comparison,
  metric,
  size = 'md',
  className = '',
}: ComparisonRowProps) {
  const sizeStyles = {
    sm: {
      text: 'text-[9px]',
      padding: 'px-2 py-1.5',
    },
    md: {
      text: 'text-[10px]',
      padding: 'px-3 py-2',
    },
  };

  const styles = sizeStyles[size];
  const iconColor = COMPARISON_COLORS[comparison];

  return (
    <div
      className={`
        flex items-center justify-between ${styles.padding}
        bg-white/[0.02] border border-white/[0.06] rounded-sm
        ${className}
      `}
    >
      {/* Left value */}
      <div className="flex-1 min-w-0">
        <span
          className={`${styles.text} font-mono text-white/72 truncate block`}
        >
          {left}
        </span>
      </div>

      {/* Comparison indicator */}
      <div className={`flex items-center gap-2 px-3 ${iconColor}`}>
        {metric && (
          <span className="text-[8px] font-mono uppercase tracking-wider text-white/24">
            {metric}
          </span>
        )}
        <ComparisonIcon comparison={comparison} />
      </div>

      {/* Right value */}
      <div className="flex-1 min-w-0 text-right">
        <span
          className={`${styles.text} font-mono text-white/72 truncate block`}
        >
          {right}
        </span>
      </div>
    </div>
  );
}

/**
 * ComparisonCard - Richer comparison with scores and labels
 */
export function ComparisonCard({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  metric,
  className = '',
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
  metric: string;
  className?: string;
}) {
  const comparison: ComparisonType =
    leftValue > rightValue ? 'greater' : leftValue < rightValue ? 'less' : 'equal';

  const leftColor = comparison === 'greater' ? 'text-[#00FF88]' : 'text-white/64';
  const rightColor = comparison === 'less' ? 'text-[#00FF88]' : 'text-white/64';

  return (
    <div
      className={`
        bg-white/[0.02] border border-white/[0.06] rounded-sm p-3
        ${className}
      `}
    >
      {/* Metric label */}
      <div className="text-[9px] font-mono uppercase tracking-wider text-white/32 mb-2 text-center">
        {metric}
      </div>

      {/* Comparison row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-mono text-white/48 mb-1 truncate">
            {leftLabel}
          </div>
          <div className={`text-lg font-mono tabular-nums ${leftColor}`}>
            {leftValue}
          </div>
        </div>

        {/* Comparison icon */}
        <div className={`flex-shrink-0 ${COMPARISON_COLORS[comparison]}`}>
          <ComparisonIcon comparison={comparison} />
        </div>

        {/* Right side */}
        <div className="flex-1 text-center">
          <div className="text-[10px] font-mono text-white/48 mb-1 truncate">
            {rightLabel}
          </div>
          <div className={`text-lg font-mono tabular-nums ${rightColor}`}>
            {rightValue}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ComparisonList - Stack of comparison rows
 */
export function ComparisonList({
  comparisons,
  size = 'sm',
  className = '',
}: {
  comparisons: Array<{
    left: string;
    right: string;
    comparison: ComparisonType;
    metric?: string;
  }>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {comparisons.map((item, index) => (
        <ComparisonRow
          key={`${item.left}-${item.right}-${index}`}
          left={item.left}
          right={item.right}
          comparison={item.comparison}
          metric={item.metric}
          size={size}
        />
      ))}
    </div>
  );
}
