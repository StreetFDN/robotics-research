'use client';

export type TraitType = 'shared' | 'unique' | 'difference';

interface TraitBadgeProps {
  /** The trait text to display */
  trait: string;
  /** Type of trait determines color and icon */
  type: TraitType;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional className */
  className?: string;
}

// Color palette per Palantir/CIA aesthetic
const TRAIT_COLORS: Record<TraitType, { bg: string; text: string; border: string }> = {
  shared: {
    bg: 'bg-[#00FFE0]/10',
    text: 'text-[#00FFE0]/80',
    border: 'border-[#00FFE0]/20',
  },
  unique: {
    bg: 'bg-[#FFB800]/10',
    text: 'text-[#FFB800]/80',
    border: 'border-[#FFB800]/20',
  },
  difference: {
    bg: 'bg-white/[0.04]',
    text: 'text-white/48',
    border: 'border-white/[0.08]',
  },
};

// Icons for each type (inline SVG paths)
const TraitIcon = ({ type }: { type: TraitType }) => {
  const iconClass = 'w-3 h-3 flex-shrink-0';

  switch (type) {
    case 'shared':
      // Link/chain icon for shared traits
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      );
    case 'unique':
      // Star icon for unique traits
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      );
    case 'difference':
      // Diverge/split icon for differences
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      );
  }
};

/**
 * TraitBadge - Pill badge for displaying entity traits
 *
 * Used in similarity comparisons to show shared traits,
 * unique characteristics, and key differences.
 */
export default function TraitBadge({
  trait,
  type,
  size = 'md',
  className = '',
}: TraitBadgeProps) {
  const colors = TRAIT_COLORS[type];

  const sizeStyles = {
    sm: {
      padding: 'px-1.5 py-0.5',
      text: 'text-[8px]',
      gap: 'gap-1',
    },
    md: {
      padding: 'px-2 py-1',
      text: 'text-[9px]',
      gap: 'gap-1.5',
    },
  };

  const styles = sizeStyles[size];

  return (
    <span
      className={`
        inline-flex items-center ${styles.gap} ${styles.padding}
        ${colors.bg} ${colors.text} ${colors.border}
        border rounded-sm font-mono uppercase tracking-wider
        ${className}
      `}
    >
      <TraitIcon type={type} />
      <span className={styles.text}>{trait}</span>
    </span>
  );
}

/**
 * TraitBadgeList - Horizontal list of trait badges
 */
export function TraitBadgeList({
  traits,
  type,
  size = 'sm',
  limit,
  className = '',
}: {
  traits: string[];
  type: TraitType;
  size?: 'sm' | 'md';
  limit?: number;
  className?: string;
}) {
  const displayTraits = limit ? traits.slice(0, limit) : traits;
  const overflow = limit && traits.length > limit ? traits.length - limit : 0;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayTraits.map((trait) => (
        <TraitBadge key={trait} trait={trait} type={type} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] font-mono text-white/32 self-center">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

/**
 * TraitComparisonSection - Labeled section with trait badges
 */
export function TraitComparisonSection({
  title,
  traits,
  type,
  className = '',
}: {
  title: string;
  traits: string[];
  type: TraitType;
  className?: string;
}) {
  if (traits.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h4 className="text-[9px] font-mono uppercase tracking-wider text-white/32 mb-2">
        {title}
      </h4>
      <TraitBadgeList traits={traits} type={type} />
    </div>
  );
}
