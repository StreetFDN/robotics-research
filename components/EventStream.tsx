'use client';

import { useMemo, useEffect, useState } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Event } from '@/types';
import { IntelPanelEmpty } from './ui/IntelPanel';
import ProvenanceRow, { type ProvenanceStatus } from '@/components/ui/ProvenanceRow';
import ConfidenceBadge from './ui/ConfidenceBadge';

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  type: string;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * EventStream - BATCH 2 Overhaul
 * Palantir-style event feed panel
 */
export default function EventStream() {
  const { events, selectedCompany, selectedEvent, setSelectedEvent, eventFilter } = useGlobeStore();
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Fetch robotics news on mount
  useEffect(() => {
    async function fetchNews() {
      try {
        setNewsLoading(true);
        const response = await fetch('/api/news/robotics?days=7&limit=30');
        const data = await response.json();

        if (data.ok && data.data?.articles) {
          setNewsArticles(data.data.articles);
          setNewsError(null);
        } else {
          setNewsError(data.error || 'Failed to fetch news');
        }
      } catch (err) {
        console.error('[EventStream] News fetch error:', err);
        setNewsError('Failed to fetch news');
      } finally {
        setNewsLoading(false);
      }
    }

    fetchNews();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter events based on selectedCompany and eventFilter
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (selectedCompany) {
      filtered = filtered.filter((e) => e.company_id === selectedCompany.id);
    }

    if (eventFilter) {
      if (eventFilter.companyId) {
        filtered = filtered.filter((e) => e.company_id === eventFilter.companyId);
      }
      if (eventFilter.eventId) {
        filtered = filtered.filter((e) => e.id === eventFilter.eventId);
      }
    }

    return filtered;
  }, [events, selectedCompany, eventFilter]);

  // Combine events with news articles
  type CombinedItem =
    | { type: 'event'; data: Event }
    | { type: 'news'; data: NewsArticle };

  const combinedItems = useMemo((): CombinedItem[] => {
    const items: CombinedItem[] = [];

    // Add filtered events
    filteredEvents.forEach(event => {
      items.push({ type: 'event', data: event });
    });

    // Add news articles (only when not filtering by company)
    if (!selectedCompany && !eventFilter?.companyId) {
      newsArticles.forEach(article => {
        items.push({ type: 'news', data: article });
      });
    }

    // Sort by timestamp (newest first)
    items.sort((a, b) => {
      const timeA = a.type === 'event'
        ? a.data.timestamp.getTime()
        : new Date(a.data.publishedAt).getTime();
      const timeB = b.type === 'event'
        ? b.data.timestamp.getTime()
        : new Date(b.data.publishedAt).getTime();
      return timeB - timeA;
    });

    return items;
  }, [filteredEvents, newsArticles, selectedCompany, eventFilter]);

  // Latest item timestamp for provenance
  const latestEventTime = useMemo(() => {
    if (combinedItems.length === 0) return null;
    const first = combinedItems[0];
    return first.type === 'event'
      ? first.data.timestamp.getTime()
      : new Date(first.data.publishedAt).getTime();
  }, [combinedItems]);

  // Compute provenance status based on data freshness
  const provenanceStatus = useMemo((): ProvenanceStatus => {
    if (!latestEventTime) return 'STALE';
    const ageMs = Date.now() - latestEventTime;
    if (ageMs < 24 * 60 * 60 * 1000) return 'LIVE';
    if (ageMs < 7 * 24 * 60 * 60 * 1000) return 'DEGRADED';
    return 'STALE';
  }, [latestEventTime]);

  // BATCH 2: Refined type colors with sharp corners
  const typeColors: Record<string, string> = {
    funding: 'bg-[#00FFE0]/10 text-[#00FFE0]',
    product: 'bg-[#00FF88]/10 text-[#00FF88]',
    partnership: 'bg-[#FFB020]/10 text-[#FFB020]',
    acquisition: 'bg-[#FF6B6B]/10 text-[#FF6B6B]',
    hiring: 'bg-white/[0.08] text-white/64',
    research: 'bg-[#00FFE0]/10 text-[#00FFE0]',
    patent: 'bg-white/[0.04] text-white/48',
    news: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
    other: 'bg-white/[0.04] text-white/32',
  };

  // BATCH 2: Refined severity colors
  const severityColors: Record<string, string> = {
    high: 'text-[#FF4444]',
    medium: 'text-[#FFB020]',
    low: 'text-[#00FFE0]',
  };

  const subtitle = selectedCompany ? selectedCompany.name : 'All events';
  const isLive = provenanceStatus === 'LIVE';

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Header - Glassmorphism: subtle bg separator */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/48">
            EVENT STREAM
          </span>
          <div className="text-[10px] text-white/32 font-mono mt-0.5 truncate">
            {subtitle}
          </div>
        </div>
        {/* LIVE indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#00FF88] animate-pulse' : 'bg-white/16'}`} />
          <span className="text-[10px] font-mono text-white/32">{isLive ? 'LIVE' : 'STALE'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {newsLoading && combinedItems.length === 0 ? (
          <div className="p-3 flex items-center justify-center">
            <div className="w-4 h-4 border border-[#00FFE0]/50 border-t-[#00FFE0] rounded-full animate-spin" />
            <span className="ml-2 text-[10px] font-mono text-white/32">Loading news...</span>
          </div>
        ) : combinedItems.length === 0 ? (
          <div className="p-3">
            <IntelPanelEmpty message={newsError || "No events found"} minHeight="120px" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {combinedItems.map((item) => {
              if (item.type === 'event') {
                const event = item.data;
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-3 cursor-pointer transition-all hover:bg-white/[0.02] ${
                      selectedEvent?.id === event.id ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono uppercase ${typeColors[event.type] || typeColors.other}`}
                        >
                          {event.type}
                        </span>
                        {event.severity && (
                          <span className={`text-[10px] font-mono uppercase ${severityColors[event.severity]}`}>
                            {event.severity}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/32 font-mono">
                        {event.timestamp.toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-medium text-white mb-1">{event.title}</h3>
                    {event.description && (
                      <p className="text-[11px] text-white/48 mb-1.5 line-clamp-2">{event.description}</p>
                    )}
                    {event.source_url && (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#00FFE0] hover:text-[#00FFE0]/80 font-mono transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        SOURCE
                      </a>
                    )}
                  </div>
                );
              } else {
                // News article
                const article = item.data;
                const publishedDate = new Date(article.publishedAt);
                return (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 cursor-pointer transition-all hover:bg-white/[0.02]"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono uppercase ${typeColors[article.type] || typeColors.news}`}
                        >
                          {article.type}
                        </span>
                        <span className="text-[10px] font-mono text-white/32">
                          {article.source}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/32 font-mono">
                        {formatTimeAgo(publishedDate)}
                      </span>
                    </div>
                    <h3 className="text-[13px] font-medium text-white mb-1 line-clamp-2">{article.title}</h3>
                    {article.description && (
                      <p className="text-[11px] text-white/48 mb-1.5 line-clamp-2">{article.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-[#00FFE0] font-mono">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      READ MORE
                    </div>
                  </a>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Provenance footer */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <ProvenanceRow
            sourceLabel={newsArticles.length > 0 ? "NewsAPI" : "Internal Feed"}
            updatedAt={latestEventTime}
            status={provenanceStatus}
          />
          <ConfidenceBadge confidence={newsArticles.length > 0 ? 0.85 : 0.72} size="sm" />
        </div>
      </div>
    </div>
  );
}
