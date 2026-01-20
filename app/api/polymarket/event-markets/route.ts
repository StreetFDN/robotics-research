import { NextRequest, NextResponse } from 'next/server';
import { buildConfidenceMeta } from '@/utils/confidence';

// Force Node.js runtime (not Edge) for reliable fetch
export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CACHE_TTL_MS = 30000; // 30 seconds server-side cache

// Simple in-memory cache (edge-safe)
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Rate limiting: track last request time per slug
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL_MS = 2000; // Minimum 2 seconds between requests for same slug

// Robust fetch wrapper with retries and diagnostics
async function robustFetch(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<{ response: Response | null; error: any; diagnostics: any }> {
  const diagnostics: any = {
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    attempt: 0,
    errors: [],
  };

  const maxAttempts = retries + 1;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    diagnostics.attempt = attempt + 1;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const fetchOptions: RequestInit = {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json,text/plain,*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers,
        },
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Check if we should retry
      if (!response.ok && attempt < retries) {
        const status = response.status;
        // Retry for transient errors (429, 502, 503, 504)
        if (status === 429 || status === 502 || status === 503 || status === 504) {
          const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
          diagnostics.errors.push({
            attempt: attempt + 1,
            status,
            statusText: response.statusText,
            willRetry: true,
            backoffMs,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      diagnostics.finalStatus = response.status;
      diagnostics.finalStatusText = response.statusText;
      return { response, error: null, diagnostics };
    } catch (error: any) {
      lastError = error;
      diagnostics.errors.push({
        attempt: attempt + 1,
        errorName: error.name,
        errorMessage: error.message,
        willRetry: attempt < retries && error.name !== 'AbortError',
      });

      // Don't retry on abort/timeout if it's the last attempt
      if (attempt < retries && error.name !== 'AbortError') {
        const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  diagnostics.finalError = lastError;
  return { response: null, error: lastError, diagnostics };
}

// Helper to normalize outcomes and outcomePrices
function normalizeMarketData(market: any) {
  let outcomes: string[] = [];
  let outcomePrices: Record<string, string> = {};

  try {
    // Parse outcomes (may be string or array)
    if (typeof market.outcomes === 'string') {
      outcomes = JSON.parse(market.outcomes);
    } else if (Array.isArray(market.outcomes)) {
      outcomes = market.outcomes;
    } else if (market.outcomes) {
      outcomes = Object.keys(market.outcomes);
    }

    // Ensure outcomes is an array of strings
    if (!Array.isArray(outcomes)) {
      outcomes = [];
    } else {
      outcomes = (outcomes as unknown[]).map((o) => {
        if (typeof o === 'string') return o;
        if (typeof o === 'object' && o !== null && 'title' in o) return String((o as { title: unknown }).title);
        return String(o);
      });
    }

    // Parse outcomePrices (may be string, array, or object)
    if (typeof market.outcomePrices === 'string') {
      try {
        const parsed = JSON.parse(market.outcomePrices);
        if (Array.isArray(parsed)) {
          if (parsed.length === outcomes.length) {
            outcomePrices = {};
            outcomes.forEach((outcome, idx) => {
              outcomePrices[outcome] = String(parsed[idx] || '0');
            });
          } else {
            outcomePrices = {};
            outcomes.forEach((outcome) => {
              outcomePrices[outcome] = '0';
            });
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          outcomePrices = parsed;
        }
      } catch {
        outcomePrices = {};
      }
    } else if (Array.isArray(market.outcomePrices)) {
      if (market.outcomePrices.length === outcomes.length) {
        outcomePrices = {};
        outcomes.forEach((outcome, idx) => {
          outcomePrices[outcome] = String(market.outcomePrices[idx] || '0');
        });
      } else {
        outcomePrices = {};
        outcomes.forEach((outcome) => {
          outcomePrices[outcome] = '0';
        });
      }
    } else if (typeof market.outcomePrices === 'object' && market.outcomePrices !== null) {
      outcomePrices = market.outcomePrices;
    }

    // Validate: ensure outcomes and outcomePrices are consistent
    if (outcomes.length === 0) {
      if (Object.keys(outcomePrices).length > 0) {
        outcomes = Object.keys(outcomePrices);
      }
    }

    // Ensure all outcomes have prices (default to '0')
    outcomes.forEach((outcome) => {
      if (!(outcome in outcomePrices)) {
        outcomePrices[outcome] = '0';
      }
    });
  } catch (parseError) {
    console.error('[Polymarket Proxy] Failed to parse outcomes/outcomePrices:', parseError);
    outcomes = [];
    outcomePrices = {};
  }

  return {
    slug: market.slug || '',
    question: market.question || market.title || 'Unknown Market',
    outcomes,
    outcomePrices,
    liquidity: String(market.liquidity || market.totalLiquidity || '0'),
    volume: String(market.volume || market.totalVolume || '0'),
    id: market.id || market.marketId || '',
  };
}

// Helper to pick the best Yes/No market from an array
function pickBestYesNoMarket(markets: any[]): any | null {
  if (!markets || markets.length === 0) return null;

  // Filter for Yes/No markets
  const yesNoMarkets = markets.filter((m) => {
    const normalized = normalizeMarketData(m);
    const outcomes = normalized.outcomes.map((o) => o.toLowerCase());
    return (
      outcomes.includes('yes') &&
      outcomes.includes('no') &&
      outcomes.length === 2
    );
  });

  if (yesNoMarkets.length === 0) {
    // No Yes/No markets, return the one with highest liquidity
    return markets.sort((a, b) => {
      const liqA = parseFloat(String(a.liquidity || a.totalLiquidity || '0'));
      const liqB = parseFloat(String(b.liquidity || b.totalLiquidity || '0'));
      return liqB - liqA;
    })[0];
  }

  // Among Yes/No markets, pick the one with highest liquidity
  return yesNoMarkets.sort((a, b) => {
    const liqA = parseFloat(String(a.liquidity || a.totalLiquidity || '0'));
    const liqB = parseFloat(String(b.liquidity || b.totalLiquidity || '0'));
    return liqB - liqA;
  })[0];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventSlug = searchParams.get('slug');

  if (!eventSlug) {
    return NextResponse.json(
      { ok: false, error: 'Missing slug parameter' },
      { status: 400 }
    );
  }

  // Check server-side cache first
  let cached = cache.get(eventSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, ...cached.data });
  }

  // Rate limiting
  const lastRequest = lastRequestTime.get(eventSlug);
  const now = Date.now();
  if (lastRequest && now - lastRequest < MIN_REQUEST_INTERVAL_MS) {
    if (cached) {
      return NextResponse.json({ ok: true, ...cached.data });
    }
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - (now - lastRequest)));
  }

  lastRequestTime.set(eventSlug, now);

  try {
    // Step 1: Fetch event by slug
    const eventUrl = `${GAMMA_API_BASE}/events?slug=${encodeURIComponent(eventSlug)}`;
    console.log('[Polymarket Proxy] Fetching event:', eventUrl);

    const { response: eventResponse, error: eventError, diagnostics: eventDiagnostics } = await robustFetch(eventUrl);

    if (eventError || !eventResponse) {
      const errorDetails: any = {
        ok: false,
        error: 'Upstream fetch failed',
        eventSlug,
        upstreamUrl: eventUrl,
        diagnostics: {
          ...eventDiagnostics,
          errorName: eventError?.name,
          errorMessage: eventError?.message,
          errorCause: eventError?.cause ? String(eventError.cause) : undefined,
          errorStack: eventError?.stack?.substring(0, 500),
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket Proxy] Event fetch failed:', errorDetails);
      return NextResponse.json(errorDetails, { status: 502 });
    }

    if (!eventResponse.ok) {
      const responseText = await eventResponse.text().catch(() => '');
      const errorDetails: any = {
        ok: false,
        error: eventResponse.status === 404 ? 'Event not found' : 'Upstream error',
        eventSlug,
        upstreamStatus: eventResponse.status,
        upstreamStatusText: eventResponse.statusText,
        upstreamUrl: eventUrl,
        upstreamResponseText: responseText.substring(0, 1000),
        diagnostics: {
          ...eventDiagnostics,
          nodeVersion: process.version,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket Proxy] Event fetch failed:', errorDetails);
      return NextResponse.json(errorDetails, { status: eventResponse.status === 404 ? 404 : 502 });
    }

    const eventData = await eventResponse.json().catch((parseError) => {
      console.error('[Polymarket Proxy] Failed to parse event response:', parseError);
      return null;
    });

    if (!eventData) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid event response',
          eventSlug,
          upstreamUrl: eventUrl,
          diagnostics: {
            ...eventDiagnostics,
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 502 }
      );
    }
    
    // Gamma API may return an array or a single object
    let event = Array.isArray(eventData) ? eventData[0] : eventData;
    if (Array.isArray(event) && event.length > 0) {
      event = event[0];
    }

    if (!event) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Event not found',
          eventSlug,
          upstreamStatus: eventResponse.status,
          upstreamUrl: eventUrl,
        },
        { status: 404 }
      );
    }

    const eventId = event.id || event.eventId;
    const eventTitle = event.title || event.question || 'Unknown Event';

    // Step 2: Get markets for this event
    // Check if event response already contains markets
    let markets: any[] = [];

    if (event.markets && Array.isArray(event.markets) && event.markets.length > 0) {
      markets = event.markets;
    } else if (eventId) {
      // Fetch markets by event_id
      const marketsUrl = `${GAMMA_API_BASE}/markets?event_id=${encodeURIComponent(eventId)}`;
      console.log('[Polymarket Proxy] Fetching markets:', marketsUrl);

      const { response: marketsResponse, error: marketsError, diagnostics: marketsDiagnostics } = await robustFetch(marketsUrl);

      if (marketsError || !marketsResponse) {
        const errorDetails: any = {
          ok: false,
          error: 'Upstream fetch failed',
          eventSlug,
          eventId,
          upstreamUrl: marketsUrl,
          diagnostics: {
            ...marketsDiagnostics,
            errorName: marketsError?.name,
            errorMessage: marketsError?.message,
            errorCause: marketsError?.cause ? String(marketsError.cause) : undefined,
            errorStack: marketsError?.stack?.substring(0, 500),
            nodeVersion: process.version,
            nodePlatform: process.platform,
            timestamp: new Date().toISOString(),
          },
        };

        console.error('[Polymarket Proxy] Markets fetch failed:', errorDetails);
        return NextResponse.json(errorDetails, { status: 502 });
      }

      if (!marketsResponse.ok) {
        const responseText = await marketsResponse.text().catch(() => '');
        const errorDetails: any = {
          ok: false,
          error: 'Upstream error',
          eventSlug,
          eventId,
          upstreamStatus: marketsResponse.status,
          upstreamStatusText: marketsResponse.statusText,
          upstreamUrl: marketsUrl,
          upstreamResponseText: responseText.substring(0, 1000),
          diagnostics: {
            ...marketsDiagnostics,
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
          },
        };

        console.error('[Polymarket Proxy] Markets fetch failed:', errorDetails);
        return NextResponse.json(errorDetails, { status: 502 });
      }

      const marketsData = await marketsResponse.json();
      markets = Array.isArray(marketsData) ? marketsData : [marketsData];
    }

    if (markets.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No markets found for event',
          eventSlug,
          eventId,
        },
        { status: 404 }
      );
    }

    // Step 3: Pick the best Yes/No market
    const selectedMarket = pickBestYesNoMarket(markets);

    if (!selectedMarket) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No suitable market found',
          eventSlug,
          eventId,
          marketCount: markets.length,
        },
        { status: 404 }
      );
    }

    // Step 4: Normalize market data
    const marketData = normalizeMarketData(selectedMarket);

    const result = {
      event: {
        id: eventId,
        title: eventTitle,
        slug: eventSlug,
      },
      market: marketData,
      _meta: buildConfidenceMeta(
        { eventId, eventTitle, eventSlug, market: marketData },
        'Polymarket Gamma API'
      ),
    };

    // Cache the result
    cache.set(eventSlug, { data: result, timestamp: now });

    // Clean up old cache entries
    if (cache.size > 100) {
      const cutoff = now - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[Polymarket Proxy] Fetch error:', error);

    // Return cached data if available, even if expired
    if (cached) {
      return NextResponse.json({ ok: true, ...cached.data });
    }

    // Return structured error with diagnostics
    const errorDetails: any = {
      ok: false,
      error: 'Upstream fetch failed',
      eventSlug,
      details: error.message || 'Unknown error',
      diagnostics: {
        errorName: error.name,
        errorMessage: error.message,
        errorCause: error.cause ? String(error.cause) : undefined,
        errorStack: error.stack?.substring(0, 500),
        nodeVersion: process.version,
        nodePlatform: process.platform,
        timestamp: new Date().toISOString(),
      },
    };

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorDetails.error = 'Upstream fetch timeout';
      errorDetails.details = 'Request to Gamma API timed out';
      return NextResponse.json(errorDetails, { status: 504 });
    }

    return NextResponse.json(errorDetails, { status: 502 });
  }
}

