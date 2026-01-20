import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { fetchCompanyNews, getNewsVelocity, isNewsAPIAvailable } from '@/lib/newsapi';
import { analyzeSentiment, isOpenAIAvailable } from '@/lib/openai';
import { buildConfidenceMeta } from '@/utils/confidence';
import type { PrivateCompany } from '@/types/companies';

export const runtime = 'nodejs';

// Cache for company data
let companiesCache: PrivateCompany[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300000; // 5 minutes

async function loadCompanies(): Promise<PrivateCompany[]> {
  const now = Date.now();
  if (companiesCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return companiesCache;
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'private_companies.v2.json');
  const data = await fs.readFile(filePath, 'utf-8');
  companiesCache = JSON.parse(data) as PrivateCompany[];
  cacheTimestamp = now;
  return companiesCache;
}

/**
 * Get sentiment label from numeric score
 */
function getSentimentLabel(sentiment: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (sentiment > 0.3) return 'BULLISH';
  if (sentiment < -0.3) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Format time ago string
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Missing companyId parameter' },
      { status: 400 }
    );
  }

  try {
    // Load companies to resolve ID to name
    const companies = await loadCompanies();
    const company = companies.find(
      c => c.id === companyId || c.name.toLowerCase() === companyId.toLowerCase()
    );

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found', companyId },
        { status: 404 }
      );
    }

    const companyName = company.name;

    // Check API availability
    const newsAvailable = isNewsAPIAvailable();
    const openAIAvailable = isOpenAIAvailable();

    if (!newsAvailable) {
      // Return mock data if NewsAPI is not available
      return NextResponse.json({
        ok: true,
        data: {
          companyId: company.id,
          companyName: company.name,
          newsVelocity: [0, 0, 0, 0, 0, 0, 0],
          sentiment: 0,
          sentimentLabel: 'NEUTRAL' as const,
          headlines: [],
          apiStatus: {
            newsAPI: false,
            openAI: openAIAvailable,
          },
        },
        _meta: buildConfidenceMeta(
          { companyId: company.id, newsAPI: false, openAI: openAIAvailable },
          'Signals Engine (No API Keys)'
        ),
      });
    }

    // Fetch news data
    const [newsResult, velocityResult] = await Promise.all([
      fetchCompanyNews(companyName, 7),
      getNewsVelocity(companyName, 7),
    ]);

    // Extract headlines
    const headlines = newsResult.articles.slice(0, 10).map(article => ({
      title: article.title,
      source: article.source.name,
      publishedAt: article.publishedAt,
      timeAgo: formatTimeAgo(article.publishedAt),
      url: article.url,
      sentiment: 0, // Will be populated below if OpenAI available
    }));

    // Analyze sentiment if OpenAI is available
    let overallSentiment = 0;
    let sentimentError: string | undefined;

    if (openAIAvailable && headlines.length > 0) {
      const headlineTitles = headlines.map(h => h.title);
      const sentimentResult = await analyzeSentiment(headlineTitles);
      overallSentiment = sentimentResult.sentiment;
      sentimentError = sentimentResult.error;

      // Assign individual sentiment (simplified: use overall for all)
      // In production, you'd analyze each headline individually
      headlines.forEach(h => {
        h.sentiment = overallSentiment;
      });
    }

    const result = {
      companyId: company.id,
      companyName: company.name,
      newsVelocity: velocityResult.velocity,
      sentiment: overallSentiment,
      sentimentLabel: getSentimentLabel(overallSentiment),
      headlines: headlines.slice(0, 5),
      totalArticles: newsResult.articles.length,
      apiStatus: {
        newsAPI: true,
        openAI: openAIAvailable,
      },
      errors: {
        news: newsResult.error,
        velocity: velocityResult.error,
        sentiment: sentimentError,
      },
    };

    // Remove undefined error fields
    if (!result.errors.news) delete result.errors.news;
    if (!result.errors.velocity) delete result.errors.velocity;
    if (!result.errors.sentiment) delete result.errors.sentiment;
    if (Object.keys(result.errors).length === 0) {
      delete (result as any).errors;
    }

    return NextResponse.json({
      ok: true,
      data: result,
      _meta: buildConfidenceMeta(
        { companyId: company.id, headlines: headlines.length, newsAPI: true, openAI: openAIAvailable },
        'NewsAPI + OpenAI'
      ),
    });
  } catch (error: any) {
    console.error('[Signals API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch signals',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
