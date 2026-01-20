import { NextRequest, NextResponse } from 'next/server';
import { getRecentReleases } from '@/lib/github';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Get query params
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  // Validate
  if (isNaN(days) || days < 1 || days > 90) {
    return NextResponse.json(
      { ok: false, error: 'Days must be between 1 and 90' },
      { status: 400 }
    );
  }

  try {
    const releases = await getRecentReleases(days);

    // Separate major and minor releases
    const majorReleases = releases.filter(r => r.isMajor);
    const minorReleases = releases.filter(r => !r.isMajor);

    return NextResponse.json({
      ok: true,
      data: {
        releases,
        majorReleases: majorReleases.length,
        totalReleases: releases.length,
        days,
        generatedAt: new Date().toISOString(),
      },
      _meta: buildConfidenceMeta(
        { releases: releases.length, majorReleases: majorReleases.length, days },
        'GitHub Releases API'
      ),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      }
    });
  } catch (error: any) {
    console.error('[GitHub Releases API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch recent releases',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[GitHub Releases API] Request completed in ${Date.now() - startTime}ms`);
  }
}
