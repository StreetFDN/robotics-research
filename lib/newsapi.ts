/**
 * NewsAPI Client Wrapper
 * Provides functions to fetch company news and compute news velocity
 */

const NEWS_API_BASE = 'https://newsapi.org/v2';
const CACHE_TTL_MS = 300000; // 5 minutes

export interface NewsArticle {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
  url: string;
  urlToImage: string | null;
}

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

// In-memory cache
interface CacheEntry {
  data: NewsArticle[];
  timestamp: number;
}

const newsCache = new Map<string, CacheEntry>();

/**
 * Get API key from environment
 */
function getApiKey(): string | null {
  return process.env.NEWS_API_KEY || null;
}

/**
 * Build search query for a company
 * Includes company name and common robotics-related terms
 */
function buildSearchQuery(companyName: string): string {
  // Clean company name and add relevant context
  const cleanName = companyName.replace(/[^\w\s]/g, '').trim();
  return `"${cleanName}" AND (robotics OR robot OR AI OR funding OR startup)`;
}

/**
 * Fetch news articles for a company
 */
export async function fetchCompanyNews(
  companyName: string,
  days: number = 7
): Promise<{ articles: NewsArticle[]; error?: string }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[NewsAPI] No API key configured');
    return { articles: [], error: 'NewsAPI key not configured' };
  }

  const cacheKey = `${companyName}:${days}`;
  const cached = newsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { articles: cached.data };
  }

  try {
    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const query = buildSearchQuery(companyName);
    const params = new URLSearchParams({
      q: query,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: '100',
    });

    const url = `${NEWS_API_BASE}/everything?${params}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NewsAPI] Request failed:', response.status, errorText);

      if (response.status === 401) {
        return { articles: [], error: 'Invalid NewsAPI key' };
      }
      if (response.status === 429) {
        return { articles: [], error: 'NewsAPI rate limit exceeded' };
      }
      return { articles: [], error: `NewsAPI error: ${response.status}` };
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok') {
      return { articles: [], error: 'NewsAPI returned error status' };
    }

    // Cache the results
    newsCache.set(cacheKey, { data: data.articles, timestamp: Date.now() });

    // Clean up old cache entries
    if (newsCache.size > 50) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of newsCache.entries()) {
        if (entry.timestamp < cutoff) {
          newsCache.delete(key);
        }
      }
    }

    return { articles: data.articles };
  } catch (error: any) {
    console.error('[NewsAPI] Fetch error:', error);
    return { articles: [], error: error.message || 'Failed to fetch news' };
  }
}

/**
 * Get news velocity (daily mention counts) for the past N days
 */
export async function getNewsVelocity(
  companyName: string,
  days: number = 7
): Promise<{ velocity: number[]; error?: string }> {
  const { articles, error } = await fetchCompanyNews(companyName, days);

  if (error) {
    // Return zeros if there's an error
    return { velocity: new Array(days).fill(0), error };
  }

  // Initialize counts for each day
  const dailyCounts: number[] = new Array(days).fill(0);
  const now = new Date();

  for (const article of articles) {
    const articleDate = new Date(article.publishedAt);
    const daysDiff = Math.floor((now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 0 && daysDiff < days) {
      // Index from oldest to newest (0 = oldest day, days-1 = today)
      dailyCounts[days - 1 - daysDiff]++;
    }
  }

  return { velocity: dailyCounts };
}

/**
 * Check if NewsAPI is available (has API key)
 */
export function isNewsAPIAvailable(): boolean {
  return !!getApiKey();
}

/**
 * Get recent headlines for a company (formatted for display)
 */
export async function getRecentHeadlines(
  companyName: string,
  limit: number = 5
): Promise<{ headlines: Array<{ title: string; source: string; publishedAt: string; url: string }>; error?: string }> {
  const { articles, error } = await fetchCompanyNews(companyName, 7);

  if (error) {
    return { headlines: [], error };
  }

  const headlines = articles
    .slice(0, limit)
    .map(article => ({
      title: article.title,
      source: article.source.name,
      publishedAt: article.publishedAt,
      url: article.url,
    }));

  return { headlines };
}

// ============================================================================
// FUNDING NEWS PARSER
// ============================================================================

export interface FundingRound {
  company: string;
  amount: number;  // In USD
  date: string;    // ISO date
  source: string;
  url: string;
  title: string;
}

// Regex patterns to extract funding amounts
const FUNDING_PATTERNS = [
  // "$X million" or "$X billion"
  /\$\s*(\d+(?:\.\d+)?)\s*(million|billion|m|b)\b/gi,
  // "X million dollars" or "X billion dollars"
  /(\d+(?:\.\d+)?)\s*(million|billion)\s*dollars?/gi,
  // "raises $X" or "raised $X"
  /raises?\s*\$\s*(\d+(?:\.\d+)?)\s*(million|billion|m|b)?/gi,
  // "funding of $X" or "funding round of $X"
  /funding\s*(?:round\s*)?(?:of\s*)?\$\s*(\d+(?:\.\d+)?)\s*(million|billion|m|b)?/gi,
  // "Series X at $Y valuation" - try to extract the raise amount
  /series\s*[a-z]\s*(?:round\s*)?(?:of\s*)?\$?\s*(\d+(?:\.\d+)?)\s*(million|billion|m|b)?/gi,
];

// Keywords that indicate funding news
const FUNDING_KEYWORDS = [
  'raises', 'raised', 'funding', 'series a', 'series b', 'series c', 'series d',
  'seed round', 'investment', 'venture', 'capital', 'financing', 'secures',
  'closes', 'announces', 'led by', 'valuation'
];

// Known robotics companies to look for
const ROBOTICS_COMPANIES = [
  'Figure', 'Figure AI', '1X', '1X Technologies', 'Apptronik', 'Agility',
  'Agility Robotics', 'Boston Dynamics', 'Sanctuary', 'Sanctuary AI',
  'Physical Intelligence', 'Skild', 'Skild AI', 'Covariant', 'Dexterity',
  'Locus Robotics', 'Berkshire Grey', 'Nuro', 'Aurora', 'Waymo', 'Cruise',
  'Anduril', 'Shield AI', 'Sarcos', 'Exotec', 'GreyOrange', 'Fetch Robotics',
  'Realtime Robotics', 'Symbotic', 'Plus One Robotics', 'RightHand Robotics',
  'Vecna Robotics', 'Brain Corp', 'Starship', 'Serve Robotics', 'Nuro',
  'Ghost Robotics', 'Unitree', 'UBTECH', 'Keenon', 'Pudu', 'Bear Robotics'
];

/**
 * Parse funding amount from text
 * Returns amount in USD
 */
function parseFundingAmount(text: string): number | null {
  const lowerText = text.toLowerCase();

  for (const pattern of FUNDING_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    const match = pattern.exec(lowerText);

    if (match) {
      const value = parseFloat(match[1]);
      const unit = (match[2] || '').toLowerCase();

      if (isNaN(value)) continue;

      // Convert to USD
      if (unit === 'billion' || unit === 'b') {
        return value * 1_000_000_000;
      } else if (unit === 'million' || unit === 'm' || !unit) {
        // Default to millions if no unit specified for large numbers
        return value >= 1000 ? value : value * 1_000_000;
      }
    }
  }

  return null;
}

/**
 * Extract company name from article
 */
function extractCompanyName(article: NewsArticle): string | null {
  const text = `${article.title} ${article.description || ''}`;

  // Check for known robotics companies
  for (const company of ROBOTICS_COMPANIES) {
    if (text.toLowerCase().includes(company.toLowerCase())) {
      return company;
    }
  }

  // Try to extract company name from common patterns
  // "CompanyName raises $X" or "CompanyName secures $X"
  const patterns = [
    /^([A-Z][a-zA-Z0-9\s]+?)\s+(?:raises?|secures?|closes?|announces?)/i,
    /([A-Z][a-zA-Z0-9]+(?:\s+(?:AI|Robotics|Technologies))?)\s+(?:raises?|secures?)/i,
  ];

  for (const pattern of patterns) {
    const match = article.title.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common false positives
      if (name.length > 2 && name.length < 50 && !name.match(/^(The|A|An|This|That)$/i)) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Check if article is about funding
 */
function isFundingArticle(article: NewsArticle): boolean {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  // Must have at least one funding keyword
  const hasFundingKeyword = FUNDING_KEYWORDS.some(kw => text.includes(kw));
  if (!hasFundingKeyword) return false;

  // Must mention a dollar amount
  const hasDollarAmount = /\$\s*\d+/.test(text) || /\d+\s*(million|billion)/i.test(text);
  if (!hasDollarAmount) return false;

  // Should be robotics/AI related
  const isRoboticsRelated = /robot|autonom|ai|artificial intelligence|machine learning|automation/i.test(text);

  return isRoboticsRelated;
}

/**
 * Fetch and parse robotics funding news
 */
export async function fetchRoboticsFundingNews(days: number = 90): Promise<{
  rounds: FundingRound[];
  error?: string;
}> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[NewsAPI] No API key configured for funding search');
    return { rounds: [], error: 'NewsAPI key not configured' };
  }

  try {
    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Search for robotics funding news
    const query = '(robotics OR "robot company" OR "AI startup" OR humanoid) AND (raises OR raised OR funding OR "series a" OR "series b" OR "series c" OR investment) AND (million OR billion)';

    const params = new URLSearchParams({
      q: query,
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: '100',
    });

    const url = `${NEWS_API_BASE}/everything?${params}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NewsAPI] Funding search failed:', response.status, errorText);
      return { rounds: [], error: `NewsAPI error: ${response.status}` };
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok') {
      return { rounds: [], error: 'NewsAPI returned error status' };
    }

    // Parse articles for funding rounds
    const rounds: FundingRound[] = [];
    const seenCompanies = new Set<string>();

    for (const article of data.articles) {
      if (!isFundingArticle(article)) continue;

      const company = extractCompanyName(article);
      if (!company) continue;

      // Dedupe by company (keep most recent)
      const companyKey = company.toLowerCase();
      if (seenCompanies.has(companyKey)) continue;

      const amount = parseFundingAmount(`${article.title} ${article.description || ''}`);
      if (!amount || amount < 1_000_000) continue; // Skip small amounts

      seenCompanies.add(companyKey);

      rounds.push({
        company,
        amount,
        date: article.publishedAt.split('T')[0],
        source: article.source.name,
        url: article.url,
        title: article.title,
      });
    }

    // Sort by date (most recent first)
    rounds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`[NewsAPI] Found ${rounds.length} funding rounds from ${data.articles.length} articles`);

    return { rounds };
  } catch (error: any) {
    console.error('[NewsAPI] Funding fetch error:', error);
    return { rounds: [], error: error.message || 'Failed to fetch funding news' };
  }
}
