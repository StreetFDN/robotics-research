'use client';

import { useState, useEffect } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import IntelPanel, { IntelPanelEmpty } from './ui/IntelPanel';

interface Contract {
  id: string;
  awardId: string;
  recipientName: string;
  awardAmount: number;
  description: string;
  startDate: string;
  agency: string;
  subAgency: string;
}

interface ContractSummary {
  totalAwarded: number;
  contractCount: number;
  activeContracts: number;
  topAgency: string;
  topAgencyPercent: number;
  yearOverYearChange: number;
  contracts: Contract[];
  agencyBreakdown: Array<{ agency: string; amount: number; count: number }>;
  yearlyTrend: Array<{ year: number; amount: number; count: number }>;
}

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

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Shimmer skeleton loading component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Summary Stats Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.04] rounded-sm p-3 border border-white/[0.06]">
          <div className="h-2 w-16 bg-white/[0.08] rounded mb-2" />
          <div className="h-6 w-20 bg-white/[0.06] rounded" />
        </div>
        <div className="bg-white/[0.04] rounded-sm p-3 border border-white/[0.06]">
          <div className="h-2 w-20 bg-white/[0.08] rounded mb-2" />
          <div className="h-6 w-12 bg-white/[0.06] rounded" />
        </div>
      </div>
      {/* Agency Skeleton */}
      <div className="bg-white/[0.04] rounded-sm p-3 border border-white/[0.06]">
        <div className="h-2 w-16 bg-white/[0.08] rounded mb-2" />
        <div className="h-4 w-32 bg-white/[0.06] rounded mb-2" />
        <div className="h-1.5 w-full bg-white/[0.06] rounded-full" />
      </div>
      {/* Contracts Skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/[0.04] rounded-sm p-2.5 border border-white/[0.06]">
            <div className="flex justify-between mb-2">
              <div className="h-4 w-16 bg-white/[0.08] rounded" />
              <div className="h-3 w-12 bg-white/[0.06] rounded" />
            </div>
            <div className="h-3 w-full bg-white/[0.06] rounded mb-1" />
            <div className="h-3 w-2/3 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GovernmentContractsPanel() {
  const { selectedPrivateCompany } = useGlobeStore();
  const [data, setData] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchContracts = async (companyName: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts?company=${encodeURIComponent(companyName)}`
      );
      const result = await response.json();

      if (result.ok && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch contracts');
      }
    } catch (err) {
      console.error('[Contracts] Fetch error:', err);
      setError('Failed to fetch contract data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPrivateCompany) {
      setData(null);
      return;
    }

    fetchContracts(selectedPrivateCompany.name);
  }, [selectedPrivateCompany, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!selectedPrivateCompany) {
    return null;
  }

  const companyDisplayName = selectedPrivateCompany?.name || '';

  return (
    <IntelPanel
      title="GOVERNMENT CONTRACTS"
      subtitle={companyDisplayName}
      headerRight={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-[9px] font-mono text-white/32 hover:text-[#00FFE0] disabled:opacity-50 transition-colors flex items-center gap-1"
          title="Refresh contract data"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 2V5L11 3.5 8 2Z" fill="currentColor" />
          </svg>
        </button>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="w-8 h-8 mb-2 text-[#FF4444]/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[11px] font-mono text-white/32">{error}</span>
          <button onClick={handleRefresh} className="mt-2 text-[10px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80">
            Try Again
          </button>
        </div>
      ) : !data || data.contractCount === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="w-8 h-8 mb-2 text-white/16">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 10h18M8 15h2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[11px] font-mono text-white/32">No government contracts found</span>
          <span className="text-[9px] font-mono text-white/16 mt-1">This company may not have federal awards</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/20 rounded-sm p-3 border border-white/[0.06]">
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1">
                TOTAL AWARDED
              </div>
              <div className="text-[18px] font-mono font-medium text-[#00FFE0]">
                {formatCurrency(data.totalAwarded)}
              </div>
              {data.yearOverYearChange !== 0 && (
                <div className={`text-[10px] font-mono ${data.yearOverYearChange > 0 ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>
                  {data.yearOverYearChange > 0 ? '▲' : '▼'} {Math.abs(data.yearOverYearChange)}% YoY
                </div>
              )}
            </div>
            <div className="bg-black/20 rounded-sm p-3 border border-white/[0.06]">
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1">
                ACTIVE CONTRACTS
              </div>
              <div className="text-[18px] font-mono font-medium text-white">
                {data.activeContracts}
              </div>
              <div className="text-[10px] font-mono text-white/40">
                of {data.contractCount} total
              </div>
            </div>
          </div>

          {/* Top Agency */}
          <div className="bg-black/20 rounded-sm p-3 border border-white/[0.06]">
            <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
              TOP AGENCY
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono text-white/80 truncate flex-1 mr-2">
                {data.topAgency}
              </span>
              <span className="text-[11px] font-mono text-[#00FFE0]">
                {data.topAgencyPercent}%
              </span>
            </div>
            {/* Agency breakdown bar */}
            <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex">
              {data.agencyBreakdown.slice(0, 4).map((agency, i) => (
                <div
                  key={agency.agency}
                  className="h-full"
                  style={{
                    width: `${(agency.amount / data.totalAwarded) * 100}%`,
                    backgroundColor: i === 0 ? '#00FFE0' : i === 1 ? '#00FF88' : i === 2 ? '#FFB800' : '#666'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Recent Contracts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
                RECENT AWARDS
              </span>
              {data.contracts.length > 3 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[9px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80"
                >
                  {expanded ? 'SHOW LESS' : `+${data.contracts.length - 3} MORE`}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(expanded ? data.contracts : data.contracts.slice(0, 3)).map((contract) => (
                <div
                  key={contract.id}
                  className="bg-black/20 rounded-sm p-2.5 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[11px] font-mono font-medium text-[#00FFE0]">
                      {formatCurrency(contract.awardAmount)}
                    </span>
                    <span className="text-[9px] font-mono text-white/32">
                      {formatDate(contract.startDate)}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 line-clamp-2 mb-1">
                    {contract.description || 'Contract details not available'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-white/40 px-1.5 py-0.5 bg-white/[0.04] rounded-sm">
                      {contract.agency || contract.subAgency || 'Federal'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yearly Trend (if we have data) */}
          {data.yearlyTrend.length > 2 && (
            <div>
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-2">
                YEARLY TREND
              </div>
              <div className="flex items-end gap-1 h-12">
                {data.yearlyTrend.map((year) => {
                  const maxAmount = Math.max(...data.yearlyTrend.map(y => y.amount));
                  const height = maxAmount > 0 ? (year.amount / maxAmount) * 100 : 0;
                  return (
                    <div key={year.year} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-[#00FFE0]/60 rounded-t-sm transition-all"
                        style={{ height: `${height}%`, minHeight: year.amount > 0 ? '4px' : '0' }}
                      />
                      <span className="text-[8px] font-mono text-white/24 mt-1">
                        {year.year.toString().slice(-2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data source */}
          <div className="pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-white/24">
                Source: USASpending.gov
              </span>
              <a
                href={`https://www.usaspending.gov/search/?hash=recipient:${encodeURIComponent(selectedPrivateCompany.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-[#00FFE0]/60 hover:text-[#00FFE0]"
              >
                VIEW ALL →
              </a>
            </div>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
