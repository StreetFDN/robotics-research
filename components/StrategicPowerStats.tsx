'use client';

import { useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Company, Event } from '@/types';
import { privateCompanyToCompany } from '@/utils/companyMapping';

// Regional mapping (manual, not GIS-based)
const REGIONS = [
  { id: 'us-west', name: 'US West', bounds: { minLat: 32, maxLat: 49, minLon: -125, maxLon: -102 } },
  { id: 'us-east', name: 'US East', bounds: { minLat: 25, maxLat: 49, minLon: -102, maxLon: -66 } },
  { id: 'europe', name: 'Europe Core', bounds: { minLat: 35, maxLat: 60, minLon: -10, maxLon: 30 } },
  { id: 'china', name: 'China', bounds: { minLat: 18, maxLat: 54, minLon: 73, maxLon: 135 } },
  { id: 'japan-korea', name: 'Japan/Korea', bounds: { minLat: 24, maxLat: 46, minLon: 120, maxLon: 132 } },
  { id: 'israel', name: 'Israel', bounds: { minLat: 29, maxLat: 34, minLon: 34, maxLon: 36 } },
  { id: 'rest', name: 'Rest of World', bounds: null }, // Catch-all
];

// Calculate baseline heat contribution (same as HeatmapMap)
function getBaselineHeatContribution(company: Company): number {
  if (company.activityScore != null && company.activityScore > 0) {
    const normalized = company.activityScore / 100;
    return 4 + normalized * 8; // 4-12 range
  }
  return 6;
}

// Calculate event heat contribution (same as HeatmapMap)
function getEventHeatContribution(event: Event): number {
  switch (event.type) {
    case 'funding':
      if (event.funding_usd != null && event.funding_usd > 0) {
        return Math.log10(event.funding_usd) * 20;
      }
      return 20;
    case 'partnership':
      return 30;
    case 'product':
      return 15;
    case 'hiring':
      return 10;
    default:
      return 5;
  }
}

// Time decay (14-day half-life)
function getTimeDecay(timestamp: Date, halfLifeDays: number = 14): number {
  const now = new Date();
  const daysSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysSince / halfLifeDays);
}

// Assign company/event to region
function getRegionForLocation(lat: number, lon: number): string {
  for (const region of REGIONS) {
    if (region.bounds) {
      const { minLat, maxLat, minLon, maxLon } = region.bounds;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
        return region.id;
      }
    }
  }
  return 'rest';
}

export default function StrategicPowerStats() {
  const { companies, privateCompanies, events, setHeatmapFocus, setEventFilter } = useGlobeStore();

  // Filter out crypto/tradfi companies
  const excludeTags = ['crypto', 'blockchain', 'defi', 'tradfi', 'finance', 'fintech'];
  const roboticsCompanies = useMemo(() => {
    const convertedPrivateCompanies = privateCompanies.map(privateCompanyToCompany);
    const allCompanies = [...companies, ...convertedPrivateCompanies];
    return allCompanies.filter((c) => {
      const hasExcludedTag = c.tags?.some((tag) => 
        excludeTags.some((excludeTag) => tag.toLowerCase().includes(excludeTag.toLowerCase()))
      );
      return !hasExcludedTag;
    });
  }, [companies, privateCompanies]);

  // Calculate Robotics Power Index
  const powerIndex = useMemo(() => {
    let total = 0;
    
    // Baseline from companies (excluding crypto/tradfi)
    roboticsCompanies.forEach((company) => {
      if (company.hq_lat != null && company.hq_lon != null) {
        total += getBaselineHeatContribution(company);
      }
    });
    
    // Time-decayed events
    const now = new Date();
    events.forEach((event) => {
      if (event.lat != null && event.lon != null) {
        const contribution = getEventHeatContribution(event);
        const decay = getTimeDecay(event.timestamp);
        total += contribution * decay;
      }
    });
    
    return Math.round(total);
  }, [roboticsCompanies, events]);

  // Calculate power index 7 days ago (simplified: subtract recent events)
  const powerIndex7DaysAgo = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let total = 0;
    roboticsCompanies.forEach((company) => {
      if (company.hq_lat != null && company.hq_lon != null) {
        total += getBaselineHeatContribution(company);
      }
    });
    
    // Only count events older than 7 days (with additional decay)
    events.forEach((event) => {
      if (event.lat != null && event.lon != null && event.timestamp < sevenDaysAgo) {
        const contribution = getEventHeatContribution(event);
        const decay = getTimeDecay(event.timestamp);
        total += contribution * decay;
      }
    });
    
    return Math.round(total);
  }, [roboticsCompanies, events]);

  const powerDelta = powerIndex - powerIndex7DaysAgo;
  const powerDeltaPercent = powerIndex7DaysAgo > 0 
    ? ((powerDelta / powerIndex7DaysAgo) * 100).toFixed(1)
    : '0.0';

  // Regional Power Breakdown
  const regionalPower = useMemo(() => {
    const regionTotals: Record<string, number> = {};
    const regionBaseline: Record<string, number> = {};
    const regionEvents: Record<string, number> = {};
    
    REGIONS.forEach((region) => {
      regionTotals[region.id] = 0;
      regionBaseline[region.id] = 0;
      regionEvents[region.id] = 0;
    });
    
    // Baseline from companies (excluding crypto/tradfi)
    roboticsCompanies.forEach((company) => {
      if (company.hq_lat != null && company.hq_lon != null) {
        const region = getRegionForLocation(company.hq_lat, company.hq_lon);
        const contribution = getBaselineHeatContribution(company);
        regionTotals[region] += contribution;
        regionBaseline[region] += contribution;
      }
    });
    
    // Time-decayed events
    events.forEach((event) => {
      if (event.lat != null && event.lon != null) {
        const region = getRegionForLocation(event.lat, event.lon);
        const contribution = getEventHeatContribution(event);
        const decay = getTimeDecay(event.timestamp);
        regionTotals[region] += contribution * decay;
        regionEvents[region] += contribution * decay;
      }
    });
    
    // Calculate percentages and trends
    const globalTotal = Object.values(regionTotals).reduce((a, b) => a + b, 0);
    
    return REGIONS.map((region) => {
      const total = regionTotals[region.id];
      const baseline = regionBaseline[region.id];
      const eventContribution = regionEvents[region.id];
      const percent = globalTotal > 0 ? (total / globalTotal) * 100 : 0;
      
      // Trend: if event contribution is significant vs baseline, it's "up"
      // Simplified: compare recent events to baseline
      const trend = eventContribution > baseline * 0.2 ? 'up' : 
                    eventContribution < baseline * 0.1 ? 'down' : 'flat';
      
      return {
        ...region,
        total,
        percent,
        trend,
      };
    }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }, [roboticsCompanies, events]);

  // Momentum Leaders (top companies by recent activity)
  const momentumLeaders = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const companyMomentum: Array<{ company: Company; momentum: number }> = [];
    
    roboticsCompanies.forEach((company) => {
      // Baseline score
      const baseline = getBaselineHeatContribution(company);
      
      // Recent events (last 30 days)
      const recentEvents = events.filter(
        (e) => e.company_id === company.id && e.timestamp >= thirtyDaysAgo
      );
      
      let recentIntensity = 0;
      recentEvents.forEach((event) => {
        const contribution = getEventHeatContribution(event);
        const decay = getTimeDecay(event.timestamp);
        recentIntensity += contribution * decay;
      });
      
      // Momentum = recent intensity - baseline
      const momentum = recentIntensity - baseline;
      
      if (momentum > 0 || recentEvents.length > 0) {
        companyMomentum.push({ company, momentum });
      }
    });
    
    return companyMomentum
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 5);
  }, [roboticsCompanies, events]);

  // Strategic Alerts (high-impact events, last 14 days)
  const strategicAlerts = useMemo(() => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    return events
      .filter((event) => {
        if (event.timestamp < fourteenDaysAgo) return false;
        
        // High-impact criteria
        if (event.type === 'funding' && event.funding_usd && event.funding_usd >= 100000000) {
          return true; // $100M+ funding
        }
        if (event.type === 'partnership') {
          return true; // All partnerships
        }
        if (event.severity === 'high') {
          return true;
        }
        return false;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }, [events]);

  const handleRegionClick = (region: typeof REGIONS[0]) => {
    if (region.bounds) {
      const { minLat, maxLat, minLon, maxLon } = region.bounds;
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      setHeatmapFocus({ lat: centerLat, lon: centerLon });
    }
  };

  const handleMomentumClick = (company: Company) => {
    if (company.hq_lat != null && company.hq_lon != null) {
      setHeatmapFocus({ lat: company.hq_lat, lon: company.hq_lon });
      setEventFilter({ companyId: company.id });
    }
  };

  const handleAlertClick = (event: Event) => {
    if (event.lat != null && event.lon != null) {
      setHeatmapFocus({ lat: event.lat, lon: event.lon });
      setEventFilter({ eventId: event.id });
    }
  };

  return (
    <div className="h-full flex flex-col glass-subtle border-r border-white/10 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Robotics Power Index */}
        <div className="border-b border-white/10 pb-6">
          <div className="text-label text-gray-500 mb-3">
            Robotics Power Index
          </div>
          <div className="flex items-baseline gap-4">
            <div className="text-headline font-bold text-white tabular-nums">{powerIndex.toLocaleString()}</div>
            <div className={`text-body ${powerDelta >= 0 ? 'text-accent' : 'text-red-400'}`}>
              {powerDelta >= 0 ? '+' : ''}{powerDelta} ({powerDeltaPercent}%)
            </div>
          </div>
          <div className="text-caption text-gray-500 mt-2">vs 7 days ago</div>
        </div>

        {/* Regional Power Breakdown */}
        <div>
          <div className="text-label text-gray-500 mb-4">
            Regional Power Breakdown
          </div>
          <div className="space-y-3">
            {regionalPower.map((region) => {
              const regionInfo = REGIONS.find((r) => r.id === region.id);
              return (
                <button
                  key={region.id}
                  onClick={() => handleRegionClick(regionInfo!)}
                  className="w-full text-left p-3 rounded-lg glass-subtle hover:glass transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-body text-white font-medium">{regionInfo?.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-caption text-gray-400 font-mono">{region.percent.toFixed(1)}%</div>
                      {region.trend === 'up' && (
                        <div className="text-accent text-body">↑</div>
                      )}
                      {region.trend === 'down' && (
                        <div className="text-red-400 text-body">↓</div>
                      )}
                      {region.trend === 'flat' && (
                        <div className="text-gray-500 text-body">→</div>
                      )}
                    </div>
                  </div>
                  <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-teal-400 transition-all duration-1000 ease-out relative"
                      style={{ width: `${region.percent}%` }}
                    >
                      {/* Subtle shimmer animation */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Momentum Leaders */}
        <div>
          <div className="text-label text-gray-500 mb-4">
            Momentum Leaders
          </div>
          <div className="space-y-2">
            {momentumLeaders.map(({ company, momentum }) => (
              <button
                key={company.id}
                onClick={() => handleMomentumClick(company)}
                className="w-full text-left p-3 rounded-lg glass-subtle hover:glass transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-body text-white font-medium truncate">{company.name}</div>
                  <div className="text-caption text-accent font-mono">+{momentum.toFixed(0)}</div>
                </div>
                <div className="text-caption text-gray-500 truncate">{company.description}</div>
              </button>
            ))}
            {momentumLeaders.length === 0 && (
              <div className="text-caption text-gray-500 p-3">No recent momentum</div>
            )}
          </div>
        </div>

        {/* Strategic Alerts */}
        <div>
          <div className="text-label text-gray-500 mb-4">
            Strategic Alerts
          </div>
          <div className="space-y-2">
            {strategicAlerts.map((event) => {
              const company = roboticsCompanies.find((c) => c.id === event.company_id);
              const daysAgo = Math.floor(
                (new Date().getTime() - event.timestamp.getTime()) / (1000 * 60 * 60 * 24)
              );
              
              return (
                <button
                  key={event.id}
                  onClick={() => handleAlertClick(event)}
                  className="w-full text-left p-3 rounded-lg glass-subtle hover:glass transition-all border-l-2 border-accent"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-label text-accent">{event.type}</div>
                    <div className="text-caption text-gray-500 font-mono">{daysAgo}d ago</div>
                  </div>
                  <div className="text-body text-white mb-1 font-medium">{event.title}</div>
                  {company && (
                    <div className="text-caption text-gray-500">{company.name}</div>
                  )}
                  {event.funding_usd && (
                    <div className="text-caption text-accent mt-1 font-mono">
                      ${(event.funding_usd / 1000000).toFixed(0)}M
                    </div>
                  )}
                </button>
              );
            })}
            {strategicAlerts.length === 0 && (
              <div className="text-caption text-gray-500 p-3">No recent alerts</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

