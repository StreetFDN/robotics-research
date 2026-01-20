import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300; // Cache for 5 minutes

const NEWS_API_BASE = 'https://newsapi.org/v2';

interface NewsArticle {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage: string | null;
  author: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

// Robotics-related search terms for comprehensive coverage
const ROBOTICS_QUERY = `(
  "robotics" OR "humanoid robot" OR "robot company" OR
  "Boston Dynamics" OR "Figure AI" OR "Tesla Bot" OR "Optimus" OR
  "Agility Robotics" OR "Apptronik" OR "Sanctuary AI" OR "1X Technologies" OR
  "autonomous robot" OR "industrial robot" OR "robot startup" OR
  "robotic arm" OR "warehouse robot" OR "delivery robot"
) AND (funding OR launch OR partnership OR acquisition OR product OR breakthrough OR raise OR Series)`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '7', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10);

  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'NewsAPI key not configured',
      data: { articles: [] },
    }, { status: 503 });
  }

  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const params = new URLSearchParams({
      q: ROBOTICS_QUERY,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: String(Math.min(limit, 100)),
    });

    const response = await fetch(`${NEWS_API_BASE}/everything?${params}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Next.js cache
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NewsAPI] Request failed:', response.status, errorText);

      return NextResponse.json({
        ok: false,
        error: `NewsAPI error: ${response.status}`,
        data: { articles: [] },
      }, { status: response.status === 429 ? 429 : 502 });
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok') {
      return NextResponse.json({
        ok: false,
        error: 'NewsAPI returned error status',
        data: { articles: [] },
      }, { status: 502 });
    }

    // Transform articles into event-like format
    const articles = data.articles
      .filter(article => article.title && article.title !== '[Removed]')
      .map((article, index) => ({
        id: `news-${Date.parse(article.publishedAt)}-${index}`,
        title: article.title,
        description: article.description,
        source: article.source.name,
        publishedAt: article.publishedAt,
        url: article.url,
        imageUrl: article.urlToImage,
        author: article.author,
        type: categorizeArticle(article.title, article.description),
      }));

    return NextResponse.json({
      ok: true,
      data: {
        articles,
        totalResults: data.totalResults,
        fetchedAt: new Date().toISOString(),
      },
      _meta: {
        confidence: 0.85,
        source: 'NewsAPI',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[NewsAPI] Fetch error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch news',
      data: { articles: [] },
    }, { status: 500 });
  }
}

/**
 * Categorize article based on title/description keywords
 */
function categorizeArticle(title: string, description: string | null): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  if (text.includes('funding') || text.includes('raise') || text.includes('series') || text.includes('investment') || text.includes('valuation')) {
    return 'funding';
  }
  if (text.includes('launch') || text.includes('release') || text.includes('unveil') || text.includes('announce') || text.includes('debut')) {
    return 'product';
  }
  if (text.includes('partner') || text.includes('collaborat') || text.includes('deal') || text.includes('agreement')) {
    return 'partnership';
  }
  if (text.includes('acqui') || text.includes('merger') || text.includes('buy')) {
    return 'acquisition';
  }
  if (text.includes('hire') || text.includes('appoint') || text.includes('ceo') || text.includes('executive')) {
    return 'hiring';
  }
  if (text.includes('patent') || text.includes('research') || text.includes('breakthrough') || text.includes('study')) {
    return 'research';
  }

  return 'news';
}
