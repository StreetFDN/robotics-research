'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import IntelPanel, { IntelPanelEmpty, IntelPanelLoading, IntelPanelError } from './ui/IntelPanel';
import SparkLine from './ui/SparkLine';
import SentimentIndicator from './ui/SentimentIndicator';
import HeadlineCard from './ui/HeadlineCard';

interface NewsArticle {
  title: string;
  source: string;
  publishedAt: string;
  sentiment: number;
  url: string;
}

interface SignalsData {
  companyId: string;
  companyName: string;
  newsVelocity: number[];
  sentiment: number;
  sentimentLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  headlines: NewsArticle[];
}

interface ApiResponse {
  ok: boolean;
  data?: SignalsData;
  error?: string;
  _meta?: {
    confidence: number;
    lastUpdated: string;
    source: string;
  };
}

/**
 * Format time difference as human-readable string
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * EarlyWarningPanel - Sprint 3
 * Shows early warning signals: news velocity, sentiment, headlines
 */
export default function EarlyWarningPanel() {
  const { selectedPrivateCompany, hoveredPrivateCompany } = useGlobeStore();
  const [data, setData] = useState<SignalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use selected company, fallback to hovered
  const activeCompany = selectedPrivateCompany ?? hoveredPrivateCompany;
  const companyId = activeCompany?.id;

  // Fetch signals data when company changes
  useEffect(() => {
    if (!companyId) {
      setData(null);
      setError(null);
      return;
    }

    const fetchSignalsData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/signals?companyId=${encodeURIComponent(companyId)}`);
        const result: ApiResponse = await response.json();

        if (!result.ok) {
          throw new Error(result.error || 'Failed to fetch signals data');
        }

        setData(result.data || null);
      } catch (err: any) {
        console.error('[EarlyWarningPanel] Fetch error:', err);
        setError(err.message || 'Signals data unavailable');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignalsData();
  }, [companyId]);

  // Compute trend direction from velocity data
  const velocityTrend = useMemo(() => {
    if (!data?.newsVelocity || data.newsVelocity.length < 2) return 'flat';
    const recent = data.newsVelocity.slice(-3);
    const earlier = data.newsVelocity.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    if (recentAvg > earlierAvg * 1.2) return 'up';
    if (recentAvg < earlierAvg * 0.8) return 'down';
    return 'flat';
  }, [data?.newsVelocity]);

  // Sparkline color based on trend
  const sparkLineColor = useMemo(() => {
    if (velocityTrend === 'up') return '#00FF88';
    if (velocityTrend === 'down') return '#FF3B3B';
    return '#00FFE0';
  }, [velocityTrend]);

  // Empty state when no company selected
  if (!activeCompany) {
    return (
      <IntelPanel title="EARLY WARNING" subtitle="News & Sentiment Signals">
        <IntelPanelEmpty message="Select a company to view signals" minHeight="120px" />
      </IntelPanel>
    );
  }

  return (
    <IntelPanel
      title="EARLY WARNING"
      subtitle={activeCompany.name}
      showLive={!!selectedPrivateCompany}
    >
      {loading ? (
        <IntelPanelLoading rows={4} height="24px" />
      ) : error ? (
        <IntelPanelError message={error} />
      ) : data ? (
        <div className="space-y-4">
          {/* News Velocity Section */}
          <div className="pb-3 border-b border-white/[0.08]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em]">
                NEWS VELOCITY (7D)
              </span>
              <span className="text-[11px] font-mono text-white/64">
                {data.newsVelocity.reduce((a, b) => a + b, 0)} mentions
              </span>
            </div>
            <div className="h-12 bg-white/[0.02] rounded-sm border border-white/[0.06] p-1">
              <SparkLine
                data={data.newsVelocity}
                color={sparkLineColor}
                height={40}
              />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-white/24 font-mono">
              <span>7d ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Sentiment Section */}
          <div className="pb-3 border-b border-white/[0.08]">
            <div className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em] mb-2">
              SENTIMENT SIGNAL
            </div>
            <div className="flex items-center justify-between">
              <SentimentIndicator sentiment={data.sentiment} size="md" />
              <span
                className={`text-[12px] font-mono font-medium ${
                  data.sentimentLabel === 'BULLISH'
                    ? 'text-[#00FF88]'
                    : data.sentimentLabel === 'BEARISH'
                    ? 'text-[#FF3B3B]'
                    : 'text-white/48'
                }`}
              >
                {data.sentimentLabel}
              </span>
            </div>
          </div>

          {/* Headlines Section */}
          <div>
            <div className="text-[10px] text-white/48 font-mono uppercase tracking-[0.05em] mb-2">
              RECENT COVERAGE
            </div>
            {data.headlines.length > 0 ? (
              <div className="space-y-1.5">
                {data.headlines.slice(0, 5).map((headline, idx) => (
                  <HeadlineCard
                    key={idx}
                    title={headline.title}
                    source={headline.source}
                    timeAgo={formatTimeAgo(headline.publishedAt)}
                    sentiment={headline.sentiment}
                    url={headline.url}
                  />
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-white/32 font-mono py-4 text-center">
                No recent news coverage for this entity
              </div>
            )}
          </div>
        </div>
      ) : (
        <IntelPanelEmpty message="No signal data available" minHeight="100px" />
      )}
    </IntelPanel>
  );
}
