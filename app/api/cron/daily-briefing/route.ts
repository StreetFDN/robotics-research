/**
 * Daily Briefing Cron Endpoint
 *
 * Triggers daily Telegram briefing at scheduled time.
 * Can be called by:
 * - Vercel Cron (add to vercel.json)
 * - External cron service (cron-job.org, etc.)
 * - Manual trigger for testing
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized triggers
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendDailyBriefing, isTelegramConfigured } from '@/lib/telegram-alerts';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for briefing generation

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (optional security layer)
  const cronSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, verify it
  if (expectedSecret && cronSecret !== expectedSecret) {
    console.log('[Cron] Unauthorized daily briefing attempt');
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Telegram is configured
  if (!isTelegramConfigured()) {
    console.log('[Cron] Telegram not configured, skipping daily briefing');
    return NextResponse.json({
      ok: false,
      error: 'Telegram not configured',
      hint: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local',
    }, { status: 503 });
  }

  try {
    console.log('[Cron] Starting daily briefing...');

    const success = await sendDailyBriefing();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Daily briefing ${success ? 'sent' : 'failed'} in ${duration}ms`);

    return NextResponse.json({
      ok: success,
      message: success ? 'Daily briefing sent successfully' : 'Failed to send briefing',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    });
  } catch (error: any) {
    console.error('[Cron] Daily briefing error:', error);

    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}

// Also support POST for webhook-style triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
