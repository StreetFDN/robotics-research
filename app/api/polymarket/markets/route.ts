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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: 'Missing slug parameter' },
      { status: 400 }
    );
  }

  // Check server-side cache first
  let cached = cache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, data: cached.data });
  }

  // Rate limiting: prevent rapid repeated fetches
  const lastRequest = lastRequestTime.get(slug);
  const now = Date.now();
  if (lastRequest && now - lastRequest < MIN_REQUEST_INTERVAL_MS) {
    // Return cached data even if expired, to prevent rate limit issues
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }
    // If no cache, wait a bit (this shouldn't happen in practice)
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - (now - lastRequest)));
  }

  lastRequestTime.set(slug, now);

  // Robust fetch wrapper with retries
  async function robustFetch(
    url: string,
    retries = 2
  ): Promise<{ response: Response | null; error: any }> {
    const maxAttempts = retries + 1;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json,text/plain,*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        clearTimeout(timeoutId);

        // Retry for transient errors
        if (!response.ok && attempt < retries) {
          const status = response.status;
          if (status === 429 || status === 502 || status === 503 || status === 504) {
            const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
        }

        return { response, error: null };
      } catch (error: any) {
        lastError = error;
        if (attempt < retries && error.name !== 'AbortError') {
          const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }
    }

    return { response: null, error: lastError };
  }

  try {
    // Fetch from Gamma API
    const marketUrl = `${GAMMA_API_BASE}/markets?slug=${encodeURIComponent(slug)}`;
    const { response, error: fetchError } = await robustFetch(marketUrl);

    if (fetchError || !response) {
      const errorDetails: any = {
        ok: false,
        error: 'Upstream fetch failed',
        slug,
        upstreamUrl: marketUrl,
        diagnostics: {
          errorName: fetchError?.name,
          errorMessage: fetchError?.message,
          errorCause: fetchError?.cause ? String(fetchError.cause) : undefined,
          errorStack: fetchError?.stack?.substring(0, 500),
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket Proxy] Market fetch failed:', errorDetails);

      // Return cached data if available
      if (cached) {
        return NextResponse.json({ ok: true, data: cached.data });
      }

      return NextResponse.json(errorDetails, { status: 502 });
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      const errorDetails: any = {
        ok: false,
        error: response.status === 404 ? 'Market not found' : 'Upstream error',
        slug,
        upstreamStatus: response.status,
        upstreamStatusText: response.statusText,
        upstreamUrl: marketUrl,
        upstreamResponseText: responseText.substring(0, 1000),
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket Proxy] Market fetch failed:', errorDetails);

      if (response.status === 404) {
        return NextResponse.json(errorDetails, { status: 404 });
      }

      return NextResponse.json(errorDetails, { status: 502 });
    }

    const data = await response.json();

    // Gamma API returns an array, get first result
    let market = Array.isArray(data) ? data[0] : data;

    // If still an array (nested), get first element
    if (Array.isArray(market) && market.length > 0) {
      market = market[0];
    }

    if (!market) {
      return NextResponse.json(
        { ok: false, error: 'Market not found', slug },
        { status: 404 }
      );
    }

    // Normalize market data - parse JSON strings if needed
    let outcomes: string[] = [];
    let outcomePrices: Record<string, string> = {};

    try {
      // Parse outcomes (may be string or array)
      if (typeof market.outcomes === 'string') {
        outcomes = JSON.parse(market.outcomes);
      } else if (Array.isArray(market.outcomes)) {
        outcomes = market.outcomes;
      } else if (market.outcomes) {
        // Try to extract from object structure
        outcomes = Object.keys(market.outcomes);
      }

      // Ensure outcomes is an array of strings
      if (!Array.isArray(outcomes)) {
        outcomes = [];
      } else {
        // Normalize: convert all outcomes to strings
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
            // If array, create object mapping outcomes to prices
            if (parsed.length === outcomes.length) {
              outcomePrices = {};
              outcomes.forEach((outcome, idx) => {
                outcomePrices[outcome] = String(parsed[idx] || '0');
              });
            } else {
              // Mismatch - create default mapping
              outcomePrices = {};
              outcomes.forEach((outcome) => {
                outcomePrices[outcome] = '0';
              });
            }
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Already an object - use as-is
            outcomePrices = parsed;
          }
        } catch (parseErr) {
          // Invalid JSON string - use empty object
          console.warn('[Polymarket Proxy] Failed to parse outcomePrices string:', parseErr);
          outcomePrices = {};
        }
      } else if (Array.isArray(market.outcomePrices)) {
        // Array of prices - map to outcomes
        if (market.outcomePrices.length === outcomes.length) {
          outcomePrices = {};
          outcomes.forEach((outcome, idx) => {
            outcomePrices[outcome] = String(market.outcomePrices[idx] || '0');
          });
        } else {
          // Mismatch - create default mapping
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
        // Fallback: try to extract from outcomePrices keys
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
      console.warn('[Polymarket Proxy] Raw market payload shape:', {
        outcomesType: typeof market.outcomes,
        outcomesValue: market.outcomes,
        outcomePricesType: typeof market.outcomePrices,
        outcomePricesValue: market.outcomePrices,
        marketKeys: Object.keys(market),
      });
      // Return partial data with empty arrays/objects
      outcomes = [];
      outcomePrices = {};
    }

    // Normalize market data
    const marketData = {
      slug: market.slug || slug,
      question: market.question || market.title || 'Unknown Market',
      outcomes: outcomes,
      outcomePrices: outcomePrices,
      liquidity: String(market.liquidity || market.totalLiquidity || '0'),
      volume: String(market.volume || market.totalVolume || '0'),
      _meta: buildConfidenceMeta(
        { slug: market.slug, question: market.question, outcomes, outcomePrices, liquidity: market.liquidity, volume: market.volume },
        'Polymarket Gamma API'
      ),
    };

    // Cache the result
    cache.set(slug, { data: marketData, timestamp: now });

    // Clean up old cache entries periodically (keep cache size reasonable)
    if (cache.size > 100) {
      const cutoff = now - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ ok: true, data: marketData });
  } catch (error: any) {
    console.error('[Polymarket Proxy] Fetch error:', error);

    // Return cached data if available, even if expired
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }

    // Return structured error with diagnostics
    const errorDetails: any = {
      ok: false,
      error: 'Upstream fetch failed',
      slug,
      details: error.message || 'Unknown error',
    };

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorDetails.error = 'Upstream fetch timeout';
      errorDetails.details = 'Request to Gamma API timed out';
      return NextResponse.json(errorDetails, { status: 504 });
    }

    return NextResponse.json(errorDetails, { status: 502 });
  }
}

