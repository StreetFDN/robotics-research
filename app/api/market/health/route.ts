import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    ok: true,
    service: 'market-api',
    timestamp: Date.now(),
    routes: {
      'compare-history': '/api/market/compare-history?tickers=BOTZ,ROBO,IRBO&range=1Y',
      'health': '/api/market/health',
    },
  });
}

