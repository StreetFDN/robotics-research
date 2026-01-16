import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TIINGO_API_BASE = 'https://api.tiingo.com/tiingo/daily';
const CACHE_TTL_MS = 180000; // 180 seconds (3 minutes) cache
const FETCH_TIMEOUT_MS = 8000; // 8 seconds timeout

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Helper to get date range from query param
function getDateRange(range: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date();
  
  switch (range) {
    case 'YTD':
      startDate.setUTCFullYear(endDate.getUTCFullYear(), 0, 1);
      startDate.setUTCHours(0, 0, 0, 0);
      break;
    case '1M':
      startDate.setUTCMonth(endDate.getUTCMonth() - 1);
      startDate.setUTCHours(0, 0, 0, 0);
      break;
    case '3M':
      startDate.setUTCMonth(endDate.getUTCMonth() - 3);
      startDate.setUTCHours(0, 0, 0, 0);
      break;
    case '6M':
      startDate.setUTCMonth(endDate.getUTCMonth() - 6);
      startDate.setUTCHours(0, 0, 0, 0);
      break;
    case '1Y':
    default:
      startDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
      startDate.setUTCHours(0, 0, 0, 0);
      break;
  }
  
  return { startDate, endDate };
}

// Format date as YYYY-MM-DD for Tiingo API
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Robust fetch wrapper with timeout and retry
async function fetchTiingoData(
  ticker: string,
  startDate: string,
  endDate: string,
  apiKey: string,
  retries = 1
): Promise<{ data: any[] | null; error: any }> {
  const url = `${TIINGO_API_BASE}/${ticker}/prices?startDate=${startDate}&endDate=${endDate}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries && (response.status === 429 || response.status >= 500)) {
          const backoffMs = 250 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        const errorText = await response.text().catch(() => '');
        return {
          data: null,
          error: {
            status: response.status,
            statusText: response.statusText,
            message: errorText.substring(0, 200),
          },
        };
      }

      const data = await response.json();
      return { data: Array.isArray(data) ? data : null, error: null };
    } catch (error: any) {
      if (attempt < retries && error.name !== 'AbortError') {
        const backoffMs = 250 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return {
        data: null,
        error: {
          name: error.name,
          message: error.message,
        },
      };
    }
  }

  return { data: null, error: { message: 'Max retries exceeded' } };
}

// Get company name from ticker (simple mapping)
function getCompanyName(ticker: string): string {
  const names: Record<string, string> = {
    'ISRG': 'Intuitive Surgical',
    'TER': 'Teradyne',
    'ROK': 'Rockwell Automation',
    'ZBRA': 'Zebra Technologies',
    'CGNX': 'Cognex',
    'SYM': 'Symbotic',
    'SERV': 'ServiceNow',
    'RR': 'Rolls-Royce',
  };
  return names[ticker] || ticker;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const range = searchParams.get('range') || '1Y';
  
  if (!ticker) {
    return NextResponse.json(
      { ok: false, error: 'Missing ticker parameter' },
      { status: 400 }
    );
  }
  
  // Check cache
  const cacheKey = `stock-history-${ticker}-${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, data: cached.data });
  }
  
  // Validate API key
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Server configuration error',
        details: 'TIINGO_API_KEY not configured',
      },
      { status: 500 }
    );
  }
  
  try {
    const { startDate, endDate } = getDateRange(range);
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    const { data, error } = await fetchTiingoData(ticker, startDateStr, endDateStr, apiKey);
    
    if (error) {
      console.error(`[Stock History] Tiingo error for ${ticker}:`, error);
      
      if (cached) {
        return NextResponse.json({ ok: true, data: cached.data });
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to fetch stock data',
          details: error.message || 'Unknown error',
        },
        { status: 200 }
      );
    }
    
    if (!data || data.length === 0) {
      if (cached) {
        return NextResponse.json({ ok: true, data: cached.data });
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: 'No data available',
          details: `No historical data found for ${ticker} in the selected range`,
        },
        { status: 200 }
      );
    }
    
    // Process Tiingo data
    const processed = data
      .map((item: any) => {
        const date = new Date(item.date);
        const closeRaw = item.adjClose != null ? item.adjClose : item.close;
        const close = typeof closeRaw === 'number' ? closeRaw : Number(closeRaw);
        return { date, close: isFinite(close) && close > 0 ? close : null };
      })
      .filter((p): p is { date: Date; close: number } => {
        return !isNaN(p.date.getTime()) && p.close !== null && p.close > 0;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((p) => ({ date: p.date, close: p.close }));
    
    if (processed.length === 0) {
      if (cached) {
        return NextResponse.json({ ok: true, data: cached.data });
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: 'No valid data',
          details: `No valid price data found for ${ticker}`,
        },
        { status: 200 }
      );
    }
    
    // Build points array with unix_ms timestamps
    const points = processed.map((p: { date: Date; close: number }) => ({
      t: p.date.getTime(),
      v: p.close,
    }));
    
    // Calculate last value and change
    const lastValue = points[points.length - 1].v;
    const previousValue = points.length >= 2 ? points[points.length - 2].v : lastValue;
    const changeAbs = lastValue - previousValue;
    const changePct = previousValue > 0 ? (changeAbs / previousValue) * 100 : 0;
    
    const result = {
      ticker,
      name: getCompanyName(ticker),
      points,
      last: {
        v: lastValue,
        changeAbs,
        changePct,
      },
      range,
    };
    
    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    // Clean up old cache entries
    if (cache.size > 100) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }
    
    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[Stock History] Error:', error);
    
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch stock data',
        details: error.message || 'Unknown error',
      },
      { status: 200 }
    );
  }
}


