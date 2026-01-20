import { NextRequest, NextResponse } from 'next/server';
import { searchTrendingRepos } from '@/lib/github';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

const VALID_TOPICS = ['robotics', 'humanoid', 'drones', 'ros', 'manipulation', 'ml'];

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Get query params
  const topic = searchParams.get('topic') || 'robotics';
  const daysParam = searchParams.get('days');
  const limitParam = searchParams.get('limit');

  const days = daysParam ? parseInt(daysParam, 10) : 30;
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  // Validate topic
  if (!VALID_TOPICS.includes(topic)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid topic. Valid topics: ${VALID_TOPICS.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Validate params
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json(
      { ok: false, error: 'Days must be between 1 and 365' },
      { status: 400 }
    );
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      { ok: false, error: 'Limit must be between 1 and 100' },
      { status: 400 }
    );
  }

  try {
    const repos = await searchTrendingRepos(topic, days, limit);

    return NextResponse.json({
      ok: true,
      data: {
        repos: repos.map(repo => ({
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          stars: repo.stars,
          starsDelta: repo.starsDelta,
          language: repo.language,
          url: repo.url,
          createdAt: repo.createdAt,
        })),
        topic,
        days,
        totalRepos: repos.length,
      },
      _meta: buildConfidenceMeta(
        { repos: repos.length, topic, days },
        'GitHub Search API'
      ),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=900',
      }
    });
  } catch (error: any) {
    console.error('[GitHub Trending API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch trending repos',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[GitHub Trending API] Request completed in ${Date.now() - startTime}ms`);
  }
}
