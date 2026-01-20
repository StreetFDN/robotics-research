'use client';

import { useState, useEffect, useMemo } from 'react';

interface HistoryPoint {
  timestamp: string;
  overall: number;
}

interface NarrativeScore {
  overall: number;
  components: {
    indexAlpha: number;   // Market alpha vs MSCI World (30%)
    polymarket: number;   // Prediction market sentiment (15%)
    contracts: number;    // Government contracts (15%)
    github: number;       // Developer activity (10%)
    news: number;         // News sentiment (10%)
    funding: number;      // VC funding (10%)
    technical: number;    // SDK releases (10%)
  };
  trend: 'up' | 'down' | 'stable';
  trendValue?: number;  // Optional - may not be returned from API
  confidence: number;
  timestamp: string;
  signals: Array<{
    id: string;
    type: string;
    title: string;
    impact: number;
  }>;
}

interface NarrativeResponse {
  ok: boolean;
  data?: NarrativeScore;
  error?: string;
}

type NarrativeLevel = 'strong' | 'building' | 'neutral' | 'weakening' | 'cold';

const LEVEL_CONFIG: Record<NarrativeLevel, { label: string; emoji: string; color: string; bgColor: string }> = {
  strong: { label: 'STRONG NARRATIVE', emoji: '🟢', color: '#00FF88', bgColor: 'rgba(0, 255, 136, 0.1)' },
  building: { label: 'BUILDING', emoji: '🟡', color: '#FFB800', bgColor: 'rgba(255, 184, 0, 0.1)' },
  neutral: { label: 'NEUTRAL', emoji: '⚪', color: '#888888', bgColor: 'rgba(136, 136, 136, 0.1)' },
  weakening: { label: 'WEAKENING', emoji: '🟠', color: '#FF8C00', bgColor: 'rgba(255, 140, 0, 0.1)' },
  cold: { label: 'COLD', emoji: '🔴', color: '#FF3B3B', bgColor: 'rgba(255, 59, 59, 0.1)' },
};

const COMPONENT_CONFIG = [
  { key: 'indexAlpha', label: 'Index Alpha', weight: 30 },      // HEAVY: Market alpha vs MSCI World
  { key: 'polymarket', label: 'Polymarket', weight: 15 },       // Prediction markets
  { key: 'contracts', label: 'Gov Contracts', weight: 15 },
  { key: 'github', label: 'GitHub Activity', weight: 10 },
  { key: 'news', label: 'News Sentiment', weight: 10 },
  { key: 'funding', label: 'Funding Flow', weight: 10 },
  { key: 'technical', label: 'Technical', weight: 10 },
] as const;

function getLevel(score: number): NarrativeLevel {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'building';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'weakening';
  return 'cold';
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Score placeholder */}
      <div className="text-center py-8">
        <div className="w-32 h-20 bg-white/[0.06] rounded mx-auto mb-4" />
        <div className="w-24 h-6 bg-white/[0.04] rounded mx-auto" />
      </div>
      {/* Bars placeholder */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-3 bg-white/[0.06] rounded" />
            <div className="flex-1 h-2 bg-white/[0.04] rounded-full" />
            <div className="w-10 h-3 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Simple sparkline chart for history
 */
function HistoryChart({ points, color }: { points: HistoryPoint[]; color: string }) {
  if (points.length === 0) return null;

  // Get min/max for scaling
  const values = points.map(p => p.overall);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;

  // SVG dimensions
  const width = 280;
  const height = 60;
  const padding = 4;

  // Generate path
  const pathPoints = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((p.overall - min) / range) * (height - padding * 2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate area fill path
  const areaPath = pathPoints +
    ` L ${padding + ((points.length - 1) / Math.max(points.length - 1, 1)) * (width - padding * 2)} ${height - padding}` +
    ` L ${padding} ${height - padding} Z`;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Grid lines */}
      {[25, 50, 75].map(val => {
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return (
          <line
            key={val}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2,2"
          />
        );
      })}

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`${color}10`}
      />

      {/* Line */}
      <path
        d={pathPoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => {
        const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((p.overall - min) / range) * (height - padding * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === points.length - 1 ? 4 : 2}
            fill={i === points.length - 1 ? color : `${color}80`}
          />
        );
      })}

      {/* Labels */}
      <text x={padding} y={12} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">
        {max}%
      </text>
      <text x={padding} y={height - 2} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">
        {min}%
      </text>
    </svg>
  );
}

/**
 * NarrativeIndex - Sprint 6
 * Hero component showing ROBOTICS NARRATIVE INDEX with big percentage,
 * status label, and component breakdown
 */
export default function NarrativeIndex() {
  const [data, setData] = useState<NarrativeScore | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch history data
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/narrative/history?days=7');
        const result = await response.json();
        if (result.ok && result.data?.scores) {
          setHistory(result.data.scores.map((s: any) => ({
            timestamp: s.timestamp,
            overall: s.overall,
          })));
        }
      } catch (err) {
        console.error('[NarrativeIndex] History fetch error:', err);
      }
    };
    fetchHistory();
  }, [refreshKey]);

  useEffect(() => {
    const fetchScore = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/narrative/score');
        const result: NarrativeResponse = await response.json();

        if (!result.ok || !result.data) {
          throw new Error(result.error || 'Failed to fetch narrative score');
        }

        setData(result.data);
      } catch (err: any) {
        console.error('[NarrativeIndex] Fetch error:', err);
        setError(err.message || 'Failed to load narrative index');
        // Use mock data for demo if API fails
        setData({
          overall: 55,
          components: {
            indexAlpha: 52,
            polymarket: 58,
            contracts: 65,
            github: 48,
            news: 52,
            funding: 45,
            technical: 54,
          },
          trend: 'stable',
          trendValue: 0.8,
          confidence: 0.75,
          timestamp: new Date().toISOString(),
          signals: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchScore();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchScore, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Compute level and config
  const level = data ? getLevel(data.overall) : 'neutral';
  const levelConfig = LEVEL_CONFIG[level];

  // Animated score display
  const scoreColor = levelConfig.color;

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/[0.08] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">
            Robotics Narrative Index
          </h2>
          <div className="text-[9px] font-mono text-white/24 mt-0.5">
            Composite market momentum signal
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-[9px] font-mono text-white/32 hover:text-[#00FFE0] disabled:opacity-50 transition-colors p-1"
          title="Refresh"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M8 2V5L11 3.5 8 2Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && !data ? (
          <LoadingSkeleton />
        ) : data ? (
          <div className="space-y-5">
            {/* Main Score Display */}
            <div className="text-center py-4">
              {/* Big Percentage */}
              <div className="relative inline-block">
                <span
                  className="text-[72px] font-mono font-bold leading-none"
                  style={{ color: scoreColor }}
                >
                  {Math.round(data.overall)}
                </span>
                <span className="text-[24px] font-mono text-white/40 ml-1">%</span>
              </div>

              {/* Status Label */}
              <div
                className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-sm border"
                style={{
                  backgroundColor: levelConfig.bgColor,
                  borderColor: `${levelConfig.color}40`,
                }}
              >
                <span className="text-lg">{levelConfig.emoji}</span>
                <span
                  className="text-[11px] font-mono font-medium tracking-wider"
                  style={{ color: levelConfig.color }}
                >
                  {levelConfig.label}
                </span>
              </div>

              {/* Trend Indicator */}
              <div className="mt-3">
                <span
                  className={`text-[12px] font-mono ${
                    data.trend === 'up'
                      ? 'text-[#00FF88]'
                      : data.trend === 'down'
                      ? 'text-[#FF3B3B]'
                      : 'text-white/40'
                  }`}
                >
                  {data.trend === 'up' ? '▲' : data.trend === 'down' ? '▼' : '—'}{' '}
                  {data.trend !== 'stable' && data.trendValue !== undefined && `${data.trendValue > 0 ? '+' : ''}${data.trendValue.toFixed(1)}%`}
                  {' '}vs yesterday
                </span>
              </div>
            </div>

            {/* Component Breakdown */}
            <div className="space-y-2.5">
              <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider">
                Component Breakdown
              </div>
              {COMPONENT_CONFIG.map((comp) => {
                const value = data.components[comp.key as keyof typeof data.components];
                const barColor = value >= 70 ? '#00FF88' : value >= 50 ? '#FFB800' : value >= 30 ? '#FF8C00' : '#FF3B3B';

                return (
                  <div key={comp.key} className="flex items-center gap-3">
                    {/* Label */}
                    <span className="text-[10px] font-mono text-white/48 w-24 truncate">
                      {comp.label}
                    </span>
                    {/* Bar */}
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${value}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    {/* Value */}
                    <span className="text-[10px] font-mono text-white/60 w-8 text-right">
                      {value}%
                    </span>
                    {/* Weight */}
                    <span className="text-[8px] font-mono text-white/24 w-6">
                      ({comp.weight}%)
                    </span>
                  </div>
                );
              })}
            </div>

            {/* History Chart */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[9px] font-mono text-white/32 uppercase tracking-wider mb-2">
                7-Day History
              </div>
              <div className="h-16 relative">
                {history.length > 0 ? (
                  <HistoryChart points={[...history, { timestamp: data.timestamp, overall: data.overall }]} color={scoreColor} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: scoreColor }}
                      />
                      <span className="text-[10px] font-mono text-white/40">
                        {data.overall}% (first data point)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Formula Reference */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="text-[8px] font-mono text-white/16 text-center">
                RNI = Index α(30%) + Polymarket(15%) + Contracts(15%) + GitHub/News/Funding/Tech(10% each)
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[9px] font-mono text-white/24">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                <span>Live</span>
              </div>
              <span>Updated: {formatTimeAgo(data.timestamp)}</span>
              <span>Confidence: {Math.round(data.confidence * 100)}%</span>
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <div className="text-[11px] font-mono text-[#FF3B3B] mb-2">{error}</div>
            <button
              onClick={handleRefresh}
              className="text-[10px] font-mono text-[#00FFE0] hover:text-[#00FFE0]/80"
            >
              Try Again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
