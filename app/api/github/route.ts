import { NextRequest, NextResponse } from 'next/server';
import { getCompanyTechnicalMomentum, searchRoboticsRepos } from '@/lib/github';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyName = searchParams.get('company');
  const mode = searchParams.get('mode') || 'company'; // 'company' or 'trending'

  try {
    if (mode === 'trending' || !companyName) {
      // Get trending robotics repos
      const repos = await searchRoboticsRepos(20);

      return NextResponse.json({
        ok: true,
        data: {
          repos,
          mode: 'trending'
        },
        _meta: {
          confidence: 0.9,
          source: 'GitHub API',
          lastUpdated: new Date().toISOString()
        }
      });
    }

    // Get technical momentum for specific company
    const momentum = await getCompanyTechnicalMomentum(companyName);

    if (!momentum) {
      return NextResponse.json({
        ok: true,
        data: {
          companyName,
          found: false,
          message: 'No GitHub presence found for this company',
          mode: 'company'
        },
        _meta: {
          confidence: 0.5,
          source: 'GitHub API',
          lastUpdated: new Date().toISOString()
        }
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...momentum,
        companyName,
        found: true,
        mode: 'company'
      },
      _meta: {
        confidence: 0.85,
        source: 'GitHub API',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[GitHub API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch GitHub data',
      data: null
    }, { status: 500 });
  }
}
