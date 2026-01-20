import { NextRequest, NextResponse } from 'next/server';
import { getCompanyContracts, searchRoboticsContracts } from '@/lib/usaspending';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyName = searchParams.get('company');
  const mode = searchParams.get('mode') || 'company'; // 'company' or 'industry'

  try {
    if (mode === 'industry' || !companyName) {
      // Get all robotics contracts
      const { contracts, total, error } = await searchRoboticsContracts({
        minAmount: 100000,
        days: 365,
        limit: 50
      });

      if (error) {
        return NextResponse.json({
          ok: false,
          error,
          data: null
        }, { status: 502 });
      }

      return NextResponse.json({
        ok: true,
        data: {
          contracts,
          total,
          mode: 'industry'
        },
        _meta: {
          confidence: 0.9,
          source: 'USASpending.gov',
          lastUpdated: new Date().toISOString()
        }
      });
    }

    // Get contracts for specific company
    const summary = await getCompanyContracts(companyName);

    return NextResponse.json({
      ok: true,
      data: {
        ...summary,
        companyName,
        mode: 'company'
      },
      _meta: {
        confidence: summary.contractCount > 0 ? 0.85 : 0.5,
        source: 'USASpending.gov',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Contracts API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch contracts',
      data: null
    }, { status: 500 });
  }
}
