'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { IntelPanelLoading, IntelPanelError } from './ui/IntelPanel';
import ProvenanceRow, { type ProvenanceStatus } from './ui/ProvenanceRow';
import ConfidenceBadge from './ui/ConfidenceBadge';

interface IndexPoint {
  timestamp: number;
  value: number;
}

interface IndexData {
  index: IndexPoint[];
  currentValue: number;
  dayChange: number;
  dayChangePercent: number;
  weights: Array<{ id: string; symbol: string; name: string; weight: number }>;
  tokens: Array<{
    id: string;
    symbol: string;
    name: string;
    price: number;
    marketCap: number;
    change24h: number;
  }>;
}

type TimeRange = '1Y' | '6M' | '3M' | '1M' | 'YTD';

const API_BASE = '/api/indices/robotics-crypto';
const POLL_INTERVAL_MS = 120000; // 120 seconds (only if successful)
const CLIENT_CACHE_TTL_MS = 30000; // 30 seconds client-side cache

// Client-side cache
const apiCache = new Map<string, { data: IndexData; timestamp: number }>();

interface HoverPoint {
  x: number;
  y: number;
  value: number;
  time: number;
}

export default function RoboticsCryptoIndex() {
  const [data, setData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeRange>('3M');
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);
  const [showComposition, setShowComposition] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute provenance status based on data freshness
  const provenanceStatus = useMemo((): ProvenanceStatus => {
    if (!lastFetchTime) return 'STALE';
    const ageMs = Date.now() - lastFetchTime;
    if (ageMs < 5 * 60 * 1000) return 'LIVE';       // < 5 minutes
    if (ageMs < 30 * 60 * 1000) return 'DEGRADED';  // < 30 minutes
    return 'STALE';
  }, [lastFetchTime]);

  // Track fetch state for backoff
  const lastSuccessRef = useRef<boolean>(false);
  const failureCountRef = useRef<number>(0);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate backoff delay (exponential: 15s, 30s, 60s, 120s, max 120s)
  const getBackoffDelay = (failureCount: number): number => {
    const delays = [15000, 30000, 60000, 120000];
    return delays[Math.min(failureCount, delays.length - 1)];
  };

  // Fetch index data
  const fetchIndexData = async (range: TimeRange, isRetry = false) => {
    const cacheKey = `robotics-crypto-${range}`;
    const cached = apiCache.get(cacheKey);
    
    // Use cache if fresh and not a retry
    if (!isRetry && cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      lastSuccessRef.current = true;
      failureCountRef.current = 0;
      return;
    }

    try {
      const response = await fetch(`${API_BASE}?range=${range}`);
      const result = await response.json();

      if (!result.ok) {
        // Extract error details from structured response
        const errorMsg = result.error || 'Index unavailable';
        const errorDetails = result.details || '';
        const errorStep = result.step || '';
        
        // Build user-friendly error message
        let fullError = errorMsg;
        if (errorStep === 'fetch_markets') {
          fullError = 'Index unavailable: Failed to fetch market data';
          if (result.upstreamStatus) {
            fullError += ` (HTTP ${result.upstreamStatus})`;
          }
          if (result.details) {
            fullError += ` - ${result.details}`;
          }
        } else if (errorDetails) {
          fullError += `: ${errorDetails}`;
        }
        
        throw new Error(fullError);
      }

      // Convert response to IndexData format (handle both new and legacy formats)
      const indexData: IndexData = {
        index: result.points 
          ? result.points.map((p: { t: number; v: number }) => ({ timestamp: p.t, value: p.v }))
          : result.index || [],
        currentValue: result.last?.v ?? result.currentValue ?? 100,
        dayChange: result.last?.changeAbs ?? result.dayChange ?? 0,
        dayChangePercent: result.last?.changePct ?? result.dayChangePercent ?? 0,
        weights: result.weights || [],
        tokens: result.tokens || [],
      };

      setData(indexData);
      setError(null);
      setLoading(false);
      setLastFetchTime(Date.now());

      // Cache the result
      apiCache.set(cacheKey, { data: indexData, timestamp: Date.now() });
      
      // Reset failure tracking on success
      lastSuccessRef.current = true;
      failureCountRef.current = 0;
    } catch (err: any) {
      console.error('[RoboticsCryptoIndex] Fetch error:', err);
      
      const errorMessage = err.message || 'Failed to load index data';
      setError(errorMessage);
      setLoading(false);
      
      // Track failure
      lastSuccessRef.current = false;
      failureCountRef.current += 1;
      
      // Try to use cached data if available
      if (cached) {
        setData(cached.data);
      }
    }
  };

  // Polling effect with backoff
  useEffect(() => {
    // Initial fetch
    fetchIndexData(timeframe);
    
    // Set up polling only if last fetch succeeded
    const scheduleNextFetch = () => {
      // Clear any existing timeout
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
      
      if (lastSuccessRef.current) {
        // Success: poll at normal interval
        backoffTimeoutRef.current = setTimeout(() => {
          fetchIndexData(timeframe);
          scheduleNextFetch();
        }, POLL_INTERVAL_MS);
      } else {
        // Failure: use exponential backoff
        const backoffDelay = getBackoffDelay(failureCountRef.current);
        backoffTimeoutRef.current = setTimeout(() => {
          fetchIndexData(timeframe, true);
          scheduleNextFetch();
        }, backoffDelay);
      }
    };
    
    // Schedule first poll after initial fetch completes
    const initialTimeout = setTimeout(() => {
      scheduleNextFetch();
    }, POLL_INTERVAL_MS);
    
    return () => {
      if (backoffTimeoutRef.current) {
        clearTimeout(backoffTimeoutRef.current);
      }
      clearTimeout(initialTimeout);
    };
  }, [timeframe]);

  // Filter history by timeframe
  const filteredHistory = useMemo(() => {
    if (!data || !data.index || data.index.length === 0) return [];
    
    const now = Date.now();
    let cutoff: number;
    
    switch (timeframe) {
      case '1Y':
        cutoff = now - 365 * 24 * 60 * 60 * 1000;
        break;
      case '6M':
        cutoff = now - 180 * 24 * 60 * 60 * 1000;
        break;
      case '3M':
        cutoff = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case '1M':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'YTD':
        const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
        cutoff = yearStart;
        break;
      default:
        return data.index;
    }
    
    return data.index.filter((p) => p.timestamp >= cutoff);
  }, [data, timeframe]);

  // Draw chart with terminal-style design
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (filteredHistory.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#0D1015';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 16;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear with dark background
    ctx.fillStyle = '#0D1015';
    ctx.fillRect(0, 0, width, height);

    // Find min/max for scaling (with padding)
    const values = filteredHistory.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valuePadding = (maxValue - minValue) * 0.1 || 1;
    const valueRange = (maxValue - minValue + valuePadding * 2) || 1;
    
    const minTime = filteredHistory[0].timestamp;
    const maxTime = filteredHistory.length > 1 
      ? filteredHistory[filteredHistory.length - 1].timestamp 
      : minTime + 3600000;
    const timeRange = maxTime - minTime || 1;

    // Draw subtle grid
    ctx.strokeStyle = '#1A1F2E';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    
    // Horizontal lines (value levels)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }

    // Draw confidence band (subtle fill under line)
    if (filteredHistory.length > 1) {
      ctx.fillStyle = '#00B8A3';
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      
      filteredHistory.forEach((point, idx) => {
        const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
        const y = padding + chartHeight - ((point.value - (minValue - valuePadding)) / valueRange) * chartHeight;
        
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      // Close path to bottom
      const lastX = padding + ((filteredHistory[filteredHistory.length - 1].timestamp - minTime) / timeRange) * chartWidth;
      const firstX = padding + ((filteredHistory[0].timestamp - minTime) / timeRange) * chartWidth;
      ctx.lineTo(lastX, padding + chartHeight);
      ctx.lineTo(firstX, padding + chartHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Draw main line
    ctx.strokeStyle = '#00B8A3';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();

    filteredHistory.forEach((point, idx) => {
      const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((point.value - (minValue - valuePadding)) / valueRange) * chartHeight;
      
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw hover crosshair
    if (hoverPoint) {
      ctx.strokeStyle = '#00B8A3';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([2, 2]);
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverPoint.x, padding);
      ctx.lineTo(hoverPoint.x, padding + chartHeight);
      ctx.stroke();
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(padding, hoverPoint.y);
      ctx.lineTo(padding + chartWidth, hoverPoint.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Value readout
      ctx.fillStyle = '#0D1015';
      ctx.fillRect(hoverPoint.x - 30, hoverPoint.y - 20, 60, 16);
      ctx.strokeStyle = '#00B8A3';
      ctx.strokeRect(hoverPoint.x - 30, hoverPoint.y - 20, 60, 16);
      ctx.fillStyle = '#00B8A3';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hoverPoint.value.toFixed(2)}`, hoverPoint.x, hoverPoint.y - 6);
    }

    // Draw current value indicator
    if (data && filteredHistory.length > 0) {
      const lastPoint = filteredHistory[filteredHistory.length - 1];
      const x = padding + ((lastPoint.timestamp - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((lastPoint.value - (minValue - valuePadding)) / valueRange) * chartHeight;
      
      ctx.fillStyle = '#00B8A3';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [filteredHistory, data, hoverPoint]);

  // Handle mouse move for crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || filteredHistory.length === 0) {
      setHoverPoint(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = 16;
    const chartWidth = rect.width - padding * 2;
    const chartHeight = rect.height - padding * 2;
    
    if (x < padding || x > padding + chartWidth || y < padding || y > padding + chartHeight) {
      setHoverPoint(null);
      return;
    }

    // Find closest point
    const values = filteredHistory.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valuePadding = (maxValue - minValue) * 0.1 || 1;
    const valueRange = (maxValue - minValue + valuePadding * 2) || 1;
    const minTime = filteredHistory[0].timestamp;
    const maxTime = filteredHistory[filteredHistory.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1;
    
    const timeAtX = minTime + ((x - padding) / chartWidth) * timeRange;
    const valueAtY = maxValue + valuePadding - ((y - padding) / chartHeight) * valueRange;
    
    // Find closest point
    let closest: IndexPoint | null = null;
    let minDist = Infinity;
    
    for (const point of filteredHistory) {
      const dist = Math.abs(point.timestamp - timeAtX);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }
    
    if (closest) {
      const pointX = padding + ((closest.timestamp - minTime) / timeRange) * chartWidth;
      const pointY = padding + chartHeight - ((closest.value - (minValue - valuePadding)) / valueRange) * chartHeight;
      
      setHoverPoint({
        x: pointX,
        y: pointY,
        value: closest.value,
        time: closest.timestamp,
      });
    }
  };

  const isLive = provenanceStatus === 'LIVE';

  return (
    <div ref={containerRef} className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] h-full flex flex-col">
      {/* Header - Glassmorphism: subtle bg separator */}
      <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/48">
                  ROBOTICS CRYPTO INDEX
                </span>
                {/* LIVE indicator */}
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#00FF88] animate-pulse' : 'bg-white/16'}`} />
                  <span className="text-[9px] font-mono text-white/32">{isLive ? 'LIVE' : 'STALE'}</span>
                </div>
              </div>
              <div className="text-[10px] text-white/32 font-mono mt-0.5">
                Market-Cap Weighted • Base 100
              </div>
            </div>
            {/* Info icon - BATCH 2: sharp corners */}
            {data && data.weights.length > 0 && (
              <button
                onClick={() => setShowComposition(true)}
                className="w-4 h-4 rounded-sm border border-white/[0.12] hover:border-[#00FFE0] flex items-center justify-center transition-colors group"
                title="View index composition"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-white/32 group-hover:text-[#00FFE0] transition-colors"
                >
                  <path
                    d="M6 1C3.24 1 1 3.24 1 6s2.24 5 5 5 5-2.24 5-5S8.76 1 6 1zm0 9C3.79 10 2 8.21 2 6S3.79 2 6 2s4 1.79 4 4-1.79 4-4 4z"
                    fill="currentColor"
                  />
                  <path
                    d="M6 4.5c-.28 0-.5.22-.5.5v2c0 .28.22.5.5.5s.5-.22.5-.5V5c0-.28-.22-.5-.5-.5zM6 8.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Current value - BATCH 2: refined typography */}
          {data && (
            <div className="text-right flex-shrink-0">
              <div className="text-[9px] text-white/32 uppercase tracking-[0.1em] font-mono mb-0.5">
                Index
              </div>
              <div className="text-[20px] font-mono font-medium text-white tabular-nums">
                {data.currentValue.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Meta stats - BATCH 2: refined styling */}
        {data && (
          <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-white/32 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-white/24">Δ24H</span>{' '}
                <span className={data.dayChange >= 0 ? 'text-[#00FF88]' : 'text-[#FF4444]'}>
                  {data.dayChange >= 0 ? '+' : ''}{data.dayChange.toFixed(2)} ({data.dayChangePercent >= 0 ? '+' : ''}{data.dayChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Timeframe selector - BATCH 2: sharp corners */}
            <div className="flex items-center gap-0.5">
              {(['1M', '3M', '6M', '1Y', 'YTD'] as TimeRange[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono uppercase rounded-sm transition-colors ${
                    timeframe === tf
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/32 hover:text-white/48 hover:bg-white/[0.04]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart area - BATCH 2: refined styling - flex-1 to fill available space */}
      <div className="p-3 flex-1 min-h-0 overflow-hidden">
        {loading && !data ? (
          <IntelPanelLoading rows={2} height="30px" />
        ) : error ? (
          <IntelPanelError
            message={error}
            onRetry={() => fetchIndexData(timeframe, true)}
          />
        ) : data ? (
          <>
            {filteredHistory.length === 0 ? (
              <div className="relative bg-[#0D1015] border border-white/[0.06] rounded-sm h-full min-h-[60px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-[10px] text-white/24 font-mono">No history yet — collecting...</div>
                </div>
              </div>
            ) : (
              <div className="relative bg-[#0D1015] border border-white/[0.06] rounded-sm h-full min-h-[60px]">
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverPoint(null)}
                  className="w-full h-full cursor-crosshair"
                />
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Provenance footer */}
      <div className="px-3 py-1 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <ProvenanceRow
            sourceLabel="CoinGecko API"
            updatedAt={lastFetchTime}
            status={provenanceStatus}
          />
          <ConfidenceBadge confidence={0.91} size="sm" />
        </div>
      </div>

      {/* Composition Modal - Glassmorphism */}
      {showComposition && data && data.weights.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowComposition(false)}
          />
          <div
            className="relative bg-black/60 backdrop-blur-xl rounded-sm p-4 max-w-md w-full mx-4 pointer-events-auto border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06] bg-white/[0.01]">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/48">
                INDEX COMPOSITION
              </span>
              <button
                onClick={() => setShowComposition(false)}
                className="w-5 h-5 rounded-sm border border-white/[0.12] hover:border-white/24 flex items-center justify-center transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-white/48">
                  <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-1">
              {data.weights.map((w) => {
                const token = data.tokens.find((t) => t.id === w.id);
                return (
                  <div key={w.id} className="flex items-center justify-between font-mono py-1.5 border-b border-white/[0.06] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-white font-medium">{w.symbol}</span>
                      <span className="text-[11px] text-white/32">{w.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-white/64">{(w.weight * 100).toFixed(1)}%</span>
                      {token && (
                        <span className={`text-[11px] ${token.change24h >= 0 ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
