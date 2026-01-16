'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ProvenanceRow, { type ProvenanceStatus } from '@/components/ui/ProvenanceRow';

// Pinned market configuration
const PINNED_CONFIG = {
  EVENT_SLUG: 'will-tesla-release-optimus-by-june-30-2026',
  YES_TOKEN_ID: '81398621498976727589490119481788053159677593582770707348620729114209951230437',
  NO_TOKEN_ID: '',  // Optional, only YES_TOKEN_ID is required for pricing
};

// Debug mode detection
const getDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') === '1') return true;
  try {
    return localStorage.getItem('polymarketDebug') === 'true';
  } catch {
    return false;
  }
};

const DEBUG_MODE = getDebugMode();

interface PricePoint {
  timestamp: number; // Unix timestamp in milliseconds
  price: number;    // Price/probability (0..1)
}

interface CLOBPriceResponse {
  ok: boolean;
  data?: {
    price?: string | number;
    [key: string]: any;
  };
  error?: string;
}

interface CLOBHistoryResponse {
  ok: boolean;
  data?: Array<{ t: number; p: number }>; // t = timestamp (seconds), p = price (0..1)
  error?: string;
}

const PROXY_API_BASE = '/api/polymarket/clob';
const POLL_INTERVAL_MS = 60000; // 60 seconds

// Cache for API responses (client-side)
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CLIENT_CACHE_TTL_MS = 30000; // 30 seconds client-side cache

// Helper to map timeframe to CLOB interval
// Map UI timeframes to valid Polymarket CLOB intervals
// Valid intervals: max, 1w, 1d, 6h, 1h (NO 4h allowed)
function getIntervalForTimeframe(timeframe: '1D' | '1W' | '1M' | 'ALL'): string {
  switch (timeframe) {
    case '1D':
      return '1h'; // 1 hour intervals for 1 day view
    case '1W':
      return '6h'; // 6 hour intervals for 1 week view (was 4h, invalid)
    case '1M':
      return '1d'; // 1 day intervals for 1 month view
    case 'ALL':
      return 'max'; // Maximum interval for all time view
    default:
      return '1d';
  }
}

async function fetchCurrentPrice(tokenId: string): Promise<number | null> {
  if (!tokenId) {
    console.warn('[PolymarketSignal] YES_TOKEN_ID not configured');
    return null;
  }

  // Check client-side cache first
  const cacheKey = `price:${tokenId}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(`${PROXY_API_BASE}/price?token_id=${encodeURIComponent(tokenId)}&side=buy`);
    
    if (!response.ok) {
      const errorData: CLOBPriceResponse = await response.json().catch(() => ({ ok: false }));
      console.error('[PolymarketSignal] Price fetch failed:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result: CLOBPriceResponse = await response.json();
    
    // CLOB API returns {price: "0.074"} directly, not wrapped in {ok: true, data: {...}}
    // Our proxy wraps it, so check both formats
    let priceValue: string | number | undefined;
    
    if (result.ok && result.data) {
      // Proxy format: {ok: true, data: {price: "0.074"}}
      const data = result.data;
      if (typeof data === 'object' && data !== null && 'price' in data) {
        priceValue = (data as any).price;
      } else if (typeof data === 'string' || typeof data === 'number') {
        priceValue = data;
      } else {
        return null;
      }
    } else if ('price' in result) {
      // Direct CLOB format: {price: "0.074"}
      priceValue = (result as any).price;
    } else {
      return null;
    }
    
    const priceStr = String(priceValue);
    let price = parseFloat(priceStr);
    
    if (isNaN(price) || price < 0) {
      console.warn('[PolymarketSignal] Invalid price from CLOB:', result.data);
      return null;
    }
    
    // Normalize: CLOB returns probability (0..1), but handle edge cases
    // If price > 1.5, treat as cents and convert to probability
    if (price > 1.5) {
      price = price / 100;
    }
    
    // Clamp to valid probability range
    if (price > 1) {
      price = 1;
    }
    
    // Cache the result
    apiCache.set(cacheKey, { data: price, timestamp: Date.now() });
    
    return price;
  } catch (error) {
    console.error('[PolymarketSignal] Failed to fetch current price:', error);
    return null;
  }
}

async function fetchPriceHistory(tokenId: string, interval: string = '1d', fidelity: string = '60'): Promise<PricePoint[]> {
  if (!tokenId) {
    return [];
  }

  // Check client-side cache first
  const cacheKey = `history:${tokenId}:${interval}:${fidelity}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS * 2) { // Cache history longer
    return cached.data;
  }

  try {
    const response = await fetch(`${PROXY_API_BASE}/prices-history?market=${encodeURIComponent(tokenId)}&interval=${encodeURIComponent(interval)}&fidelity=${encodeURIComponent(fidelity)}`);
    
    if (!response.ok) {
      const errorData: CLOBHistoryResponse = await response.json().catch(() => ({ ok: false }));
      console.error('[PolymarketSignal] History fetch failed:', errorData);
      return [];
    }
    
    const result: CLOBHistoryResponse = await response.json();
    
    // CLOB API returns {history: [{t, p}]} directly, not wrapped in {ok: true, data: [...]}
    // Our proxy wraps it, so check both formats
    let historyData: Array<{ t: number; p: number }> | undefined;
    
    if (result.ok && result.data && Array.isArray(result.data)) {
      // Proxy format: {ok: true, data: [{t, p}]}
      historyData = result.data;
    } else if ('history' in result && Array.isArray((result as any).history)) {
      // Direct CLOB format: {history: [{t, p}]}
      historyData = (result as any).history;
    } else {
      return [];
    }
    
    // Convert CLOB format [{t, p}] to PricePoint[] format
    if (!historyData || !Array.isArray(historyData)) {
      return [];
    }
    
    const history: PricePoint[] = historyData
      .map((point) => {
        let price = point.p;
        
        // Normalize price: if > 1.5, treat as cents and convert to probability
        if (price > 1.5) {
          price = price / 100;
        }
        
        // Clamp to valid probability range
        if (price > 1) {
          price = 1;
        }
        
        return {
          timestamp: point.t * 1000, // Convert seconds to milliseconds
          price: price,
        };
      })
      .filter((p) => !isNaN(p.timestamp) && !isNaN(p.price) && p.price >= 0 && p.price <= 1)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Cache the result
    apiCache.set(cacheKey, { data: history, timestamp: Date.now() });
    
    return history;
  } catch (error) {
    console.error('[PolymarketSignal] Failed to fetch price history:', error);
    return [];
  }
}

export default function PolymarketSignal() {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Always use ALL timeframe (all-time view)
  const timeframe: 'ALL' = 'ALL';
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; price: number; time: number } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use pinned token ID
  const yesTokenId = PINNED_CONFIG.YES_TOKEN_ID;

  // Current probability as percentage
  // Use latest history point as canonical source (matches chart)
  // Fallback to currentPrice from /price endpoint if history is empty
  const currentProbability = useMemo(() => {
    // Prefer latest history point (canonical source that matches chart)
    if (history.length > 0) {
      const latestPoint = history[history.length - 1];
      return latestPoint.price * 100; // Convert 0..1 to 0..100%
    }
    
    // Fallback to currentPrice from /price endpoint
    if (currentPrice !== null) {
      return currentPrice * 100; // Convert 0..1 to 0..100%
    }
    
    return null;
  }, [history, currentPrice]);

  // Calculate 24h change
  const change24h = useMemo(() => {
    if (currentProbability === null || history.length === 0) return null;
    
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    // Find closest point to 24h ago
    let closest: PricePoint | null = null;
    let minDiff = Infinity;
    
    for (const point of history) {
      const diff = Math.abs(point.timestamp - twentyFourHoursAgo);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    
    if (closest && minDiff < 2 * 60 * 60 * 1000) { // Within 2 hours
      return currentProbability - closest.price;
    }
    
    return null;
  }, [currentProbability, history]);

  // Calculate 7d change
  const change7d = useMemo(() => {
    if (currentProbability === null || history.length === 0) return null;
    
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Find closest point to 7d ago
    let closest: PricePoint | null = null;
    let minDiff = Infinity;
    
    for (const point of history) {
      const diff = Math.abs(point.timestamp - sevenDaysAgo);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    
    if (closest && minDiff < 12 * 60 * 60 * 1000) { // Within 12 hours
      // closest.price is already 0..1, convert to percentage for comparison
      return currentProbability - (closest.price * 100);
    }
    
    return null;
  }, [currentProbability, history]);


  // Poll for price updates
  useEffect(() => {
    if (!yesTokenId) return;

    const poll = async () => {
      const price = await fetchCurrentPrice(yesTokenId);
      if (price !== null) {
        setCurrentPrice(price);
      }
    };

    poll(); // Initial poll
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [yesTokenId]);

  // Refresh history when timeframe changes
  useEffect(() => {
    if (!yesTokenId) return;

    const interval = getIntervalForTimeframe(timeframe);
    fetchPriceHistory(yesTokenId, interval, '60')
      .then((priceHistory) => {
        if (priceHistory.length > 0) {
          setHistory(priceHistory);
        }
      })
      .catch((err) => {
        console.error('[PolymarketSignal] Failed to fetch history:', err);
      });
  }, [yesTokenId, timeframe]);

  // Handle debug slug input submission (only in debug mode)
  // NOTE: Debug slug input UI was removed - widget uses pinned market only
  const handleSlugSubmit = () => {
    if (!DEBUG_MODE) return;
    // Debug slug input functionality removed - widget uses pinned market only
    console.warn('[PolymarketSignal] Debug slug input not available - widget uses pinned market');
  };

  // Always show all history (no filtering - always ALL timeframe)
  const filteredHistory = useMemo(() => {
    return history;
  }, [history]);
  
  // Debug logging (temporary)
  useEffect(() => {
    if (DEBUG_MODE && filteredHistory.length > 0) {
      console.log('[PolymarketSignal] Chart data:', {
        totalPoints: history.length,
        filteredPoints: filteredHistory.length,
        timeframe,
        firstTimestamp: new Date(filteredHistory[0].timestamp).toISOString(),
        lastTimestamp: new Date(filteredHistory[filteredHistory.length - 1].timestamp).toISOString(),
      });
    }
  }, [filteredHistory, history, timeframe]);

  // Draw chart with terminal-style design
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Handle empty history - don't draw, let UI show placeholder
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
    const prices = filteredHistory.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const pricePadding = (maxPrice - minPrice) * 0.1 || 1;
    const priceRange = (maxPrice - minPrice + pricePadding * 2) || 1;
    
    // Handle single point case (draw flat baseline)
    const minTime = filteredHistory[0].timestamp;
    const maxTime = filteredHistory.length > 1 
      ? filteredHistory[filteredHistory.length - 1].timestamp 
      : minTime + 3600000; // 1 hour window for single point
    const timeRange = maxTime - minTime || 1;

    // Draw subtle grid (very low alpha)
    ctx.strokeStyle = '#1A1F2E';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    
    // Horizontal lines (price levels)
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
        const y = padding + chartHeight - ((point.price - (minPrice - pricePadding)) / priceRange) * chartHeight;
        
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

    // Draw main line (thin, restrained)
    ctx.strokeStyle = '#00B8A3';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();

    filteredHistory.forEach((point, idx) => {
      const x = padding + ((point.timestamp - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((point.price - (minPrice - pricePadding)) / priceRange) * chartHeight;
      
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw event markers (vertical ticks for material price changes)
    const PRICE_CHANGE_THRESHOLD = 2; // 2 percentage points
    ctx.strokeStyle = '#00B8A3';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    for (let i = 1; i < filteredHistory.length; i++) {
      const prev = filteredHistory[i - 1];
      const curr = filteredHistory[i];
      const change = Math.abs(curr.price - prev.price);
      
      if (change >= PRICE_CHANGE_THRESHOLD) {
        const x = padding + ((curr.timestamp - minTime) / timeRange) * chartWidth;
        const y = padding + chartHeight - ((curr.price - (minPrice - pricePadding)) / priceRange) * chartHeight;
        
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }

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
      // hoverPoint.price is already 0..1, convert to percentage
      ctx.fillText(`${(hoverPoint.price * 100).toFixed(1)}%`, hoverPoint.x, hoverPoint.y - 6);
    }

    // Draw current price indicator (subtle)
    if (currentProbability !== null && filteredHistory.length > 0) {
      const lastPoint = filteredHistory[filteredHistory.length - 1];
      const x = padding + ((lastPoint.timestamp - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((lastPoint.price - (minPrice - pricePadding)) / priceRange) * chartHeight;
      
      ctx.fillStyle = '#00B8A3';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [filteredHistory, currentProbability, hoverPoint]);
  
  // Log chart state for debugging
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log('[PolymarketSignal] Chart state:', {
        totalHistoryPoints: history.length,
        filteredPoints: filteredHistory.length,
        timeframe,
        hasCurrentProbability: currentProbability !== null,
        chartWillRender: filteredHistory.length >= 1,
      });
    }
  }, [history.length, filteredHistory.length, timeframe, currentProbability]);

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
    const prices = filteredHistory.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const pricePadding = (maxPrice - minPrice) * 0.1 || 1;
    const priceRange = (maxPrice - minPrice + pricePadding * 2) || 1;
    const minTime = filteredHistory[0].timestamp;
    const maxTime = filteredHistory[filteredHistory.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1;
    
    const timeAtX = minTime + ((x - padding) / chartWidth) * timeRange;
    const priceAtY = maxPrice + pricePadding - ((y - padding) / chartHeight) * priceRange;
    
    // Find closest point
    let closest: PricePoint | null = null;
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
      const pointY = padding + chartHeight - ((closest.price - (minPrice - pricePadding)) / priceRange) * chartHeight;
      
      setHoverPoint({
        x: pointX,
        y: pointY,
        price: closest.price,
        time: closest.timestamp,
      });
    }
  };

  const lastUpdateTime = useMemo(() => {
    // Use latest history point timestamp if available, otherwise use current time
    if (history.length > 0) {
      return new Date(history[history.length - 1].timestamp).toISOString();
    }
    if (currentPrice !== null) {
      return new Date().toISOString();
    }
    return null;
  }, [history, currentPrice]);

  // Compute provenance status based on data freshness
  const provenanceStatus = useMemo((): ProvenanceStatus => {
    if (!lastUpdateTime) return 'STALE';
    const ageMs = Date.now() - new Date(lastUpdateTime).getTime();
    if (ageMs < 2 * 60 * 1000) return 'LIVE';      // < 2 minutes
    if (ageMs < 10 * 60 * 1000) return 'DEGRADED'; // < 10 minutes
    return 'STALE';
  }, [lastUpdateTime]);

  const lastUpdateTimestamp = useMemo(() => {
    if (!lastUpdateTime) return null;
    return new Date(lastUpdateTime).getTime();
  }, [lastUpdateTime]);

  return (
    <div ref={containerRef} className="border-t border-white/10 glass-subtle">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-white/10">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white mb-0.5 font-mono tracking-wide">
              NARRATIVE TRACKER
            </div>
            <div className="text-caption text-gray-600 font-mono">
              Polymarket / Tesla Optimus Release
              {DEBUG_MODE && (
                <span className="ml-2 text-gray-700 text-[9px]">
                  (Token: {yesTokenId.substring(0, 20)}...)
                </span>
              )}
            </div>
          </div>
          
          {/* P(Yes) value - medium size, not huge */}
          {currentProbability !== null && (
            <div className="text-right flex-shrink-0">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider font-mono mb-0.5">
                P(Yes)
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">
                {currentProbability.toFixed(1)}%
              </div>
              {DEBUG_MODE && (
                <div className="text-[9px] text-gray-700 font-mono mt-0.5">
                  {history.length > 0 ? (
                    <>Latest: {(history[history.length - 1].price * 100).toFixed(2)}%</>
                  ) : currentPrice !== null ? (
                    <>Price: {(currentPrice * 100).toFixed(2)}%</>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Meta stats - below header */}
        {currentProbability !== null && (
          <div className="flex items-center justify-between gap-4 text-caption font-mono text-gray-500 pt-2 border-t border-white/10">
            <div className="flex items-center gap-4">
              {change24h !== null && (
                <div>
                  <span className="text-gray-600">Δ 24h:</span>{' '}
                  <span className={change24h >= 0 ? 'text-accent' : 'text-red-400'}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(1)}pp
                  </span>
                </div>
              )}
            </div>
            {lastUpdateTime && (
              <div className="text-gray-600">
                {new Date(lastUpdateTime).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading && currentPrice === null ? (
          <div className="space-y-2">
            <div className="h-6 bg-gray-800/50 animate-pulse" />
            <div className="h-20 bg-gray-800/50 animate-pulse" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="text-xs text-red-400 font-mono">
              {error.includes('Upstream') || error.includes('fetch failed') || error.includes('timeout') 
                ? 'Signal unavailable (upstream fetch failed)' 
                : error}
            </div>
            {(error.includes('Upstream') || error.includes('fetch failed') || error.includes('timeout')) && yesTokenId && (
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  Promise.all([
                    fetchCurrentPrice(yesTokenId),
                    fetchPriceHistory(yesTokenId, '1d', '60'),
                  ])
                    .then(([price, priceHistory]) => {
                      if (price !== null) {
                        setCurrentPrice(price);
                        setError(null);
                      } else {
                        setError('Price unavailable');
                      }
                      if (priceHistory.length > 0) {
                        setHistory(priceHistory);
                      }
                    })
                    .catch((err) => {
                      const errorMsg = err.message || 'Failed to load data';
                      if (errorMsg.includes('Upstream') || errorMsg.includes('fetch failed') || errorMsg.includes('timeout')) {
                        setError('Signal unavailable (upstream fetch failed)');
                      } else {
                        setError(errorMsg);
                      }
                    })
                    .finally(() => {
                      setLoading(false);
                    });
                }}
                className="text-caption px-2 py-1 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors font-mono"
              >
                Retry
              </button>
            )}
          </div>
        ) : currentProbability !== null ? (
          <>
            {/* Chart */}
            {filteredHistory.length === 0 ? (
              <div className="relative bg-[#0D1015] border border-white/10" style={{ height: '140px' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-600 font-mono">No history yet — collecting...</div>
                    {history.length === 0 && (
                      <div className="text-[9px] text-gray-700 font-mono mt-1">Waiting for first data point</div>
                    )}
                  </div>
                </div>
              </div>
            ) : filteredHistory.length === 1 ? (
              <div className="relative bg-[#0D1015] border border-white/10" style={{ height: '140px' }}>
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverPoint(null)}
                  className="w-full cursor-crosshair"
                  style={{ height: '140px' }}
                />
                <div className="absolute bottom-2 left-2 text-[9px] text-gray-700 font-mono">
                  Collecting...
                </div>
              </div>
            ) : (
              <div className="relative bg-[#0D1015] border border-gray-800">
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverPoint(null)}
                  className="w-full cursor-crosshair"
                  style={{ height: '140px' }}
                />
                {filteredHistory.length < history.length && (
                  <div className="absolute top-2 right-2 text-[9px] text-gray-700 font-mono">
                    Showing all data
                  </div>
                )}
              </div>
            )}


          </>
        ) : currentProbability === null ? (
          <div className="space-y-1">
            <div className="text-xs text-red-400 font-mono">
              {!yesTokenId ? 'Signal misconfigured' : 'Signal unavailable'}
            </div>
            <div className="text-[10px] text-gray-600 font-mono">
              {!yesTokenId ? 'YES_TOKEN_ID not configured' : 'Unable to fetch price data'}
            </div>
          </div>
        ) : null}
      </div>

      {/* Provenance footer */}
      <ProvenanceRow
        sourceLabel="Polymarket CLOB"
        updatedAt={lastUpdateTimestamp}
        status={provenanceStatus}
      />
    </div>
  );
}

