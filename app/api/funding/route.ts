/**
 * API Route: /api/funding
 * Returns robotics funding rounds from curated database + NewsAPI
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fetchRoboticsFundingNews } from '@/lib/newsapi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface FundingRound {
  company: string;
  amount: number;
  round?: string;
  date: string;
  investors?: string[];
  valuation?: number | null;
  description?: string;
  source?: string;
  url?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '365');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const allRounds: FundingRound[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 1. Load curated funding database
    const fundingDbPath = path.join(process.cwd(), 'data', 'robotics-funding-2025.json');
    if (fs.existsSync(fundingDbPath)) {
      const fundingDb = JSON.parse(fs.readFileSync(fundingDbPath, 'utf-8'));

      for (const round of fundingDb.rounds || []) {
        const roundDate = new Date(round.date);
        if (roundDate >= cutoffDate) {
          allRounds.push({
            company: round.company,
            amount: round.amount,
            round: round.round,
            date: round.date,
            investors: round.investors,
            valuation: round.valuation,
            description: round.description,
            source: 'Curated Database',
          });
        }
      }
    }

    // 2. Fetch breaking news from NewsAPI (only works for last ~30 days on free tier)
    let newsApiRounds: FundingRound[] = [];
    if (days <= 30) {
      try {
        const { rounds, error } = await fetchRoboticsFundingNews(days);
        if (!error && rounds.length > 0) {
          const existingCompanies = new Set(allRounds.map(r => r.company.toLowerCase()));

          for (const round of rounds) {
            if (!existingCompanies.has(round.company.toLowerCase())) {
              newsApiRounds.push({
                company: round.company,
                amount: round.amount,
                date: round.date,
                description: round.title,
                source: round.source,
                url: round.url,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Funding API] NewsAPI error:', err);
      }
    }

    // Combine and sort by date (most recent first)
    const combined = [...allRounds, ...newsApiRounds];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals
    const totalRaised = combined.reduce((sum, r) => sum + r.amount, 0);
    const avgRoundSize = combined.length > 0 ? totalRaised / combined.length : 0;

    return NextResponse.json({
      ok: true,
      data: {
        rounds: combined.slice(0, limit),
        totalRounds: combined.length,
        totalRaised,
        avgRoundSize,
        period: `Last ${days} days`,
        sources: {
          curated: allRounds.length,
          newsApi: newsApiRounds.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[Funding API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch funding data' },
      { status: 500 }
    );
  }
}
