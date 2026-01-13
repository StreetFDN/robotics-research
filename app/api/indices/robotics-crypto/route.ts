import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Force Node.js runtime (not Edge) for reliable fetch
export const runtime = 'nodejs';

const COINGECKO_API_BASE = 'https://pro-api.coingecko.com/api/v3';
const CACHE_TTL_MS = 60000; // 60 seconds server-side cache
const FETCH_TIMEOUT_MS = 15000; // 15 seconds timeout (increased from 8s)

// Robotics crypto token universe
const ROBOTICS_TOKENS = [
  { id: 'virtuals-protocol', symbol: 'VIRTUAL', name: 'Virtuals Protocol' },
  { id: 'iotex', symbol: 'IOTX', name: 'IoTeX' },
  { id: 'geodnet', symbol: 'GEOD', name: 'Geodnet' },
  { id: 'peaq-network', symbol: 'PEAQ', name: 'peaq' },
  { id: 'auki-labs', symbol: 'AUKI', name: 'Auki' },
];

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Robust fetch wrapper with timeout and retry
async function robustFetch(
  url: string,
  apiKey: string,
  retries = 2
): Promise<{ response: Response | null; error: any }> {
  const maxAttempts = retries + 1;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`[RoboticsCryptoIndex] Fetch attempt ${attempt + 1}/${maxAttempts}:`, url.substring(0, 100) + '...');

      // Use https module directly to work around Node.js fetch timeout issues
      // This is a workaround for network connectivity problems with Node.js fetch
      const urlObj = new URL(url);
      const response = await new Promise<{ status: number; statusText: string; body: string; headers: Record<string, string> }>((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'x-cg-pro-api-key': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'RoboticsIntelligence/1.0',
          },
          // Force IPv4 only to avoid IPv6 connectivity issues
          family: 4,
          timeout: FETCH_TIMEOUT_MS,
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 200,
              statusText: res.statusMessage || 'OK',
              body: data,
              headers: res.headers as Record<string, string>,
            });
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });

      // Convert to Response-like object
      const fetchResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // Log response status
      console.log(`[RoboticsCryptoIndex] Response status: ${fetchResponse.status} ${fetchResponse.statusText}`);

      // Retry for transient errors
      if (!fetchResponse.ok && attempt < retries) {
        const status = response.status;
        if (status === 429 || status === 502 || status === 503 || status === 504) {
          const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
          console.log(`[RoboticsCryptoIndex] Retrying after ${backoffMs}ms due to status ${status}`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      return { response: fetchResponse, error: null };
    } catch (error: any) {
      lastError = error;
      const errorCause = error.cause;
      const errorCode = errorCause?.code || error.code;
      
      console.error(`[RoboticsCryptoIndex] Fetch attempt ${attempt + 1} failed:`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode,
        errorCause: errorCause?.message || errorCause?.code,
        url: url.substring(0, 100),
      });
      
      // Don't retry on timeout/network errors - they indicate network issues
      if (errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorCode === 'EHOSTUNREACH') {
        console.error(`[RoboticsCryptoIndex] Network error (${errorCode}), not retrying`);
        break;
      }
      
      if (attempt < retries && error.name !== 'AbortError') {
        const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
        console.log(`[RoboticsCryptoIndex] Retrying after ${backoffMs}ms due to error`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  return { response: null, error: lastError };
}

// Calculate market-cap weighted index with caps
function calculateIndexWeights(marketData: Array<{ id: string; market_cap: number }>): Array<{ id: string; weight: number }> {
  const totalMarketCap = marketData.reduce((sum, token) => sum + (token.market_cap || 0), 0);
  
  if (totalMarketCap === 0) {
    return marketData.map((token) => ({ id: token.id, weight: 1 / marketData.length }));
  }
  
  const initialWeights = marketData.map((token) => ({
    id: token.id,
    weight: (token.market_cap || 0) / totalMarketCap,
  }));
  
  const MAX_WEIGHT = 0.20;
  const MIN_WEIGHT = 0.02;
  
  // First pass: cap at max
  let cappedWeights = initialWeights.map((w) => ({
    id: w.id,
    weight: Math.min(w.weight, MAX_WEIGHT),
  }));
  
  // Redistribute excess
  const totalCapped = cappedWeights.reduce((sum, w) => sum + w.weight, 0);
  const excess = 1 - totalCapped;
  
  if (excess > 0) {
    const tokensBelowMax = cappedWeights.filter((w) => {
      const original = initialWeights.find((iw) => iw.id === w.id);
      return original && original.weight < MAX_WEIGHT;
    });
    
    if (tokensBelowMax.length > 0) {
      const totalBelowMax = tokensBelowMax.reduce((sum, w) => {
        const original = initialWeights.find((iw) => iw.id === w.id);
        return sum + (original?.weight || 0);
      }, 0);
      
      tokensBelowMax.forEach((w) => {
        const original = initialWeights.find((iw) => iw.id === w.id);
        if (original && totalBelowMax > 0) {
          w.weight += (excess * original.weight) / totalBelowMax;
        }
      });
    }
  }
  
  // Ensure minimum weight
  cappedWeights = cappedWeights.map((w) => ({
    id: w.id,
    weight: Math.max(w.weight, MIN_WEIGHT),
  }));
  
  // Normalize to sum to 1
  const finalTotal = cappedWeights.reduce((sum, w) => sum + w.weight, 0);
  if (finalTotal > 0) {
    cappedWeights = cappedWeights.map((w) => ({
      id: w.id,
      weight: w.weight / finalTotal,
    }));
  }
  
  return cappedWeights;
}

// Calculate index value (base 100)
function calculateIndexValue(
  historicalPrices: Array<{ timestamp: number; prices: Record<string, number> }>,
  weights: Array<{ id: string; weight: number }>
): Array<{ t: number; v: number }> {
  if (historicalPrices.length === 0) return [];
  
  // Find first valid point (all tokens have prices)
  let baseTimestamp: number | null = null;
  let basePrices: Record<string, number> = {};
  
  for (const point of historicalPrices) {
    const hasAllPrices = weights.every((w) => point.prices[w.id] != null && point.prices[w.id] > 0);
    if (hasAllPrices) {
      baseTimestamp = point.timestamp;
      basePrices = { ...point.prices };
      break;
    }
  }
  
  if (!baseTimestamp) {
    const firstPoint = historicalPrices[0];
    baseTimestamp = firstPoint.timestamp;
    basePrices = { ...firstPoint.prices };
  }
  
  // Calculate index for each point
  return historicalPrices.map((point) => {
    let weightedSum = 0;
    let totalWeight = 0;
    
    weights.forEach((w) => {
      const price = point.prices[w.id];
      const basePrice = basePrices[w.id];
      
      if (price != null && price > 0 && basePrice != null && basePrice > 0) {
        const relativePrice = price / basePrice;
        weightedSum += relativePrice * w.weight;
        totalWeight += w.weight;
      }
    });
    
    const indexValue = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 100;
    
    return {
      t: point.timestamp,
      v: indexValue,
    };
  });
}

// Get date range for historical data
function getDateRange(range: string): number {
  switch (range) {
    case '1Y':
      return 365;
    case '6M':
      return 180;
    case '3M':
      return 90;
    case '1M':
      return 30;
    case 'YTD':
      const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      return Math.ceil((Date.now() - yearStart) / (1000 * 60 * 60 * 24));
    default:
      return 90;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '3M';
  
  // Check cache
  const cacheKey = `robotics-crypto-${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, ...cached.data });
  }
  
  // Validate API key
  const apiKey = process.env.COINGECKO_PRO_API_KEY;
  const hasApiKey = !!apiKey && apiKey.trim().length > 0;
  
  // Log once server-side (only log presence, not the key itself)
  console.log('[RoboticsCryptoIndex] CoinGecko key present:', hasApiKey);
  
  if (!hasApiKey) {
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Index unavailable',
        step: 'env_validation',
        details: 'Missing COINGECKO_PRO_API_KEY environment variable',
      },
      { status: 200 }
    );
  }
  
  try {
    // Step 1: Fetch current market data
    const tokenIds = ROBOTICS_TOKENS.map((t) => t.id).join(',');
    // Build URL with proper encoding
    const marketsUrl = new URL(`${COINGECKO_API_BASE}/coins/markets`);
    marketsUrl.searchParams.set('ids', tokenIds);
    marketsUrl.searchParams.set('vs_currency', 'usd');
    marketsUrl.searchParams.set('order', 'market_cap_desc');
    marketsUrl.searchParams.set('per_page', '100');
    marketsUrl.searchParams.set('page', '1');
    marketsUrl.searchParams.set('sparkline', 'false');
    
    const marketsUrlString = marketsUrl.toString();
    
    console.log('[RoboticsCryptoIndex] Fetching markets:', {
      url: marketsUrlString,
      tokenCount: ROBOTICS_TOKENS.length,
      tokenIds,
      apiKeyPrefix: apiKey?.substring(0, 5) + '...',
    });
    
    const { response: marketsResponse, error: marketsError } = await robustFetch(marketsUrlString, apiKey);
    
    if (marketsError || !marketsResponse) {
      const errorText = marketsError?.message || 'Unknown fetch error';
      const errorName = marketsError?.name || 'UnknownError';
      const errorCode = marketsError?.code;
      
      // Provide more helpful error messages
      let userFriendlyError = errorText;
      if (errorName === 'AbortError' || errorCode === 'ETIMEDOUT') {
        userFriendlyError = 'Request timed out - CoinGecko API may be slow or unavailable';
      } else if (errorName === 'TypeError' && errorText.includes('fetch')) {
        userFriendlyError = 'Network error - unable to reach CoinGecko API';
      } else if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED') {
        userFriendlyError = 'Connection error - unable to connect to CoinGecko API';
      }
      
      console.error('[RoboticsCryptoIndex] Markets fetch failed:', {
        errorName,
        errorCode,
        errorMessage: errorText,
        url: marketsUrl,
        hasApiKey: hasApiKey,
        apiKeyLength: apiKey?.length || 0,
      });
      
      if (cached) {
        console.log('[RoboticsCryptoIndex] Returning cached data due to fetch failure');
        return NextResponse.json({ ok: true, ...cached.data });
      }
      
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'fetch_markets',
        details: userFriendlyError,
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    if (!marketsResponse.ok) {
      const errorText = await marketsResponse.text().catch(() => '');
      const bodyPreview = errorText.substring(0, 500);
      
      console.error('[RoboticsCryptoIndex] Markets API error:', {
        status: marketsResponse.status,
        statusText: marketsResponse.statusText,
        url: marketsUrl,
        bodyPreview,
      });
      
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'fetch_markets',
        details: `HTTP ${marketsResponse.status}: ${marketsResponse.statusText}`,
        upstreamStatus: marketsResponse.status,
        upstreamBodyPreview: bodyPreview,
      }, { status: 200 });
    }
    
    const marketsData = await marketsResponse.json();
    
    if (!Array.isArray(marketsData)) {
      console.error('[RoboticsCryptoIndex] Markets data is not an array');
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'parse_markets',
        details: 'Expected array but got ' + typeof marketsData,
        upstreamStatus: marketsResponse.status,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    // Step 2: Calculate weights from market caps
    const marketCapData = ROBOTICS_TOKENS.map((token) => {
      const marketInfo = marketsData.find((m: any) => m.id === token.id);
      return {
        id: token.id,
        market_cap: marketInfo?.market_cap || 0,
      };
    });
    
    const tokensWithData = marketCapData.filter((d) => d.market_cap > 0);
    if (tokensWithData.length < 2) {
      console.warn(`[RoboticsCryptoIndex] Only ${tokensWithData.length} tokens have market cap data`);
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'calculate_weights',
        details: `Only ${tokensWithData.length} of ${ROBOTICS_TOKENS.length} tokens have market data`,
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    const weights = calculateIndexWeights(marketCapData);
    
    // Step 3: Fetch historical prices
    const days = getDateRange(range);
    const historicalPromises = ROBOTICS_TOKENS.map(async (token) => {
      try {
        const historyUrl = `${COINGECKO_API_BASE}/coins/${token.id}/market_chart?vs_currency=usd&days=${days}`;
        const { response: historyResponse, error: historyError } = await robustFetch(historyUrl, apiKey);
        
        if (historyError || !historyResponse || !historyResponse.ok) {
          const errorText = historyError?.message || `HTTP ${historyResponse?.status || 'unknown'}`;
          console.warn(`[RoboticsCryptoIndex] Failed to fetch history for ${token.id}:`, errorText);
          return { id: token.id, prices: [] };
        }
        
        const historyData = await historyResponse.json();
        
        if (!historyData || !historyData.prices || !Array.isArray(historyData.prices)) {
          console.warn(`[RoboticsCryptoIndex] Invalid history data format for ${token.id}`);
          return { id: token.id, prices: [] };
        }
        
        const prices = historyData.prices
          .map(([timestamp, price]: [number, number]) => ({
            timestamp,
            price: typeof price === 'number' ? price : parseFloat(String(price)) || 0,
          }))
          .filter((p: { timestamp: number; price: number }) => p.price > 0);
        
        return { id: token.id, prices };
      } catch (error: any) {
        console.warn(`[RoboticsCryptoIndex] Error fetching history for ${token.id}:`, error.message);
        return { id: token.id, prices: [] };
      }
    });
    
    const historicalData = await Promise.all(historicalPromises);
    
    // Step 4: Check sufficient historical data
    const tokensWithHistory = historicalData.filter((d) => d.prices.length > 0);
    if (tokensWithHistory.length < 2) {
      console.warn(`[RoboticsCryptoIndex] Only ${tokensWithHistory.length} tokens have historical data`);
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'fetch_history',
        details: `Only ${tokensWithHistory.length} of ${ROBOTICS_TOKENS.length} tokens have price history`,
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    // Step 5: Combine historical prices by timestamp (daily alignment)
    const allTimestamps = new Set<number>();
    historicalData.forEach((tokenData) => {
      tokenData.prices.forEach((p: { timestamp: number }) => {
        allTimestamps.add(p.timestamp);
      });
    });
    
    if (allTimestamps.size === 0) {
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'combine_prices',
        details: 'No timestamps found in historical data',
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    // Group by day (normalize to midnight UTC)
    const dailyTimestamps = new Map<number, number>();
    Array.from(allTimestamps).sort((a, b) => a - b).forEach((ts) => {
      const day = Math.floor(ts / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
      if (!dailyTimestamps.has(day)) {
        dailyTimestamps.set(day, ts);
      }
    });
    
    const combinedPrices = Array.from(dailyTimestamps.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayTimestamp]) => {
        const prices: Record<string, number> = {};
        historicalData.forEach((tokenData) => {
          // Find closest price for this day
          let closest: { timestamp: number; price: number } | null = null;
          let minDiff = Infinity;
          
          tokenData.prices.forEach((p: { timestamp: number; price: number }) => {
            const pDay = Math.floor(p.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
            const diff = Math.abs(pDay - dayTimestamp);
            if (diff < minDiff) {
              minDiff = diff;
              closest = p as { timestamp: number; price: number };
            }
          });
          
          if (closest !== null && minDiff < 24 * 60 * 60 * 1000) {
            prices[tokenData.id] = (closest as { timestamp: number; price: number }).price;
          }
        });
        
        return { timestamp: dayTimestamp, prices };
      })
      .filter((point) => Object.keys(point.prices).length > 0);
    
    if (combinedPrices.length === 0) {
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'combine_prices',
        details: 'No aligned price points found',
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    // Step 6: Calculate index values
    const indexPoints = calculateIndexValue(combinedPrices, weights);
    
    if (indexPoints.length === 0) {
      if (cached) {
        return NextResponse.json({ ok: true, ...cached.data });
      }
      return NextResponse.json({
        ok: false,
        error: 'Index unavailable',
        step: 'calculate_index',
        details: 'No index points calculated',
        upstreamStatus: null,
        upstreamBodyPreview: null,
      }, { status: 200 });
    }
    
    // Step 7: Calculate current value and change
    const currentValue = indexPoints[indexPoints.length - 1].v;
    const value24hAgo = indexPoints.length >= 2 
      ? indexPoints[indexPoints.length - 2].v 
      : currentValue;
    const changeAbs = currentValue - value24hAgo;
    const changePct = value24hAgo > 0 ? (changeAbs / value24hAgo) * 100 : 0;
    
    // Step 8: Build response
    const result = {
      ok: true,
      indexName: 'Robotics Crypto Index',
      base: 100,
      range,
      points: indexPoints,
      constituents: weights.map((w) => {
        const token = ROBOTICS_TOKENS.find((t) => t.id === w.id);
        return {
          id: w.id,
          symbol: token?.symbol || '',
          weight: w.weight,
        };
      }),
      last: {
        v: currentValue,
        changeAbs,
        changePct,
      },
      // Legacy format for backward compatibility
      index: indexPoints.map((p) => ({ timestamp: p.t, value: p.v })),
      currentValue,
      dayChange: changeAbs,
      dayChangePercent: changePct,
      weights: weights.map((w) => {
        const token = ROBOTICS_TOKENS.find((t) => t.id === w.id);
        return {
          id: w.id,
          symbol: token?.symbol || '',
          name: token?.name || '',
          weight: w.weight,
        };
      }),
      tokens: ROBOTICS_TOKENS.map((token) => {
        const marketInfo = marketsData.find((m: any) => m.id === token.id);
        return {
          id: token.id,
          symbol: token.symbol,
          name: token.name,
          price: marketInfo?.current_price || 0,
          marketCap: marketInfo?.market_cap || 0,
          change24h: marketInfo?.price_change_percentage_24h || 0,
        };
      }),
    };
    
    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    // Clean up old cache entries
    if (cache.size > 50) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[RoboticsCryptoIndex] Uncaught error:', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack?.substring(0, 500),
    });
    
    if (cached) {
      return NextResponse.json({ ok: true, ...cached.data });
    }
    
    return NextResponse.json({
      ok: false,
      error: 'Index unavailable',
      step: 'unknown',
      details: error.message || 'Unknown error',
      upstreamStatus: null,
      upstreamBodyPreview: null,
    }, { status: 200 });
  }
}
