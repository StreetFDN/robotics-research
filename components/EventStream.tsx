'use client';

import { useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Event } from '@/types';
import { IntelPanelEmpty } from './ui/IntelPanel';
import ProvenanceRow, { type ProvenanceStatus } from '@/components/ui/ProvenanceRow';

/**
 * EventStream - BATCH 2 Overhaul
 * Palantir-style event feed panel
 */
export default function EventStream() {
  const { events, selectedCompany, selectedEvent, setSelectedEvent, eventFilter } = useGlobeStore();

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

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  // Latest event timestamp for provenance
  const latestEventTime = useMemo(() => {
    if (sortedEvents.length === 0) return null;
    return sortedEvents[0].timestamp.getTime();
  }, [sortedEvents]);

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
    hiring: 'bg-white/[0.08] text-white/64',
    research: 'bg-[#00FFE0]/10 text-[#00FFE0]',
    patent: 'bg-white/[0.04] text-white/48',
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
        {sortedEvents.length === 0 ? (
          <div className="p-3">
            <IntelPanelEmpty message="No events found" minHeight="120px" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`p-3 cursor-pointer transition-all hover:bg-white/[0.02] ${
                  selectedEvent?.id === event.id ? 'bg-white/[0.04]' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {/* Event type tag - BATCH 2: sharp corners */}
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
            ))}
          </div>
        )}
      </div>

      {/* Provenance footer */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] flex-shrink-0">
        <ProvenanceRow
          sourceLabel="Internal Feed"
          updatedAt={latestEventTime}
          status={provenanceStatus}
        />
      </div>
    </div>
  );
}
