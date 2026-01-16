'use client';

import React from 'react';
import { useGlobeStore } from '@/store/globeStore';
import FundingChart from './FundingChart';
import IntelPanel, { IntelPanelEmpty } from './ui/IntelPanel';

/**
 * CompanyDetailsPanel - BATCH 2 Overhaul
 * Palantir-style company intelligence display
 */
export default function CompanyDetailsPanel() {
  const { hoveredPrivateCompany, selectedPrivateCompany } = useGlobeStore();

  // Pinned selection takes priority over hover
  const displayCompany = selectedPrivateCompany ?? hoveredPrivateCompany;

  // Show placeholder when nothing is selected or hovered
  if (!displayCompany) {
    return (
      <IntelPanel title="COMPANY INTEL" subtitle="Startup Profile">
        <IntelPanelEmpty message="Hover on a startup to see details" />
      </IntelPanel>
    );
  }

  const company = displayCompany;

  const formatAmount = (val?: number): string => {
    if (!val) return '';
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  const formatRoundLabel = (round: string): string => {
    if (round === 'unknown') return 'VALUATION';
    return round
      .split('-')
      .map((w) => w.toUpperCase())
      .join(' ');
  };

  // Get latest valuation
  const latestRound = company.fundingRounds
    ?.filter((r) => r.valuationUsd !== undefined)
    .sort((a, b) => {
      if (!a.time || !b.time) return 0;
      const [aMonth, aYear] = a.time.split('/').map(Number);
      const [bMonth, bYear] = b.time.split('/').map(Number);
      return new Date(bYear, bMonth - 1).getTime() - new Date(aYear, aMonth - 1).getTime();
    })[0];

  // Header right content with location
  const headerRight = company.city || company.country ? (
    <span className="text-[10px] text-white/32 font-mono">
      {company.city && company.country
        ? `${company.city}, ${company.country}`
        : company.country || company.city}
    </span>
  ) : undefined;

  return (
    <IntelPanel
      title="COMPANY INTEL"
      headerRight={headerRight}
      showLive={!!selectedPrivateCompany}
    >
      <div className="space-y-3">
        {/* Company Name - BATCH 2: text-[16px] font-semibold */}
        <div className="text-[16px] font-semibold text-white leading-tight">
          {company.name}
        </div>

        {/* Latest Valuation */}
        {latestRound && (
          <div className="pb-3 border-b border-white/[0.08]">
            {/* Label - BATCH 2: text-[11px] text-white/48 */}
            <div className="text-[11px] text-white/48 mb-1 font-mono uppercase tracking-[0.05em]">
              {formatRoundLabel(latestRound.round)}
            </div>
            {/* Value - BATCH 2: text-[13px] font-mono text-white */}
            <div className="flex items-baseline gap-2">
              <span className="text-[18px] font-mono font-medium text-[#00FFE0]">
                {formatAmount(latestRound.valuationUsd)}
              </span>
              {latestRound.time && (
                <span className="text-[11px] text-white/32 font-mono">{latestRound.time}</span>
              )}
            </div>
          </div>
        )}

        {/* Funding Chart */}
        {company.fundingRounds && company.fundingRounds.length > 0 && (
          <div>
            <div className="text-[11px] text-white/48 mb-2 font-mono uppercase tracking-[0.05em]">
              FUNDING HISTORY
            </div>
            <FundingChart rounds={company.fundingRounds} width={340} height={100} />
          </div>
        )}

        {/* Description */}
        {company.description && (
          <div className="text-[12px] text-white/64 line-clamp-2 leading-relaxed">
            {company.description}
          </div>
        )}

        {/* Tags - BATCH 2: sharp corners (rounded-sm) */}
        {company.tags && company.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-sm text-[10px] text-white/48 font-mono"
              >
                {tag}
              </span>
            ))}
            {company.tags.length > 6 && (
              <span className="px-1.5 py-0.5 text-[10px] text-white/32 font-mono">
                +{company.tags.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Website */}
        {company.website && (
          <div className="pt-2 border-t border-white/[0.08]">
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#00FFE0] hover:text-[#00FFE0]/80 font-mono truncate block transition-colors"
            >
              {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
      </div>
    </IntelPanel>
  );
}
