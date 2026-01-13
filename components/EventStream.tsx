'use client';

import { useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Event } from '@/types';

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

  const severityColors = {
    high: 'text-alert',
    medium: 'text-amber',
    low: 'text-accent',
  };

  const typeColors = {
    funding: 'bg-accent/20 text-accent',
    product: 'bg-teal/20 text-teal',
    partnership: 'bg-amber/20 text-amber',
    hiring: 'bg-white/20 text-white',
    research: 'bg-accent/20 text-accent',
    patent: 'bg-gray-600/20 text-gray-400',
    other: 'bg-gray-700/20 text-gray-500',
  };

  return (
    <div className="flex flex-col h-full glass-subtle border-l border-white/10">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-subheadline font-semibold text-white">Event Stream</h2>
        <div className="text-caption text-gray-500 mt-1">
          {selectedCompany ? `${selectedCompany.name} events` : 'All events'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="p-4 text-gray-500 text-body">No events found</div>
        ) : (
          <div className="divide-y divide-white/10">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`p-4 cursor-pointer transition-all hover:glass-subtle ${
                  selectedEvent?.id === event.id ? 'glass' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-caption px-2 py-1 rounded ${typeColors[event.type]}`}
                    >
                      {event.type}
                    </span>
                    {event.severity && (
                      <span className={`text-caption ${severityColors[event.severity]}`}>
                        {event.severity}
                      </span>
                    )}
                  </div>
                  <span className="text-caption text-gray-600 font-mono">
                    {event.timestamp.toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-body font-medium text-white mb-1">{event.title}</h3>
                {event.description && (
                  <p className="text-caption text-gray-400 mb-2">{event.description}</p>
                )}
                {event.source_url && (
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

