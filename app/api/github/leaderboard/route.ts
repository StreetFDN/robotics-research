import { NextResponse } from 'next/server';
import { getOrgLeaderboard } from '@/lib/github';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();

  try {
    const orgs = await getOrgLeaderboard();

    return NextResponse.json({
      ok: true,
      data: {
        orgs,
        totalOrgs: orgs.length,
        generatedAt: new Date().toISOString(),
      },
      _meta: buildConfidenceMeta(
        { orgs: orgs.length, hasCommitData: orgs.some(o => o.commitsWeek > 0) },
        'GitHub REST API'
      ),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      }
    });
  } catch (error: any) {
    console.error('[GitHub Leaderboard API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch GitHub leaderboard',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[GitHub Leaderboard API] Request completed in ${Date.now() - startTime}ms`);
  }
}
