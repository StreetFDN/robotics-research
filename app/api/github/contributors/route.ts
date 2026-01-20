import { NextResponse } from 'next/server';
import { getContributorOverlap } from '@/lib/github';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();

  try {
    const contributors = await getContributorOverlap();

    // Group by number of orgs contributed to
    const byOrgCount = contributors.reduce((acc, c) => {
      const orgCount = new Set(c.contributions.map(x => x.org)).size;
      acc[orgCount] = (acc[orgCount] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Calculate flows (from org A to org B)
    const flows: Array<{ from: string; to: string; count: number }> = [];
    const flowMap = new Map<string, number>();

    for (const contributor of contributors) {
      const orgs = [...new Set(contributor.contributions.map(c => c.org))].sort();
      for (let i = 0; i < orgs.length; i++) {
        for (let j = i + 1; j < orgs.length; j++) {
          const key = `${orgs[i]}:${orgs[j]}`;
          flowMap.set(key, (flowMap.get(key) || 0) + 1);
        }
      }
    }

    for (const [key, count] of flowMap.entries()) {
      const [from, to] = key.split(':');
      flows.push({ from, to, count });
    }

    flows.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      ok: true,
      data: {
        contributors,
        flows: flows.slice(0, 20),
        summary: {
          totalOverlapping: contributors.length,
          byOrgCount,
        },
        generatedAt: new Date().toISOString(),
      },
      _meta: buildConfidenceMeta(
        { contributors: contributors.length, flows: flows.length },
        'GitHub Contributors API'
      ),
    }, {
      headers: {
        // 24-hour cache for expensive query
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      }
    });
  } catch (error: any) {
    console.error('[GitHub Contributors API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch contributor overlap',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[GitHub Contributors API] Request completed in ${Date.now() - startTime}ms`);
  }
}
