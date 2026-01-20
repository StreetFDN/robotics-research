import { NextResponse } from 'next/server';
import { getLanguageStats } from '@/lib/github';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();

  try {
    const languages = await getLanguageStats();

    return NextResponse.json({
      ok: true,
      data: {
        languages,
        totalLanguages: languages.length,
        totalBytes: languages.reduce((sum, l) => sum + l.bytes, 0),
        generatedAt: new Date().toISOString(),
      },
      _meta: buildConfidenceMeta(
        { languages: languages.length, hasPercentages: languages.some(l => l.percentage > 0) },
        'GitHub Languages API'
      ),
    }, {
      headers: {
        // 24-hour cache for expensive query
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      }
    });
  } catch (error: any) {
    console.error('[GitHub Techstack API] Error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch tech stack analysis',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[GitHub Techstack API] Request completed in ${Date.now() - startTime}ms`);
  }
}
