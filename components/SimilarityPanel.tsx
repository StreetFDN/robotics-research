'use client';

import { useState, useEffect } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import IntelPanel, { IntelPanelEmpty, IntelPanelLoading, IntelPanelError } from './ui/IntelPanel';
import TraitBadge from './ui/TraitBadge';

interface SimilarCompany {
  id: string;
  name: string;
  similarity: number;
  sharedTraits: string[];
  differences: string[];
}

interface SimilarityResult {
  sourceCompany: string;
  similar: SimilarCompany[];
}

interface ApiResponse {
  ok: boolean;
  data?: SimilarityResult;
  error?: string;
  _meta?: {
    confidence: number;
    lastUpdated: string;
    source: string;
  };
}

/**
 * SimilarityPanel - Sprint 2
 * Shows similar companies when a company is selected
 * Lists top 5 similar companies with similarity score, shared traits, differences
 */
export default function SimilarityPanel() {
  const { selectedPrivateCompany, hoveredPrivateCompany, setSelectedPrivateCompany, privateCompanies } = useGlobeStore();
  const [data, setData] = useState<SimilarityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Use selected company, fallback to hovered
  const activeCompany = selectedPrivateCompany ?? hoveredPrivateCompany;
  const companyId = activeCompany?.id;

  // Fetch similarity data when company changes
  useEffect(() => {
    if (!companyId) {
      setData(null);
      setError(null);
      setExpandedId(null);
      return;
    }

    const fetchSimilarityData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/similarity?companyId=${encodeURIComponent(companyId)}`);
        const result: ApiResponse = await response.json();

        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch similar companies');
        }

        setData(result.data || null);
      } catch (err: any) {
        console.error('[SimilarityPanel] Fetch error:', err);
        setError(err.message || 'Similar companies unavailable');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarityData();
  }, [companyId]);

  // Handle clicking on a similar company to select it
  const handleSelectCompany = (similarId: string) => {
    const company = privateCompanies.find(c => c.id === similarId);
    if (company) {
      setSelectedPrivateCompany(company);
    }
  };

  // Toggle expanded state
  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Format similarity as percentage
  const formatSimilarity = (similarity: number): string => {
    return `${Math.round(similarity * 100)}%`;
  };

  // Empty state when no company selected
  if (!activeCompany) {
    return (
      <IntelPanel title="SIMILAR ENTITIES" subtitle="Comparative Analysis">
        <IntelPanelEmpty message="Select a company to view similar entities" minHeight="120px" />
      </IntelPanel>
    );
  }

  return (
    <IntelPanel
      title="SIMILAR ENTITIES"
      subtitle={activeCompany.name}
      showLive={!!selectedPrivateCompany}
    >
      {loading ? (
        <IntelPanelLoading rows={5} height="40px" />
      ) : error ? (
        <IntelPanelError message={error} />
      ) : data && data.similar.length > 0 ? (
        <div className="space-y-2">
          {data.similar.map((similar) => (
            <div
              key={similar.id}
              className="border border-white/[0.06] rounded-sm bg-white/[0.02] overflow-hidden"
            >
              {/* Header row - always visible */}
              <div
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => toggleExpanded(similar.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Expand/collapse indicator */}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className={`text-white/32 transition-transform ${expandedId === similar.id ? 'rotate-90' : ''}`}
                  >
                    <path
                      d="M3 1.5L7 5L3 8.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  {/* Company name - clickable to navigate */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCompany(similar.id);
                    }}
                    className="text-[12px] font-medium text-white hover:text-[#00FFE0] transition-colors truncate"
                  >
                    {similar.name}
                  </button>
                </div>
                {/* Similarity score */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-white/32 font-mono uppercase">MATCH</span>
                  <span className="text-[12px] font-mono font-medium text-[#00FFE0]">
                    {formatSimilarity(similar.similarity)}
                  </span>
                </div>
              </div>

              {/* Expanded detail view */}
              {expandedId === similar.id && (
                <div className="px-2 pb-2 pt-1 border-t border-white/[0.04] space-y-2">
                  {/* Shared traits */}
                  {similar.sharedTraits.length > 0 && (
                    <div>
                      <div className="text-[9px] text-white/32 font-mono uppercase tracking-[0.05em] mb-1">
                        COMMON FACTORS
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {similar.sharedTraits.map((trait) => (
                          <TraitBadge key={trait} trait={trait} type="shared" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key differences */}
                  {similar.differences.length > 0 && (
                    <div>
                      <div className="text-[9px] text-white/32 font-mono uppercase tracking-[0.05em] mb-1">
                        KEY DIFFERENCES
                      </div>
                      <div className="space-y-0.5">
                        {similar.differences.map((diff, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] text-white/48 flex items-start gap-1.5"
                          >
                            <span className="text-white/24 mt-0.5">—</span>
                            <span>{diff}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <IntelPanelEmpty message="No similar entities found in current dataset" minHeight="100px" />
      )}
    </IntelPanel>
  );
}
