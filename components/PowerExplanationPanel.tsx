'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import IntelPanel, { IntelPanelEmpty, IntelPanelLoading, IntelPanelError } from './ui/IntelPanel';
import ScoreBar from './ui/ScoreBar';

interface PowerFactor {
  name: string;
  score: number;
  explanation: string;
}

interface PowerExplanation {
  entityId: string;
  entityName: string;
  overallPower: number;
  factors: PowerFactor[];
  topContributors: string[];
  vulnerabilities: string[];
}

interface ApiResponse {
  ok: boolean;
  data?: PowerExplanation;
  error?: string;
  _meta?: {
    confidence: number;
    lastUpdated: string;
    source: string;
  };
}

/**
 * PowerExplanationPanel - Sprint 2
 * Shows power analysis for selected company/region
 * Sections: Power Factors, Top Contributors, Vulnerabilities
 */
export default function PowerExplanationPanel() {
  const { selectedPrivateCompany, hoveredPrivateCompany } = useGlobeStore();
  const [data, setData] = useState<PowerExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use selected company, fallback to hovered
  const activeCompany = selectedPrivateCompany ?? hoveredPrivateCompany;
  const companyId = activeCompany?.id;

  // Fetch power explanation when company changes
  useEffect(() => {
    if (!companyId) {
      setData(null);
      setError(null);
      return;
    }

    const fetchPowerData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/power/explain?id=${encodeURIComponent(companyId)}&type=company`);
        const result: ApiResponse = await response.json();

        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch power analysis');
        }

        setData(result.data || null);
      } catch (err: any) {
        console.error('[PowerExplanationPanel] Fetch error:', err);
        setError(err.message || 'Power analysis unavailable');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPowerData();
  }, [companyId]);

  // Overall power level color
  const powerColor = useMemo(() => {
    if (!data) return '#00FFE0';
    if (data.overallPower >= 80) return '#00FF88';
    if (data.overallPower >= 50) return '#FFB800';
    return '#FF4444';
  }, [data?.overallPower]);

  // Empty state when no company selected
  if (!activeCompany) {
    return (
      <IntelPanel title="POWER ANALYSIS" subtitle="Strategic Assessment">
        <IntelPanelEmpty message="Select a company to view power analysis" minHeight="120px" />
      </IntelPanel>
    );
  }

  return (
    <IntelPanel
      title="POWER ANALYSIS"
      subtitle={activeCompany.name}
      showLive={!!selectedPrivateCompany}
    >
      {loading ? (
        <IntelPanelLoading rows={4} height="24px" />
      ) : error ? (
        <IntelPanelError message={error} />
      ) : data ? (
        <div className="space-y-4">
          {/* Overall Power Score */}
          <div className="pb-3 border-b border-white/[0.08]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em]">
                OVERALL POWER
              </span>
              <span
                className="text-[18px] font-mono font-medium"
                style={{ color: powerColor }}
              >
                {data.overallPower}
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out rounded-sm"
                style={{
                  width: `${data.overallPower}%`,
                  backgroundColor: powerColor,
                }}
              />
            </div>
          </div>

          {/* Power Factors */}
          <div>
            <div className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em] mb-2">
              POWER FACTORS
            </div>
            <div className="space-y-2">
              {data.factors.map((factor) => (
                <div key={factor.name} className="space-y-1">
                  <ScoreBar
                    score={factor.score}
                    label={factor.name}
                    size="sm"
                  />
                  <div className="text-[10px] text-white/32 font-mono pl-0.5">
                    {factor.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Contributors */}
          {data.topContributors.length > 0 && (
            <div>
              <div className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em] mb-2">
                TOP CONTRIBUTORS
              </div>
              <div className="space-y-1">
                {data.topContributors.map((contributor, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-[11px] text-white/64"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#00FFE0]/60" />
                    <span>{contributor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vulnerabilities */}
          {data.vulnerabilities.length > 0 && (
            <div className="pt-3 border-t border-white/[0.08]">
              <div className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em] mb-2">
                VULNERABILITIES
              </div>
              <div className="space-y-1">
                {data.vulnerabilities.map((vuln, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-[11px] text-[#FF4444]/80"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#FF4444]/60" />
                    <span>{vuln}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <IntelPanelEmpty message="Power analysis unavailable for this entity" minHeight="100px" />
      )}
    </IntelPanel>
  );
}
