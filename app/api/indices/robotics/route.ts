import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

// Initialize YahooFinance instance
const yahooFinance = new YahooFinance();

// Robotics Index Constituents
const INDEX_TICKERS = [
  'ISRG',   // Intuitive Surgical
  'TER',    // Teradyne
  'SYM',    // Symbotic
  'PATH',   // UiPath
  'ZBRA',   // Zebra Technologies
  'ROK',    // Rockwell Automation
  'EMR',    // Emerson
  'ABBNY',  // ABB ADR
  'FANUY',  // FANUC ADR
  'YASKY',  // Yaskawa Electric ADR
  'SIEGY',  // Siemens ADR
  'SBGSY',  // Schneider Electric ADR
  'OTIS',   // Otis Worldwide
  'DE',     // Deere
  'TRMB',   // Trimble
  'IRBT',   // iRobot
  'CGNX',   // Cognex
  'AMSWA',  // Amtech Systems
  'SSYS',   // Stratasys
  '6861.T', // Keyence (Tokyo listing)
];

const CACHE_TTL_MS = 90000; // 90 seconds cache
const INDEX_BASE_VALUE = 100;
const MAX_WEIGHT = 0.10; // 10%
const MIN_WEIGHT = 0.01; // 1%

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Helper to get date range from query param
function getDateRange(range: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (range) {
    case 'YTD':
      startDate.setMonth(0, 1); // January 1st
      break;
    case '1M':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '3M':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6M':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '1Y':
    default:
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  
  return { startDate, endDate };
}

// Calculate index weights from market caps
function calculateWeights(marketCaps: Record<string, number>): Record<string, number> {
  const totalMarketCap = Object.values(marketCaps).reduce((sum, cap) => sum + cap, 0);
  
  // Initial weights based on market cap
  const rawWeights: Record<string, number> = {};
  for (const [ticker, cap] of Object.entries(marketCaps)) {
    rawWeights[ticker] = cap / totalMarketCap;
  }
  
  // Apply caps: max 10%, min 1%
  const cappedWeights: Record<string, number> = {};
  let cappedTotal = 0;
  
  for (const [ticker, weight] of Object.entries(rawWeights)) {
    let cappedWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight));
    cappedWeights[ticker] = cappedWeight;
    cappedTotal += cappedWeight;
  }
  
  // Normalize to 100%
  const normalizedWeights: Record<string, number> = {};
  for (const [ticker, weight] of Object.entries(cappedWeights)) {
    normalizedWeights[ticker] = weight / cappedTotal;
  }
  
  return normalizedWeights;
}

// Calculate index level time series
function calculateIndexLevels(
  historicalData: Record<string, Array<{ date: Date; close: number }>>,
  weights: Record<string, number>,
  startDate: Date
): Array<{ date: Date; value: number }> {
  // Get all unique dates from all tickers
  const allDates = new Set<number>();
  for (const prices of Object.values(historicalData)) {
    for (const point of prices) {
      allDates.add(point.date.getTime());
    }
  }
  
  const sortedDates = Array.from(allDates).sort((a, b) => a - b);
  
  // Find the first date where we have data for all tickers (or most)
  let baseDate: Date | null = null;
  let basePrices: Record<string, number> = {};
  
  for (const dateMs of sortedDates) {
    const date = new Date(dateMs);
    if (date < startDate) continue;
    
    const prices: Record<string, number> = {};
    let hasAllPrices = true;
    
    for (const ticker of INDEX_TICKERS) {
      const tickerData = historicalData[ticker] || [];
      const pricePoint = tickerData.find(p => p.date.getTime() === dateMs);
      if (pricePoint) {
        prices[ticker] = pricePoint.close;
      } else {
        hasAllPrices = false;
        break;
      }
    }
    
    if (hasAllPrices) {
      baseDate = date;
      basePrices = prices;
      break;
    }
  }
  
  // If no perfect base date, use first available date with most tickers
  if (!baseDate) {
    for (const dateMs of sortedDates) {
      const date = new Date(dateMs);
      if (date < startDate) continue;
      
      const prices: Record<string, number> = {};
      let tickerCount = 0;
      
      for (const ticker of INDEX_TICKERS) {
        const tickerData = historicalData[ticker] || [];
        const pricePoint = tickerData.find(p => p.date.getTime() === dateMs);
        if (pricePoint) {
          prices[ticker] = pricePoint.close;
          tickerCount++;
        }
      }
      
      if (tickerCount >= INDEX_TICKERS.length * 0.8) { // At least 80% of tickers
        baseDate = date;
        basePrices = prices;
        break;
      }
    }
  }
  
  if (!baseDate) {
    return [];
  }
  
  // Calculate base index value
  let baseIndexValue = 0;
  for (const ticker of INDEX_TICKERS) {
    if (basePrices[ticker] && weights[ticker]) {
      baseIndexValue += basePrices[ticker] * weights[ticker];
    }
  }
  
  const scaleFactor = INDEX_BASE_VALUE / baseIndexValue;
  
  // Calculate index levels for each date
  const indexLevels: Array<{ date: Date; value: number }> = [];
  
  for (const dateMs of sortedDates) {
    const date = new Date(dateMs);
    if (date < startDate) continue;
    
    let indexValue = 0;
    let hasData = false;
    
    for (const ticker of INDEX_TICKERS) {
      const tickerData = historicalData[ticker] || [];
      const pricePoint = tickerData.find(p => p.date.getTime() === dateMs);
      if (pricePoint && weights[ticker]) {
        // Use last known price if current date missing
        const price = pricePoint.close;
        indexValue += price * weights[ticker];
        hasData = true;
      }
    }
    
    if (hasData) {
      indexLevels.push({
        date,
        value: indexValue * scaleFactor,
      });
    }
  }
  
  return indexLevels;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '1Y';
  
  // Check cache
  const cacheKey = `robotics-index-${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, data: cached.data });
  }
  
  try {
    const { startDate, endDate } = getDateRange(range);
    
    // Fetch current market caps and prices for all tickers
    const marketCaps: Record<string, number> = {};
    const currentPrices: Record<string, number> = {};
    
    // Fetch quote data for market caps
    const quotePromises = INDEX_TICKERS.map(async (ticker) => {
      try {
        const quote = await yahooFinance.quote(ticker);
        if (quote) {
          // Handle different possible field names for market cap
          const marketCap = (quote as any).marketCap || (quote as any).marketCapitalization || 0;
          const price = (quote as any).regularMarketPrice || (quote as any).price || (quote as any).regularMarketPreviousClose || 0;
          
          if (marketCap > 0) {
            marketCaps[ticker] = marketCap;
          }
          if (price > 0) {
            currentPrices[ticker] = price;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch quote for ${ticker}:`, error);
      }
    });
    
    await Promise.all(quotePromises);
    
    // Calculate weights
    const weights = calculateWeights(marketCaps);
    
    // Fetch historical data for all tickers
    const historicalData: Record<string, Array<{ date: Date; close: number }>> = {};
    
    const historyPromises = INDEX_TICKERS.map(async (ticker) => {
      try {
        const history = await yahooFinance.historical(ticker, {
          period1: startDate,
          period2: endDate,
          interval: '1d' as const,
        });
        
        if (history && history.length > 0) {
          historicalData[ticker] = history.map((h: any) => ({
            date: new Date(h.date),
            close: h.close || 0,
          }));
        }
      } catch (error) {
        console.warn(`Failed to fetch history for ${ticker}:`, error);
      }
    });
    
    await Promise.all(historyPromises);
    
    // Calculate index levels
    const indexLevels = calculateIndexLevels(historicalData, weights, startDate);
    
    // Get latest index value and calculate change
    // Find the most recent trading day and the previous trading day
    const latestValue = indexLevels.length > 0 ? indexLevels[indexLevels.length - 1].value : INDEX_BASE_VALUE;
    
    // For day change, compare with previous day (not just previous data point)
    // Find the last two distinct dates
    let previousValue = INDEX_BASE_VALUE;
    if (indexLevels.length > 1) {
      // Get the last date
      const lastDate = indexLevels[indexLevels.length - 1].date;
      // Find the most recent value before the last date
      for (let i = indexLevels.length - 2; i >= 0; i--) {
        if (indexLevels[i].date.getTime() < lastDate.getTime()) {
          previousValue = indexLevels[i].value;
          break;
        }
      }
      // If no previous date found, use second-to-last value
      if (previousValue === INDEX_BASE_VALUE && indexLevels.length > 1) {
        previousValue = indexLevels[indexLevels.length - 2].value;
      }
    }
    
    const dayChange = latestValue - previousValue;
    const dayChangePercent = previousValue !== 0 ? (dayChange / previousValue) * 100 : 0;
    
    const result = {
      indexLevels,
      weights,
      latestValue,
      dayChange,
      dayChangePercent,
      constituents: INDEX_TICKERS.map(ticker => ({
        ticker,
        weight: weights[ticker] || 0,
        marketCap: marketCaps[ticker] || 0,
        currentPrice: currentPrices[ticker] || 0,
      })),
      baseValue: INDEX_BASE_VALUE,
      range,
      _meta: buildConfidenceMeta(
        { indexLevels, weights, latestValue, dayChange, dayChangePercent, constituents: INDEX_TICKERS, marketCaps, currentPrices },
        'Yahoo Finance API'
      ),
    };
    
    // Cache result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
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
    console.error('[Robotics Index] Error:', error);
    
    // Return cached data if available, even if expired
    if (cached) {
      return NextResponse.json({ ok: true, data: cached.data });
    }
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to calculate index',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

