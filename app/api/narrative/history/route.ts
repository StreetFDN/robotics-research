import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalScores, interpretScore } from '@/lib/narrative-index';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Get query params
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  // Validate
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json(
      { ok: false, error: 'Days must be between 1 and 365' },
      { status: 400 }
    );
  }

  try {
    const scores = await getHistoricalScores(days);

    // Calculate statistics
    let avgScore = 0;
    let minScore = 100;
    let maxScore = 0;
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';

    if (scores.length > 0) {
      avgScore = Math.round(scores.reduce((sum, s) => sum + s.overall, 0) / scores.length);
      minScore = Math.min(...scores.map(s => s.overall));
      maxScore = Math.max(...scores.map(s => s.overall));

      // Calculate trend
      if (scores.length >= 2) {
        const recent = scores.slice(-7);
        const older = scores.slice(-14, -7);

        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((sum, s) => sum + s.overall, 0) / recent.length;
          const olderAvg = older.reduce((sum, s) => sum + s.overall, 0) / older.length;

          if (recentAvg > olderAvg + 3) trendDirection = 'up';
          else if (recentAvg < olderAvg - 3) trendDirection = 'down';
        }
      }
    }

    // Format for charting
    const chartData = scores.map(s => ({
      date: s.timestamp.split('T')[0],
      timestamp: s.timestamp,
      overall: s.overall,
      github: s.components.github,
      contracts: s.components.contracts,
      news: s.components.news,
      funding: s.components.funding,
      technical: s.components.technical,
      trend: s.trend,
    }));

    // Get current interpretation
    const latestScore = scores.length > 0 ? scores[scores.length - 1].overall : 50;
    const interpretation = interpretScore(latestScore);

    return NextResponse.json({
      ok: true,
      data: {
        chartData,
        statistics: {
          dataPoints: scores.length,
          avgScore,
          minScore,
          maxScore,
          currentScore: latestScore,
          trend: trendDirection,
          interpretation,
        },
        period: {
          days,
          startDate: scores.length > 0 ? scores[0].timestamp : null,
          endDate: scores.length > 0 ? scores[scores.length - 1].timestamp : null,
        },
      },
      _meta: buildConfidenceMeta(
        { dataPoints: scores.length, days },
        'Narrative History'
      ),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=150',
      }
    });
  } catch (error: any) {
    console.error('[Narrative History API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch narrative history',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[Narrative History API] Request completed in ${Date.now() - startTime}ms`);
  }
}
