import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TIINGO_API_BASE = 'https://api.tiingo.com/tiingo/daily';
const CACHE_TTL_MS = 180000; // 180 seconds (3 minutes) cache - between 60-300s as requested
const FETCH_TIMEOUT_MS = 8000; // 8 seconds timeout

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Helper to get date range from query param
function getDateRange(range: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  // Set to today in UTC
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date();
  
  switch (range) {
    case 'YTD':
      startDate.setUTCFullYear(endDate.getUTCFullYear(), 0, 1); // January 1st UTC
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
        // Retry for transient errors
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

// Forward-fill missing dates with last known value
function forwardFillData(
  data: Array<{ date: Date; close: number }>,
  allDates: Date[]
): Array<{ date: Date; close: number }> {
  if (data.length === 0) return [];
  
  const filled: Array<{ date: Date; close: number }> = [];
  let lastKnownValue = data[0].close;
  let dataIndex = 0;
  
  for (const date of allDates) {
    // Check if we have data for this date
    while (dataIndex < data.length && data[dataIndex].date.getTime() < date.getTime()) {
      lastKnownValue = data[dataIndex].close;
      dataIndex++;
    }
    
    // If we have exact match, use it; otherwise forward-fill
    if (dataIndex < data.length && data[dataIndex].date.getTime() === date.getTime()) {
      lastKnownValue = data[dataIndex].close;
      filled.push({ date, close: lastKnownValue });
      dataIndex++;
    } else {
      filled.push({ date, close: lastKnownValue });
    }
  }
  
  return filled;
}

// Normalize to percent return from baseline (first value = 0%)
function normalizeToPercentReturn(
  data: Array<{ date: Date; close: number }>,
  ticker: string
): Array<{ date: Date; value: number }> {
  if (data.length === 0) return [];
  
  // Find first valid baseline (first non-zero, finite close)
  let baseline: number | null = null;
  let baselineDate: Date | null = null;
  
  for (const point of data) {
    const close = Number(point.close);
    if (isFinite(close) && close > 0) {
      baseline = close;
      baselineDate = point.date;
      break;
    }
  }
  
  if (baseline === null || baseline === 0) {
    console.warn(`[Compare History] No valid baseline found for ${ticker}`);
    return [];
  }
  
  // Log baseline for debugging (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Compare History] ${ticker} baseline:`, {
      date: baselineDate?.toISOString(),
      close: baseline.toFixed(4),
    });
  }
  
  const normalized = data.map(point => {
    const close = Number(point.close);
    if (!isFinite(close) || close <= 0) {
      // Forward-fill: use last known value
      return null;
    }
    
    const pct = ((close / baseline) - 1) * 100;
    return {
      date: point.date,
      value: isFinite(pct) ? pct : 0,
    };
  }).filter((p): p is { date: Date; value: number } => p !== null);
  
  // Forward-fill any null values with last known value
  let lastKnownValue = 0;
  return normalized.map(p => {
    if (isFinite(p.value)) {
      lastKnownValue = p.value;
      return p;
    }
    return { date: p.date, value: lastKnownValue };
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tickersParam = searchParams.get('tickers') || 'BOTZ,ROBO,IRBO';
  const range = searchParams.get('range') || '1Y';
  
  console.log('[Compare History] Request:', { tickers: tickersParam, range, url: request.url });
  
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  
  if (tickers.length === 0) {
    console.warn('[Compare History] No tickers provided');
    return NextResponse.json(
      { ok: false, error: 'No tickers provided' },
      { status: 400 }
    );
  }
  
  // Check cache
  const cacheKey = `compare-history-${tickers.join(',')}-${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[Compare History] Returning cached data');
    return NextResponse.json({ ok: true, data: cached.data });
  }
  
  // Validate API key
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) {
    console.error('[Compare History] Missing TIINGO_API_KEY');
    return NextResponse.json(
      {
        ok: false,
        error: 'Server configuration error',
        details: 'TIINGO_API_KEY not configured',
      },
      { status: 500 }
    );
  }
  
  console.log('[Compare History] Fetching fresh data from Tiingo for:', tickers);
  
  try {
    const { startDate, endDate } = getDateRange(range);
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    console.log(`[Compare History] Date range: ${startDateStr} to ${endDateStr}`);
    
    // Fetch historical data for all tickers from Tiingo
    const rawData: Record<string, Array<{ date: Date; close: number }>> = {};
    
    const historyPromises = tickers.map(async (ticker) => {
      try {
        console.log(`[Compare History] Fetching ${ticker} from Tiingo`);
        
        const { data, error } = await fetchTiingoData(ticker, startDateStr, endDateStr, apiKey);
        
        if (error) {
          console.error(`[Compare History] Tiingo error for ${ticker}:`, error);
          return { ticker, data: null, error };
        }
        
        if (!data || data.length === 0) {
          console.warn(`[Compare History] ${ticker} returned empty data from Tiingo`);
          return { ticker, data: null, error: { message: 'No data returned' } };
        }
        
        // Process Tiingo data - prefer adjClose, fallback to close
        // Use consistent field for all tickers
        const processed = data
          .map((item: any) => {
            // Tiingo returns date as string in YYYY-MM-DD format
            const date = new Date(item.date);
            // Prefer adjClose for consistency (accounts for splits/dividends), fallback to close
            // Ensure we parse as number
            const closeRaw = item.adjClose != null ? item.adjClose : item.close;
            const close = typeof closeRaw === 'number' ? closeRaw : Number(closeRaw);
            return { date, close: isFinite(close) && close > 0 ? close : null };
          })
          .filter((p: { date: Date; close: number | null }) => {
            // Filter out invalid dates and null/zero/negative prices
            return !isNaN(p.date.getTime()) && p.close !== null && p.close > 0;
          })
          .sort((a: { date: Date; close: number }, b: { date: Date; close: number }) => 
            a.date.getTime() - b.date.getTime()
          )
          .map((p: { date: Date; close: number | null }) => ({ date: p.date, close: p.close as number }));
        
        console.log(`[Compare History] ${ticker} processed to ${processed.length} valid points`);
        rawData[ticker] = processed;
        return { ticker, data: processed, error: null };
      } catch (error: any) {
        console.error(`[Compare History] Exception fetching ${ticker}:`, {
          errorName: error.name,
          errorMessage: error.message,
        });
        return { ticker, data: null, error };
      }
    });
    
    const results = await Promise.all(historyPromises);
    
    // Check for tickers with no data
    const tickersWithoutData = results.filter(r => !r.data || r.data.length === 0);
    if (tickersWithoutData.length > 0) {
      const failedTickers = tickersWithoutData.map(r => r.ticker);
      console.warn(`[Compare History] No data for tickers: ${failedTickers.join(', ')}`);
      
      // Return cached data if available
      if (cached) {
        console.log('[Compare History] Returning cached data due to missing ticker data');
        return NextResponse.json({ ok: true, data: cached.data });
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: 'No data for ticker',
          ticker: failedTickers.join(', '),
          range,
        },
        { status: 200 }
      );
    }
    
    // Log what we got
    console.log('[Compare History] Raw data summary:', 
      Object.entries(rawData).map(([ticker, data]) => `${ticker}: ${data.length} points`).join(', ')
    );
    
    // Get all unique dates across all tickers
    const allDatesSet = new Set<number>();
    for (const data of Object.values(rawData)) {
      for (const point of data) {
        allDatesSet.add(point.date.getTime());
      }
    }
    
    const allDates = Array.from(allDatesSet)
      .map(ms => new Date(ms))
      .sort((a, b) => a.getTime() - b.getTime())
      .filter(date => date >= startDate && date <= endDate);
    
    console.log(`[Compare History] Found ${allDates.length} unique dates after filtering`);
    
    if (allDates.length === 0) {
      console.warn('[Compare History] No dates found after filtering');
      
      // Return cached data if available
      if (cached) {
        console.log('[Compare History] Returning cached data due to no dates');
        return NextResponse.json({ ok: true, data: cached.data });
      }
      
      return NextResponse.json(
        { 
          ok: false, 
          error: 'No data available for the selected range',
          details: `No historical data found for tickers: ${tickers.join(', ')}`,
        },
        { status: 200 }
      );
    }
    
    // Forward-fill each series to align dates
    const alignedData: Record<string, Array<{ date: Date; close: number }>> = {};
    for (const ticker of tickers) {
      alignedData[ticker] = forwardFillData(rawData[ticker] || [], allDates);
    }
    
    // Normalize each series to percent return (baseline = first value = 0%)
    const normalizedData: Record<string, Array<{ date: Date; value: number }>> = {};
    for (const ticker of tickers) {
      const aligned = alignedData[ticker];
      if (aligned.length > 0 && aligned.some(p => p.close > 0)) {
        // Only normalize if we have valid data
        normalizedData[ticker] = normalizeToPercentReturn(aligned, ticker);
      } else {
        // If no data, create array of zeros
        normalizedData[ticker] = allDates.map(date => ({ date, value: 0 }));
      }
    }
    
    // Build aligned points array with unix_ms timestamps
    // Ensure all values are finite numbers
    const points: Array<{ t: number; [key: string]: number }> = [];
    for (let i = 0; i < allDates.length; i++) {
      const point: { t: number; [key: string]: number } = {
        t: allDates[i].getTime(), // Unix timestamp in milliseconds
      };
      
      for (const ticker of tickers) {
        const normalized = normalizedData[ticker];
        if (normalized && normalized[i]) {
          const value = Number(normalized[i].value);
          point[ticker] = isFinite(value) ? value : 0; // Use uppercase ticker name
        } else {
          point[ticker] = 0;
        }
      }
      
      points.push(point);
    }
    
    // Get latest percent returns - ensure finite values
    const latest: Record<string, number> = {};
    for (const ticker of tickers) {
      const normalized = normalizedData[ticker];
      if (normalized.length > 0) {
        const lastValue = Number(normalized[normalized.length - 1].value);
        latest[ticker] = isFinite(lastValue) ? lastValue : 0;
      } else {
        latest[ticker] = 0;
      }
    }
    
    // Log latest values for debugging (dev only)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Compare History] Latest percent returns:', latest);
      // Also log a sample of points to verify data structure
      if (points.length > 0) {
        console.log('[Compare History] Sample point (first):', points[0]);
        console.log('[Compare History] Sample point (last):', points[points.length - 1]);
      }
    }
    
    const result = {
      range,
      tickers,
      points,
      latest,
    };
    
    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    console.log('[Compare History] Success:', {
      points: result.points.length,
      latest: result.latest,
      range: result.range,
    });
    
    // Clean up old cache entries
    if (cache.size > 20) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key);
        }
      }
    }
    
    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[Compare History] Error:', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
      tickers,
      range,
    });
    
    // Return cached data if available, even if expired
    if (cached) {
      console.log('[Compare History] Returning stale cached data due to error');
      return NextResponse.json({ ok: true, data: cached.data });
    }
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch comparison data',
        details: error.message || 'Unknown error',
      },
      { status: 200 }
    );
  }
}
