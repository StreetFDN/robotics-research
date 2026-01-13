'use client';

import React from 'react';
import type { PrivateCompany } from '@/types/companies';
import FundingChart from './FundingChart';

interface CompanyTooltipProps {
  company: PrivateCompany;
}

export default function CompanyTooltip({ company }: CompanyTooltipProps) {
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
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded px-2 py-1.5 text-white shadow-lg w-[200px]">
      {/* Company Name */}
      <div className="font-semibold text-white text-xs mb-0.5 truncate">{company.name}</div>

      {/* Location */}
      {(company.city || company.country) && (
        <div className="text-gray-400 text-[10px] mb-1.5 truncate">
          {company.city && company.country
            ? `${company.city}, ${company.country}`
            : company.country || company.city}
        </div>
      )}

      {/* Latest Valuation */}
      {latestRound && (
        <div className="mb-1.5 pb-1.5 border-b border-gray-800">
          <div className="text-gray-500 text-[9px] uppercase tracking-wide mb-0.5">
            {formatRoundLabel(latestRound.round)}
          </div>
          <div className="text-red-400 font-semibold text-xs">
            {formatAmount(latestRound.valuationUsd)}
            {latestRound.time && (
              <span className="text-gray-500 text-[9px] font-normal ml-1">{latestRound.time}</span>
            )}
          </div>
        </div>
      )}

      {/* Funding Chart - Smaller */}
      {company.fundingRounds && company.fundingRounds.length > 0 && (
        <div className="mb-1.5">
          <div className="text-gray-500 text-[9px] uppercase tracking-wide mb-0.5">
            Funding
          </div>
          <FundingChart rounds={company.fundingRounds} width={180} height={50} />
        </div>
      )}

      {/* Tags - Compact */}
      {company.tags && company.tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-1">
          {company.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[9px] text-gray-300"
            >
              {tag}
            </span>
          ))}
          {company.tags.length > 3 && (
            <span className="px-1 py-0.5 text-gray-600 text-[9px]">+{company.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Website - Smaller */}
      {company.website && (
        <div className="text-gray-500 text-[9px] pt-1 border-t border-gray-800">
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:text-red-300 underline truncate block"
          >
            {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 25)}
            {(company.website.replace(/^https?:\/\//, '').replace(/\/$/, '').length > 25) && '...'}
          </a>
        </div>
      )}
    </div>
  );
}

