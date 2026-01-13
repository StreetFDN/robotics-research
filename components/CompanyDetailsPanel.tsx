'use client';

import React from 'react';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';
import FundingChart from './FundingChart';

export default function CompanyDetailsPanel() {
  const { hoveredPrivateCompany } = useGlobeStore();

  // Show placeholder when nothing is hovered
  if (!hoveredPrivateCompany) {
    return (
      <div className="glass border-b border-white/10 p-6 min-h-[200px] flex items-center justify-center">
        <div className="border-2 border-dashed border-white/10 rounded-lg w-full h-full min-h-[180px] flex items-center justify-center">
          <p className="text-caption text-gray-500">Hover on a startup to see details</p>
        </div>
      </div>
    );
  }

  const company = hoveredPrivateCompany;

  const formatAmount = (val?: number): string => {
    if (!val) return '';
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  const formatRoundLabel = (round: string): string => {
    if (round === 'unknown') return 'Valuation';
    return round
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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

  return (
    <div className="glass border-b border-white/10 p-6 space-y-4">
      {/* Company Name */}
      <div className="text-subheadline font-semibold text-white mb-1">{company.name}</div>

      {/* Location */}
      {(company.city || company.country) && (
        <div className="text-caption text-gray-400">
          {company.city && company.country
            ? `${company.city}, ${company.country}`
            : company.country || company.city}
        </div>
      )}

      {/* Latest Valuation */}
      {latestRound && (
        <div className="pb-4 border-b border-white/10">
          <div className="text-label text-gray-500 mb-2">
            {formatRoundLabel(latestRound.round)}
          </div>
          <div className="text-subheadline text-red-400 font-semibold">
            {formatAmount(latestRound.valuationUsd)}
            {latestRound.time && (
              <span className="text-caption text-gray-500 font-normal ml-2">{latestRound.time}</span>
            )}
          </div>
        </div>
      )}

      {/* Funding Chart */}
      {company.fundingRounds && company.fundingRounds.length > 0 && (
        <div>
          <div className="text-label text-gray-500 mb-3">
            Funding History
          </div>
          <FundingChart rounds={company.fundingRounds} width={340} height={100} />
        </div>
      )}

      {/* Description */}
      {company.description && (
        <div className="text-body text-gray-300 line-clamp-2 leading-relaxed">
          {company.description}
        </div>
      )}

      {/* Tags */}
      {company.tags && company.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {company.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 glass-subtle border border-white/10 rounded text-caption text-gray-300"
            >
              {tag}
            </span>
          ))}
          {company.tags.length > 6 && (
            <span className="px-2 py-1 text-caption text-gray-600">+{company.tags.length - 6}</span>
          )}
        </div>
      )}

      {/* Website */}
      {company.website && (
        <div className="text-caption text-gray-500 pt-3 border-t border-white/10">
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:text-red-300 underline truncate block"
          >
            {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        </div>
      )}
    </div>
  );
}

