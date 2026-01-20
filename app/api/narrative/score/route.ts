import { NextResponse } from 'next/server';
import {
  computeNarrativeIndex,
  interpretScore,
  appendScoreToHistory,
  getLatestScore,
} from '@/lib/narrative-index';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

// Cache the score for 15 minutes
let cachedScore: {
  data: Awaited<ReturnType<typeof computeNarrativeIndex>>;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  const startTime = Date.now();

  try {
    // Check cache
    if (cachedScore && Date.now() - cachedScore.timestamp < CACHE_TTL_MS) {
      const interpretation = interpretScore(cachedScore.data.overall);

      return NextResponse.json({
        ok: true,
        data: {
          ...cachedScore.data,
          interpretation,
          cached: true,
        },
        _meta: buildConfidenceMeta(
          {
            overall: cachedScore.data.overall,
            components: 5,
            signals: cachedScore.data.signals.length,
          },
          'Narrative Index Engine'
        ),
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=450',
        }
      });
    }

    // Compute fresh score
    const score = await computeNarrativeIndex();
    const interpretation = interpretScore(score.overall);

    // Cache the result
    cachedScore = { data: score, timestamp: Date.now() };

    // Append to history (async, don't wait)
    appendScoreToHistory(score).catch(err => {
      console.error('[Narrative Score API] Failed to append to history:', err);
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...score,
        interpretation,
        cached: false,
      },
      _meta: buildConfidenceMeta(
        {
          overall: score.overall,
          components: 5,
          signals: score.signals.length,
        },
        'Narrative Index Engine'
      ),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=450',
      }
    });
  } catch (error: any) {
    console.error('[Narrative Score API] Error:', error);

    // Try to return cached score on error
    if (cachedScore) {
      const interpretation = interpretScore(cachedScore.data.overall);
      return NextResponse.json({
        ok: true,
        data: {
          ...cachedScore.data,
          interpretation,
          cached: true,
          stale: true,
        },
        _meta: buildConfidenceMeta(
          { overall: cachedScore.data.overall, error: true },
          'Narrative Index Engine (Stale)'
        ),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to compute narrative index',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    console.log(`[Narrative Score API] Request completed in ${Date.now() - startTime}ms`);
  }
}
