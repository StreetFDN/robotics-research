'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Company } from '@/types';
import { mergePrivateCompanies } from '@/utils/companyMapping';

export default function CompanyList() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const {
    companies,
    privateCompanies,
    filteredCompanies,
    selectedCompany,
    setSelectedCompany,
    selectedPrivateCompany,
    setSelectedPrivateCompany,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
  } = useGlobeStore();

  // Merge private companies into the companies list for display
  const allCompanies = useMemo(() => {
    return mergePrivateCompanies(companies, privateCompanies);
  }, [companies, privateCompanies]);

  // Apply filtering to merged companies
  const filteredAllCompanies = useMemo(() => {
    let filtered = allCompanies;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) =>
        selectedTags.some((tag) => c.tags.includes(tag))
      );
    }

    return filtered;
  }, [allCompanies, searchQuery, selectedTags]);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to selected company
  useEffect(() => {
    if (selectedCompany && itemRefs.current.has(selectedCompany.id)) {
      const element = itemRefs.current.get(selectedCompany.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCompany]);

  // Get all unique tags from merged companies
  const allTags = Array.from(
    new Set(allCompanies.flatMap((c) => c.tags))
  ).sort();

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Handle company click - detect if private company and set appropriate state
  const handleCompanyClick = (company: Company) => {
    // Check if this company is a private company by ID
    const privateCompany = privateCompanies.find((pc) => pc.id === company.id);
    if (privateCompany) {
      setSelectedPrivateCompany(privateCompany);
    } else {
      setSelectedCompany(company);
    }
  };

  return (
    <div className="flex flex-col h-full glass-subtle border-r border-white/10">
      {/* Search */}
      <div className="p-4 border-b border-white/10">
        <input
          type="text"
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 glass border border-white/10 rounded-lg text-body text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Tags filter - collapsible */}
      <div className="border-b border-white/10">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full p-4 flex items-center justify-between hover:glass-subtle transition-colors"
        >
          <div className="text-label text-gray-500">Filters</div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              filtersExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {filtersExpanded && (
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-background border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Company list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filteredAllCompanies.length === 0 ? (
          <div className="p-4 text-gray-500 text-body">No companies found</div>
        ) : (
          filteredAllCompanies.map((company) => (
            <CompanyListItem
              key={company.id}
              company={company}
              isSelected={selectedCompany?.id === company.id || selectedPrivateCompany?.id === company.id}
              onClick={() => handleCompanyClick(company)}
              ref={(el) => {
                if (el) itemRefs.current.set(company.id, el);
                else itemRefs.current.delete(company.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CompanyListItemProps {
  company: Company;
  isSelected: boolean;
  onClick: () => void;
}

const CompanyListItem = React.forwardRef<HTMLDivElement, CompanyListItemProps>(
  ({ company, isSelected, onClick }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`p-4 border-b border-white/10 cursor-pointer transition-all ${
          isSelected
            ? 'glass border-l-4 border-l-accent'
            : 'hover:glass-subtle'
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-body font-semibold text-white">{company.name}</h3>
          {company.activityScore && (
            <span className="text-caption text-gray-500 font-mono">{company.activityScore}</span>
          )}
        </div>
        {company.description && (
          <p className="text-caption text-gray-400 mb-2 line-clamp-2">{company.description}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {company.tags.map((tag) => (
            <span
              key={tag}
              className="text-caption px-2 py-0.5 glass-subtle rounded text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>
        {company.latestActivity && (
          <div className="text-caption text-gray-600 mt-2 font-mono">
            {company.latestActivity.toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }
);

CompanyListItem.displayName = 'CompanyListItem';

