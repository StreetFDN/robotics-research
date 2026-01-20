import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import { buildConfidenceMeta } from '@/utils/confidence';

// Force Node.js runtime (not Edge) for reliable fetch
export const runtime = 'nodejs';

const CLOB_API_BASE = 'https://clob.polymarket.com';
const CACHE_TTL_MS = 60000; // 60 seconds server-side cache

// Simple in-memory cache (edge-safe)
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Rate limiting: track last request time per token_id+side
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL_MS = 1000; // Minimum 1 second between requests for same token_id+side

// Fallback fetch using native https module when fetch fails
async function httpsFetch(url: string): Promise<{ response: Response | null; error: any }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        // Force IPv4
        family: 4,
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const response = new Response(data, {
            status: res.statusCode || 200,
            statusText: res.statusMessage || 'OK',
            headers: {
              'Content-Type': res.headers['content-type'] || 'application/json',
            },
          });
          resolve({ response, error: null });
        });
      });

      req.on('error', (error) => {
        resolve({ response: null, error });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ response: null, error: new Error('Request timeout') });
      });

      req.end();
    } catch (error) {
      resolve({ response: null, error });
    }
  });
}

// Robust fetch wrapper with retries and https fallback
async function robustFetch(
  url: string,
  retries = 2
): Promise<{ response: Response | null; error: any }> {
  const maxAttempts = retries + 1;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      console.log(`[CLOB Proxy] Attempt ${attempt + 1}/${maxAttempts}: Fetching ${url}`);

      const fetchOptions: RequestInit = {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        keepalive: false,
      };

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      console.log(`[CLOB Proxy] Response status: ${response.status} for ${url}`);

      // Retry for transient errors
      if (!response.ok && attempt < retries) {
        const status = response.status;
        if (status === 429 || status === 502 || status === 503 || status === 504) {
          const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
          console.log(`[CLOB Proxy] Retrying after ${backoffMs}ms due to status ${status}`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      return { response, error: null };
    } catch (error: any) {
      lastError = error;
      console.error(`[CLOB Proxy] Fetch attempt ${attempt + 1} failed:`, {
        name: error.name,
        message: error.message,
        cause: error.cause,
      });

      // If fetch fails with connection error, try https fallback on last attempt
      if (attempt === retries && (error.name === 'TypeError' || error.message?.includes('fetch failed'))) {
        console.log(`[CLOB Proxy] Trying https fallback for ${url}`);
        const httpsResult = await httpsFetch(url);
        if (httpsResult.response) {
          return httpsResult;
        }
      }

      // Don't retry on abort/timeout if it's the last attempt
      if (attempt < retries && error.name !== 'AbortError') {
        const backoffMs = Math.min(250 * Math.pow(2, attempt), 2000);
        console.log(`[CLOB Proxy] Retrying after ${backoffMs}ms due to error`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  console.error(`[CLOB Proxy] All ${maxAttempts} attempts failed for ${url}`);
  return { response: null, error: lastError };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenId = searchParams.get('token_id');
  const side = searchParams.get('side') || 'buy';

  if (!tokenId) {
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Missing token_id parameter',
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  // Validate token ID format (should be a long numeric string)
  if (typeof tokenId !== 'string' || tokenId.length < 10) {
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Invalid token_id format',
        tokenId,
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  // Check server-side cache first
  const cacheKey = `${tokenId}:${side}`;
  let cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, data: cached.data });
  }

  // Rate limiting
  const lastRequest = lastRequestTime.get(cacheKey);
  const now = Date.now();
  if (lastRequest && now - lastRequest < MIN_REQUEST_INTERVAL_MS) {
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - (now - lastRequest)));
  }

  lastRequestTime.set(cacheKey, now);

  try {
    const priceUrl = `${CLOB_API_BASE}/price?token_id=${encodeURIComponent(tokenId)}&side=${encodeURIComponent(side)}`;
    const { response, error: fetchError } = await robustFetch(priceUrl);

    if (fetchError || !response) {
      const errorDetails: any = {
        ok: false,
        error: 'Upstream fetch failed',
        tokenId,
        side,
        upstreamUrl: priceUrl,
        errorName: fetchError?.name,
        errorMessage: fetchError?.message,
        errorCause: fetchError?.cause ? String(fetchError.cause) : undefined,
        stackPreview: fetchError?.stack?.substring(0, 500),
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket CLOB Proxy] Price fetch failed:', JSON.stringify(errorDetails, null, 2));

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
        error: response.status === 404 ? 'Price not found' : 'Upstream error',
        tokenId,
        side,
        upstreamUrl: priceUrl,
        status: response.status,
        statusText: response.statusText,
        bodyPreview: responseText.substring(0, 500),
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };

      console.error('[Polymarket CLOB Proxy] Price fetch failed:', JSON.stringify(errorDetails, null, 2));

      if (response.status === 404) {
        return NextResponse.json(errorDetails, { status: 404 });
      }

      return NextResponse.json(errorDetails, { status: 502 });
    }

    const data = await response.json();

    // CLOB API returns {price: "0.074"} directly
    // Wrap it in our standard format
    const wrappedData = {
      price: data.price || data,
      _meta: buildConfidenceMeta(
        { price: data.price, tokenId, side },
        'Polymarket CLOB API'
      ),
    };

    // Cache the result
    cache.set(cacheKey, { data: wrappedData, timestamp: now });

    // Clean up old cache entries
    if (cache.size > 100) {
      const cutoff = now - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json({ ok: true, data: wrappedData });
  } catch (error: any) {
    console.error('[Polymarket CLOB Proxy] Fetch error:', error);

    // Return cached data if available, even if expired
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }

    // Return structured error with diagnostics
    const errorDetails: any = {
      ok: false,
      error: 'Upstream fetch failed',
      tokenId,
      side,
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

    return NextResponse.json(errorDetails, { status: 502 });
  }
}

