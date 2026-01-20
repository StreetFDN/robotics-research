'use client';

import { useState, useEffect, useMemo } from 'react';
import IntelPanel, { IntelPanelEmpty, IntelPanelError } from './ui/IntelPanel';

interface LanguageStats {
  name: string;
  bytes: number;
  percentage: number;
  color: string;
  orgsUsing: string[];
}

interface TechStackResponse {
  ok: boolean;
  data?: { languages: LanguageStats[] };
  error?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  'Python': '#3572A5',
  'C++': '#f34b7d',
  'C': '#555555',
  'JavaScript': '#f1e05a',
  'TypeScript': '#2b7489',
  'Rust': '#dea584',
  'Go': '#00ADD8',
  'Java': '#b07219',
  'CUDA': '#3A4E3A',
  'Shell': '#89e051',
  'CMake': '#DA3434',
  'Other': '#666666',
};

/**
 * Shimmer skeleton for loading state
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Donut placeholder */}
      <div className="flex items-center justify-center py-4">
        <div className="w-32 h-32 rounded-full border-8 border-white/[0.06]" />
      </div>
      {/* Bars placeholder */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-16 h-3 bg-white/[0.08] rounded" />
            <div className="flex-1 h-3 bg-white/[0.06] rounded" />
            <div className="w-12 h-3 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(1)}GB`;
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)}MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)}KB`;
  return `${bytes}B`;
}

/**
 * Simple CSS donut chart
 */
function DonutChart({ data }: { data: LanguageStats[] }) {
  const total = data.reduce((sum, item) => sum + item.percentage, 0);
  let currentAngle = 0;

  // Create conic gradient segments
  const segments = data.map((item) => {
    const start = currentAngle;
    const end = currentAngle + (item.percentage / 100) * 360;
    currentAngle = end;
    return { ...item, start, end };
  });

  const gradientStops = segments.map((seg) => {
    return `${seg.color} ${seg.start}deg ${seg.end}deg`;
  }).join(', ');

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div
        className="w-full h-full rounded-full"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      />
      {/* Inner circle for donut effect */}
      <div className="absolute inset-4 rounded-full bg-[#0a0b0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[18px] font-mono font-medium text-white">
            {data.length}
          </div>
          <div className="text-[9px] font-mono text-white/32 uppercase">
            Languages
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TechStackAnalysis - Sprint 5
 * Donut chart + bar breakdown of languages across robotics
 */
export default function TechStackAnalysis() {
  const [data, setData] = useState<LanguageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTechStack = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/github/techstack');
        const result: TechStackResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch tech stack data');
        }

        // Add colors to data
        const dataWithColors = result.data.languages.map((lang) => ({
          ...lang,
          color: LANGUAGE_COLORS[lang.name] || LANGUAGE_COLORS['Other'],
        }));

        setData(dataWithColors);
      } catch (err: any) {
        console.error('[TechStackAnalysis] Fetch error:', err);
        setError(err.message || 'Failed to load tech stack');
      } finally {
        setLoading(false);
      }
    };

    fetchTechStack();
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Get selected language details
  const selectedDetails = selectedLang
    ? data.find((l) => l.name === selectedLang)
    : null;

  return (
    <IntelPanel
      title="TECH STACK ANALYSIS"
      subtitle="Language Distribution Across Robotics"
      headerRight={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-[9px] font-mono text-white/32 hover:text-[#00FFE0] disabled:opacity-50 transition-colors"
          title="Refresh"
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
        <IntelPanelError message={error} onRetry={handleRefresh} />
      ) : data.length === 0 ? (
        <IntelPanelEmpty message="No tech stack data available" minHeight="150px" />
      ) : (
        <div className="space-y-4">
          {/* Donut Chart */}
          <DonutChart data={data.slice(0, 6)} />

          {/* Language Bars */}
          <div className="space-y-2">
            {data.slice(0, 8).map((lang) => (
              <button
                key={lang.name}
                onClick={() => setSelectedLang(selectedLang === lang.name ? null : lang.name)}
                className={`w-full flex items-center gap-3 p-2 rounded-sm transition-colors ${
                  selectedLang === lang.name
                    ? 'bg-white/[0.06] border border-white/[0.12]'
                    : 'hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: lang.color }}
                />

                {/* Language name */}
                <span className="text-[11px] font-mono text-white/80 w-20 text-left">
                  {lang.name}
                </span>

                {/* Progress bar */}
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${lang.percentage}%`,
                      backgroundColor: lang.color,
                    }}
                  />
                </div>

                {/* Percentage */}
                <span className="text-[10px] font-mono text-white/48 w-12 text-right">
                  {lang.percentage.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>

          {/* Selected Language Details */}
          {selectedDetails && (
            <div className="p-3 bg-white/[0.02] rounded-sm border border-white/[0.06]">
              <div className="text-[10px] font-mono text-white/40 uppercase mb-2">
                ORGANIZATIONS USING {selectedDetails.name.toUpperCase()}
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedDetails.orgsUsing.map((org) => (
                  <span
                    key={org}
                    className="text-[10px] font-mono text-white/60 bg-white/[0.04] px-2 py-0.5 rounded-sm"
                  >
                    {org}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/24 flex justify-between">
            <span>Source: GitHub API</span>
            <span>Cached 24h</span>
          </div>
        </div>
      )}
    </IntelPanel>
  );
}
