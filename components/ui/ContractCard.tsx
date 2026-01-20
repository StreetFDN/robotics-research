'use client';

interface ContractCardProps {
  /** Contract award amount */
  amount: number;
  /** Contract description/title */
  description: string;
  /** Start date ISO string */
  startDate?: string;
  /** Awarding agency name */
  agency?: string;
  /** Optional className */
  className?: string;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * ContractCard - Government contract display card
 *
 * Shows contract amount, description, date, and agency.
 * Used in GovernmentContractsPanel.
 */
export default function ContractCard({
  amount,
  description,
  startDate,
  agency,
  className = '',
}: ContractCardProps) {
  return (
    <div
      className={`
        bg-black/20 rounded-sm p-2.5
        border border-white/[0.06] hover:border-white/[0.12]
        transition-colors ${className}
      `}
    >
      {/* Header: amount + date */}
      <div className="flex items-start justify-between mb-1">
        <span className="text-[11px] font-mono font-medium text-[#00FFE0]">
          {formatCurrency(amount)}
        </span>
        {startDate && (
          <span className="text-[9px] font-mono text-white/32">
            {formatDate(startDate)}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[10px] text-white/60 line-clamp-2 mb-1">
        {description || 'Contract details not available'}
      </p>

      {/* Agency badge */}
      {agency && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-white/40 px-1.5 py-0.5 bg-white/[0.04] rounded-sm">
            {agency}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ContractCardSkeleton - Loading state
 */
export function ContractCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        bg-black/20 rounded-sm p-2.5 border border-white/[0.06]
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
      </div>
      <div className="space-y-1 mb-1">
        <div className="h-2 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-2 bg-white/[0.04] rounded animate-pulse w-3/4" />
      </div>
      <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
    </div>
  );
}

/**
 * ContractCardList - List of contract cards
 */
export function ContractCardList({
  contracts,
  limit,
  loading = false,
  emptyMessage = 'No contracts found',
  onShowMore,
  className = '',
}: {
  contracts: Array<{
    id: string;
    amount: number;
    description: string;
    startDate?: string;
    agency?: string;
  }>;
  limit?: number;
  loading?: boolean;
  emptyMessage?: string;
  onShowMore?: () => void;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <ContractCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (contracts.length === 0) {
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

  const displayContracts = limit ? contracts.slice(0, limit) : contracts;
  const hasMore = limit && contracts.length > limit;

  return (
    <div className={className}>
      <div className="space-y-2">
        {displayContracts.map((contract) => (
          <ContractCard
            key={contract.id}
            amount={contract.amount}
            description={contract.description}
            startDate={contract.startDate}
            agency={contract.agency}
          />
        ))}
      </div>
      {hasMore && onShowMore && (
        <button
          onClick={onShowMore}
          className="mt-2 w-full text-[9px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80 text-center py-1"
        >
          +{contracts.length - (limit || 0)} MORE
        </button>
      )}
    </div>
  );
}

/**
 * ContractSummaryCard - Summary stats card
 */
export function ContractSummaryCard({
  label,
  value,
  subValue,
  trend,
  className = '',
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: { direction: 'up' | 'down'; value: string };
  className?: string;
}) {
  return (
    <div className={`bg-black/20 rounded-sm p-3 border border-white/[0.06] ${className}`}>
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-[18px] font-mono font-medium text-[#00FFE0]">
        {value}
      </div>
      {trend && (
        <div
          className={`text-[10px] font-mono ${
            trend.direction === 'up' ? 'text-[#00FF88]' : 'text-[#FF4444]'
          }`}
        >
          {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
        </div>
      )}
      {subValue && !trend && (
        <div className="text-[10px] font-mono text-white/40">{subValue}</div>
      )}
    </div>
  );
}
