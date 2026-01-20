/**
 * Stock Historical Data API
 *
 * Fetches historical price data for a given stock symbol
 * Used primarily for benchmark comparisons (MSCI World = URTH)
 *
 * Query params:
 * - symbol: Stock ticker (required)
 * - days: Number of days of history (default: 30, max: 365)
 */

import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  const symbol = searchParams.get('symbol');
  const daysParam = searchParams.get('days');
  const days = Math.min(365, Math.max(1, parseInt(daysParam || '30', 10)));

  if (!symbol) {
    return NextResponse.json({
      ok: false,
      error: 'Missing required parameter: symbol',
    }, { status: 400 });
  }

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch historical data from Yahoo Finance
    const result = await yahooFinance.historical(symbol.toUpperCase(), {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    }) as Array<{
      date: Date;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
    }>;

    if (!result || !Array.isArray(result) || result.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No historical data found for ${symbol}`,
      }, { status: 404 });
    }

    // Transform to our format (most recent first)
    const history: HistoricalDataPoint[] = result
      .map((item: { date: Date; open?: number; high?: number; low?: number; close?: number; volume?: number }) => ({
        date: item.date.toISOString().split('T')[0],
        open: item.open ?? 0,
        high: item.high ?? 0,
        low: item.low ?? 0,
        close: item.close ?? 0,
        volume: item.volume ?? 0,
      }))
      .reverse(); // Most recent first

    // Calculate some useful metrics
    const latestClose = history[0]?.close ?? 0;
    const previousClose = history[1]?.close ?? latestClose;
    const change1D = previousClose > 0 ? ((latestClose - previousClose) / previousClose) * 100 : 0;

    const close5DAgo = history[5]?.close ?? latestClose;
    const change5D = close5DAgo > 0 ? ((latestClose - close5DAgo) / close5DAgo) * 100 : 0;

    const close20DAgo = history[20]?.close ?? latestClose;
    const change20D = close20DAgo > 0 ? ((latestClose - close20DAgo) / close20DAgo) * 100 : 0;

    console.log(`[Stock Historical API] ${symbol}: ${history.length} days, 1D=${change1D.toFixed(2)}%, 5D=${change5D.toFixed(2)}%, 20D=${change20D.toFixed(2)}% (${Date.now() - startTime}ms)`);

    return NextResponse.json({
      ok: true,
      data: {
        symbol: symbol.toUpperCase(),
        history,
        metrics: {
          latestClose,
          change1D,
          change5D,
          change20D,
        },
        meta: {
          requestedDays: days,
          returnedDays: history.length,
          startDate: history[history.length - 1]?.date,
          endDate: history[0]?.date,
        },
      },
    });
  } catch (error: any) {
    console.error(`[Stock Historical API] Error fetching ${symbol}:`, error.message);

    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch historical data',
    }, { status: 500 });
  }
}
