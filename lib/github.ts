/**
 * GitHub API Client
 * Track technical momentum via repository statistics
 * Docs: https://docs.github.com/en/rest
 */

const GITHUB_API_BASE = 'https://api.github.com';

// Cache configuration
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const momentumCache = new Map<string, CacheEntry<TechnicalMomentum | null>>();
const repoCache = new Map<string, CacheEntry<RepoStats[]>>();

// Known GitHub organizations/repos for robotics companies
export const COMPANY_GITHUB_MAP: Record<string, { org: string; repos?: string[] }> = {
  'boston-dynamics': { org: 'boston-dynamics', repos: ['spot-sdk', 'bosdyn-client'] },
  'boston dynamics': { org: 'boston-dynamics', repos: ['spot-sdk', 'bosdyn-client'] },
  'figure-ai': { org: 'figure-ai' },
  'figure ai': { org: 'figure-ai' },
  'agility-robotics': { org: 'agilityrobotics' },
  'agility robotics': { org: 'agilityrobotics' },
  'anduril': { org: 'anduril' },
  'skydio': { org: 'Skydio' },
  'nvidia': { org: 'NVIDIA', repos: ['Isaac', 'isaac_ros_common', 'IsaacGymEnvs'] },
  'open-robotics': { org: 'ros2', repos: ['ros2', 'rclcpp', 'rclpy'] },
  'ros': { org: 'ros2' },
  'unitree': { org: 'unitreerobotics' },
  'unitree robotics': { org: 'unitreerobotics' },
  'xiaomi': { org: 'XiaoMi', repos: ['mace'] },
  'google': { org: 'google-deepmind', repos: ['mujoco', 'dm_control'] },
  'deepmind': { org: 'google-deepmind', repos: ['mujoco', 'dm_control'] },
  'meta': { org: 'facebookresearch', repos: ['habitat-lab', 'habitat-sim'] },
  'facebook': { org: 'facebookresearch' },
  'tesla': { org: 'teslamotors' },
  'openai': { org: 'openai', repos: ['gym', 'baselines'] },
};

export interface RepoStats {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface CommitActivity {
  week: number; // Unix timestamp
  total: number;
  days: number[]; // Sun-Sat
}

export interface ContributorStats {
  author: string;
  avatarUrl: string;
  total: number;
  weeks: Array<{ w: number; a: number; d: number; c: number }>;
}

export interface TechnicalMomentum {
  organization: string;
  totalStars: number;
  totalForks: number;
  repoCount: number;
  topRepos: RepoStats[];
  weeklyCommits: number;
  monthlyCommits: number;
  starVelocity: number; // Estimated stars per month
  commitVelocity: number; // Commits per week
  activityScore: number; // 0-100
  lastActivity: string;
  topLanguages: Array<{ language: string; count: number }>;
}

/**
 * Get GitHub API headers
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RoboticsIntelligence/1.0'
  };

  // Add auth token if available (increases rate limit)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Get repository information
 */
export async function getRepoStats(owner: string, repo: string): Promise<RepoStats | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      console.error(`[GitHub] Failed to fetch repo ${owner}/${repo}:`, response.status);
      return null;
    }

    const data = await response.json();

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      url: data.html_url,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.subscribers_count,
      openIssues: data.open_issues_count,
      language: data.language || 'Unknown',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at
    };
  } catch (error) {
    console.error(`[GitHub] Error fetching repo ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Get organization's public repositories
 */
export async function getOrgRepos(org: string, limit: number = 30): Promise<RepoStats[]> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = `org:${org}:${limit}`;
  const cached = repoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[GitHub] Cache hit for org: ${org}`);
    return cached.data;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${org}/repos?sort=stars&direction=desc&per_page=${limit}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      // Check for rate limiting
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        if (rateLimitRemaining === '0') {
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'soon';
          console.error(`[GitHub] Rate limit exceeded. Resets at ${resetTime}`);
          return [];
        }
      }

      // Try as user if org fails
      const userResponse = await fetch(
        `${GITHUB_API_BASE}/users/${org}/repos?sort=stars&direction=desc&per_page=${limit}`,
        { headers: getHeaders() }
      );

      if (!userResponse.ok) {
        console.error(`[GitHub] Failed to fetch repos for ${org}: ${response.status}`);
        return [];
      }

      const userData = await userResponse.json();
      const repos = mapReposResponse(userData);

      // Cache the result
      repoCache.set(cacheKey, { data: repos, timestamp: Date.now() });
      console.log(`[GitHub] Org repos (user fallback) fetched in ${Date.now() - startTime}ms for ${org}`);
      return repos;
    }

    const data = await response.json();
    const repos = mapReposResponse(data);

    // Cache the result
    repoCache.set(cacheKey, { data: repos, timestamp: Date.now() });

    // Log response time
    console.log(`[GitHub] Org repos fetched in ${Date.now() - startTime}ms for ${org}, found ${repos.length} repos`);

    // Clean up old cache entries
    if (repoCache.size > 30) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of repoCache.entries()) {
        if (entry.timestamp < cutoff) {
          repoCache.delete(key);
        }
      }
    }

    return repos;
  } catch (error) {
    console.error(`[GitHub] Error fetching org repos for ${org}:`, error);
    return [];
  }
}

function mapReposResponse(data: any[]): RepoStats[] {
  return data.map(repo => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || '',
    url: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count || 0,
    openIssues: repo.open_issues_count,
    language: repo.language || 'Unknown',
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at
  }));
}

/**
 * Get commit activity for a repository (last year)
 */
export async function getCommitActivity(owner: string, repo: string): Promise<CommitActivity[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/commit_activity`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // GitHub may return 202 if stats are being computed
    if (response.status === 202 || !Array.isArray(data)) {
      return [];
    }

    return data.map((week: any) => ({
      week: week.week,
      total: week.total,
      days: week.days
    }));
  } catch (error) {
    console.error(`[GitHub] Error fetching commit activity for ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Search for repositories by topic/keyword
 */
export async function searchRepos(query: string, limit: number = 30): Promise<RepoStats[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      console.error('[GitHub] Search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return mapReposResponse(data.items || []);
  } catch (error) {
    console.error('[GitHub] Search error:', error);
    return [];
  }
}

/**
 * Get technical momentum for a company
 */
export async function getCompanyTechnicalMomentum(companyName: string): Promise<TechnicalMomentum | null> {
  const startTime = Date.now();

  // Normalize company name
  const normalizedName = companyName.toLowerCase().trim();

  // Check cache first
  const cacheKey = `momentum:${normalizedName}`;
  const cached = momentumCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[GitHub] Cache hit for momentum: ${companyName}`);
    return cached.data;
  }

  console.log(`[GitHub] Fetching technical momentum for: ${companyName}`);

  // Look up known GitHub mapping
  const mapping = COMPANY_GITHUB_MAP[normalizedName];

  if (!mapping) {
    // Try searching GitHub for the company
    const searchResults = await searchRepos(`${companyName} robotics`, 5);
    if (searchResults.length === 0) {
      // Cache null result too
      momentumCache.set(cacheKey, { data: null, timestamp: Date.now() });
      console.log(`[GitHub] No GitHub data found for ${companyName}`);
      return null;
    }

    // Use search results
    const totalStars = searchResults.reduce((sum, r) => sum + r.stars, 0);
    const totalForks = searchResults.reduce((sum, r) => sum + r.forks, 0);

    const result: TechnicalMomentum = {
      organization: companyName,
      totalStars,
      totalForks,
      repoCount: searchResults.length,
      topRepos: searchResults.slice(0, 5),
      weeklyCommits: 0,
      monthlyCommits: 0,
      starVelocity: 0,
      commitVelocity: 0,
      activityScore: calculateActivityScore(searchResults, []),
      lastActivity: searchResults[0]?.pushedAt || '',
      topLanguages: extractTopLanguages(searchResults)
    };

    // Cache the result
    momentumCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`[GitHub] Technical momentum (search) completed in ${Date.now() - startTime}ms for ${companyName}`);
    return result;
  }

  // Get org repos
  const repos = await getOrgRepos(mapping.org, 30);

  if (repos.length === 0) {
    return null;
  }

  // Calculate totals
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forks, 0);

  // Get commit activity for top repos
  const topRepos = repos.slice(0, 5);
  let totalWeeklyCommits = 0;
  let totalMonthlyCommits = 0;

  for (const repo of topRepos.slice(0, 3)) {
    const [owner] = repo.fullName.split('/');
    const activity = await getCommitActivity(owner, repo.name);

    if (activity.length > 0) {
      // Last week
      totalWeeklyCommits += activity[activity.length - 1]?.total || 0;
      // Last 4 weeks
      const lastMonth = activity.slice(-4);
      totalMonthlyCommits += lastMonth.reduce((sum, w) => sum + w.total, 0);
    }
  }

  // Find most recent activity
  const lastActivity = repos
    .map(r => r.pushedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] || '';

  const result: TechnicalMomentum = {
    organization: mapping.org,
    totalStars,
    totalForks,
    repoCount: repos.length,
    topRepos: topRepos,
    weeklyCommits: totalWeeklyCommits,
    monthlyCommits: totalMonthlyCommits,
    starVelocity: estimateStarVelocity(repos),
    commitVelocity: totalWeeklyCommits,
    activityScore: calculateActivityScore(repos, []),
    lastActivity,
    topLanguages: extractTopLanguages(repos)
  };

  // Cache the result
  momentumCache.set(cacheKey, { data: result, timestamp: Date.now() });

  // Log response time
  console.log(`[GitHub] Technical momentum completed in ${Date.now() - startTime}ms for ${companyName}`);

  // Clean up old cache entries
  if (momentumCache.size > 30) {
    const cutoff = Date.now() - CACHE_TTL_MS * 2;
    for (const [key, entry] of momentumCache.entries()) {
      if (entry.timestamp < cutoff) {
        momentumCache.delete(key);
      }
    }
  }

  return result;
}

/**
 * Estimate star velocity (stars per month) based on repo age and total stars
 */
function estimateStarVelocity(repos: RepoStats[]): number {
  let totalVelocity = 0;

  for (const repo of repos.slice(0, 5)) {
    const created = new Date(repo.createdAt);
    const now = new Date();
    const monthsAge = Math.max(1, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
    totalVelocity += repo.stars / monthsAge;
  }

  return Math.round(totalVelocity);
}

/**
 * Calculate activity score (0-100) based on various signals
 */
function calculateActivityScore(repos: RepoStats[], commitActivity: CommitActivity[]): number {
  if (repos.length === 0) return 0;

  let score = 0;

  // Star score (up to 30 points)
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  score += Math.min(30, Math.log10(totalStars + 1) * 10);

  // Recency score (up to 30 points)
  const mostRecent = repos
    .map(r => new Date(r.pushedAt).getTime())
    .sort((a, b) => b - a)[0];

  if (mostRecent) {
    const daysSinceUpdate = (Date.now() - mostRecent) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSinceUpdate);
  }

  // Repo count score (up to 20 points)
  score += Math.min(20, repos.length * 2);

  // Fork ratio score (up to 20 points)
  const totalForks = repos.reduce((sum, r) => sum + r.forks, 0);
  const forkRatio = totalStars > 0 ? totalForks / totalStars : 0;
  score += Math.min(20, forkRatio * 100);

  return Math.min(100, Math.round(score));
}

/**
 * Extract top programming languages from repos
 */
function extractTopLanguages(repos: RepoStats[]): Array<{ language: string; count: number }> {
  const langMap = new Map<string, number>();

  repos.forEach(repo => {
    if (repo.language && repo.language !== 'Unknown') {
      langMap.set(repo.language, (langMap.get(repo.language) || 0) + 1);
    }
  });

  return Array.from(langMap.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Search for robotics-related repositories
 */
export async function searchRoboticsRepos(limit: number = 30): Promise<RepoStats[]> {
  return searchRepos('topic:robotics OR topic:ros OR topic:robot', limit);
}

// ============================================
// Sprint 5: GitHub Intelligence Dashboard APIs
// ============================================

// Extended cache for expensive queries (24 hours)
const EXTENDED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Short cache for leaderboard (1 hour)
const LEADERBOARD_CACHE_TTL_MS = 60 * 60 * 1000;

const leaderboardCache = new Map<string, CacheEntry<OrgLeaderboardEntry[]>>();
const techstackCache = new Map<string, CacheEntry<LanguageAggregate[]>>();
const releasesCache = new Map<string, CacheEntry<ReleaseInfo[]>>();
const contributorsCache = new Map<string, CacheEntry<ContributorOverlap[]>>();

// Tracked robotics organizations for leaderboard
export const TRACKED_ROBOTICS_ORGS = [
  'boston-dynamics',
  'agilityrobotics',
  'anduril',
  'Skydio',
  'NVIDIA',
  'ros2',
  'unitreerobotics',
  'google-deepmind',
  'facebookresearch',
  'openai',
  'teslamotors',
];

export interface OrgLeaderboardEntry {
  name: string;
  displayName: string;
  commitsWeek: number;
  commitsMonth: number;
  starsTotal: number;
  topRepo: { name: string; stars: number };
  trend: 'up' | 'down' | 'stable';
  avatarUrl: string;
}

export interface LanguageAggregate {
  name: string;
  bytes: number;
  percentage: number;
  color: string;
  orgsUsing: string[];
}

export interface ReleaseInfo {
  org: string;
  repo: string;
  version: string;
  name: string;
  date: string;
  notes: string;
  url: string;
  isMajor: boolean;
}

export interface ContributorOverlap {
  username: string;
  avatarUrl: string;
  contributions: Array<{
    org: string;
    repo: string;
    commits: number;
  }>;
}

// GitHub language colors
const LANGUAGE_COLORS: Record<string, string> = {
  'Python': '#3572A5',
  'C++': '#f34b7d',
  'C': '#555555',
  'Rust': '#dea584',
  'Go': '#00ADD8',
  'TypeScript': '#3178c6',
  'JavaScript': '#f1e05a',
  'Java': '#b07219',
  'Kotlin': '#A97BFF',
  'Swift': '#F05138',
  'CUDA': '#3A4E3A',
  'CMake': '#DA3434',
  'Shell': '#89e051',
};

/**
 * Get org commit activity for leaderboard
 */
export async function getOrgLeaderboard(): Promise<OrgLeaderboardEntry[]> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = 'leaderboard:all';
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
    console.log('[GitHub] Cache hit for leaderboard');
    return cached.data;
  }

  console.log('[GitHub] Fetching leaderboard for', TRACKED_ROBOTICS_ORGS.length, 'orgs');

  const entries: OrgLeaderboardEntry[] = [];

  for (const org of TRACKED_ROBOTICS_ORGS) {
    try {
      // Get org info
      const orgInfo = await getOrgInfo(org);
      if (!orgInfo) continue;

      // Get repos for commit activity
      const repos = await getOrgRepos(org, 10);
      if (repos.length === 0) continue;

      // Calculate totals
      const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
      const topRepo = repos.sort((a, b) => b.stars - a.stars)[0];

      // Get commit activity for top repos
      let weeklyCommits = 0;
      let monthlyCommits = 0;
      let previousWeekCommits = 0;

      for (const repo of repos.slice(0, 3)) {
        const activity = await getCommitActivity(org, repo.name);
        if (activity.length > 0) {
          weeklyCommits += activity[activity.length - 1]?.total || 0;
          previousWeekCommits += activity[activity.length - 2]?.total || 0;
          const lastMonth = activity.slice(-4);
          monthlyCommits += lastMonth.reduce((sum, w) => sum + w.total, 0);
        }
      }

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (weeklyCommits > previousWeekCommits * 1.2) trend = 'up';
      else if (weeklyCommits < previousWeekCommits * 0.8) trend = 'down';

      entries.push({
        name: org,
        displayName: orgInfo.name || org,
        commitsWeek: weeklyCommits,
        commitsMonth: monthlyCommits,
        starsTotal: totalStars,
        topRepo: { name: topRepo?.name || '', stars: topRepo?.stars || 0 },
        trend,
        avatarUrl: orgInfo.avatarUrl || '',
      });
    } catch (error) {
      console.error(`[GitHub] Error fetching leaderboard for ${org}:`, error);
    }
  }

  // Sort by weekly commits
  entries.sort((a, b) => b.commitsWeek - a.commitsWeek);

  // Cache result
  leaderboardCache.set(cacheKey, { data: entries, timestamp: Date.now() });
  console.log(`[GitHub] Leaderboard completed in ${Date.now() - startTime}ms`);

  return entries;
}

/**
 * Get org basic info
 */
async function getOrgInfo(org: string): Promise<{ name: string; avatarUrl: string } | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      // Try as user
      const userResponse = await fetch(`${GITHUB_API_BASE}/users/${org}`, {
        headers: getHeaders()
      });
      if (!userResponse.ok) return null;
      const userData = await userResponse.json();
      return { name: userData.name || userData.login, avatarUrl: userData.avatar_url };
    }

    const data = await response.json();
    return { name: data.name || data.login, avatarUrl: data.avatar_url };
  } catch {
    return null;
  }
}

/**
 * Search trending robotics repos with star velocity
 */
export async function searchTrendingRepos(
  topic: string = 'robotics',
  days: number = 30,
  limit: number = 20
): Promise<Array<RepoStats & { starsDelta: number }>> {
  const startTime = Date.now();

  // Build date filter
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  const dateStr = dateFrom.toISOString().split('T')[0];

  // Build query based on topic
  let query = `topic:${topic} created:>${dateStr}`;
  if (topic === 'humanoid') {
    query = `(topic:humanoid OR topic:bipedal OR "humanoid robot") created:>${dateStr}`;
  } else if (topic === 'drones') {
    query = `(topic:drone OR topic:uav OR topic:quadcopter) created:>${dateStr}`;
  } else if (topic === 'ros') {
    query = `(topic:ros OR topic:ros2 OR topic:robotics-middleware) created:>${dateStr}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      console.error('[GitHub] Trending search failed:', response.status);
      return [];
    }

    const data = await response.json();
    const repos = mapReposResponse(data.items || []);

    // Calculate star delta (approximation based on repo age)
    const reposWithDelta = repos.map(repo => {
      const created = new Date(repo.createdAt);
      const now = new Date();
      const daysOld = Math.max(1, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const starsPerDay = repo.stars / daysOld;
      const starsDelta = Math.round(starsPerDay * 7); // Estimated stars in last 7 days
      return { ...repo, starsDelta };
    });

    console.log(`[GitHub] Trending search completed in ${Date.now() - startTime}ms, found ${repos.length} repos`);
    return reposWithDelta;
  } catch (error) {
    console.error('[GitHub] Trending search error:', error);
    return [];
  }
}

/**
 * Get aggregated language stats across tracked orgs
 */
export async function getLanguageStats(): Promise<LanguageAggregate[]> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = 'techstack:all';
  const cached = techstackCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EXTENDED_CACHE_TTL_MS) {
    console.log('[GitHub] Cache hit for techstack');
    return cached.data;
  }

  const langMap = new Map<string, { bytes: number; orgs: Set<string> }>();

  for (const org of TRACKED_ROBOTICS_ORGS) {
    try {
      const repos = await getOrgRepos(org, 15);

      for (const repo of repos.slice(0, 5)) {
        // Fetch language breakdown for each repo
        const langResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${org}/${repo.name}/languages`,
          { headers: getHeaders() }
        );

        if (langResponse.ok) {
          const languages: Record<string, number> = await langResponse.json();
          for (const [lang, bytes] of Object.entries(languages)) {
            const existing = langMap.get(lang) || { bytes: 0, orgs: new Set() };
            existing.bytes += bytes;
            existing.orgs.add(org);
            langMap.set(lang, existing);
          }
        }
      }
    } catch (error) {
      console.error(`[GitHub] Error fetching languages for ${org}:`, error);
    }
  }

  // Calculate percentages
  const totalBytes = Array.from(langMap.values()).reduce((sum, l) => sum + l.bytes, 0);

  const result: LanguageAggregate[] = Array.from(langMap.entries())
    .map(([name, data]) => ({
      name,
      bytes: data.bytes,
      percentage: Math.round((data.bytes / totalBytes) * 1000) / 10,
      color: LANGUAGE_COLORS[name] || '#666666',
      orgsUsing: Array.from(data.orgs),
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15);

  // Cache result
  techstackCache.set(cacheKey, { data: result, timestamp: Date.now() });
  console.log(`[GitHub] Techstack completed in ${Date.now() - startTime}ms`);

  return result;
}

/**
 * Get recent releases from tracked repos
 */
export async function getRecentReleases(days: number = 30): Promise<ReleaseInfo[]> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = `releases:${days}`;
  const cached = releasesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
    console.log('[GitHub] Cache hit for releases');
    return cached.data;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const releases: ReleaseInfo[] = [];

  // Priority repos for releases
  const priorityRepos = [
    { org: 'boston-dynamics', repo: 'spot-sdk' },
    { org: 'ros2', repo: 'ros2' },
    { org: 'NVIDIA', repo: 'Isaac' },
    { org: 'NVIDIA', repo: 'isaac_ros_common' },
    { org: 'google-deepmind', repo: 'mujoco' },
    { org: 'openai', repo: 'gym' },
    { org: 'facebookresearch', repo: 'habitat-lab' },
    { org: 'unitreerobotics', repo: 'unitree_legged_sdk' },
  ];

  for (const { org, repo } of priorityRepos) {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${org}/${repo}/releases?per_page=5`,
        { headers: getHeaders() }
      );

      if (!response.ok) continue;

      const data = await response.json();

      for (const release of data) {
        const releaseDate = new Date(release.published_at);
        if (releaseDate < cutoffDate) continue;

        const version = release.tag_name || release.name || '';
        const isMajor = /^v?\d+\.0(\.0)?$/.test(version) || /^v?[12]\.0/.test(version);

        releases.push({
          org,
          repo,
          version,
          name: release.name || version,
          date: release.published_at,
          notes: truncateNotes(release.body || ''),
          url: release.html_url,
          isMajor,
        });
      }
    } catch (error) {
      console.error(`[GitHub] Error fetching releases for ${org}/${repo}:`, error);
    }
  }

  // Sort by date (newest first)
  releases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Cache result
  releasesCache.set(cacheKey, { data: releases, timestamp: Date.now() });
  console.log(`[GitHub] Releases completed in ${Date.now() - startTime}ms, found ${releases.length} releases`);

  return releases;
}

/**
 * Truncate release notes to first ~200 chars
 */
function truncateNotes(notes: string): string {
  if (!notes) return '';
  const clean = notes.replace(/\r\n/g, '\n').split('\n')[0]; // First line
  return clean.length > 200 ? clean.slice(0, 200) + '...' : clean;
}

/**
 * Get contributor overlap between tracked orgs
 */
export async function getContributorOverlap(): Promise<ContributorOverlap[]> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = 'contributors:overlap';
  const cached = contributorsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EXTENDED_CACHE_TTL_MS) {
    console.log('[GitHub] Cache hit for contributor overlap');
    return cached.data;
  }

  // Map: username -> contributions across orgs
  type ContributorData = {
    avatarUrl: string;
    contributions: Array<{ org: string; repo: string; commits: number }>;
  };
  const contributorMap = new Map<string, ContributorData>();

  for (const org of TRACKED_ROBOTICS_ORGS.slice(0, 6)) { // Limit to avoid rate limits
    try {
      const repos = await getOrgRepos(org, 5);

      for (const repo of repos.slice(0, 2)) { // Top 2 repos per org
        const response = await fetch(
          `${GITHUB_API_BASE}/repos/${org}/${repo.name}/contributors?per_page=20`,
          { headers: getHeaders() }
        );

        if (!response.ok) continue;

        const contributors = await response.json();

        for (const contrib of contributors) {
          const username = contrib.login;
          const existing: ContributorData = contributorMap.get(username) || {
            avatarUrl: contrib.avatar_url,
            contributions: [] as Array<{ org: string; repo: string; commits: number }>
          };

          existing.contributions.push({
            org,
            repo: repo.name,
            commits: contrib.contributions,
          });

          contributorMap.set(username, existing);
        }
      }
    } catch (error) {
      console.error(`[GitHub] Error fetching contributors for ${org}:`, error);
    }
  }

  // Filter to contributors who appear in multiple orgs
  const overlappingContributors: ContributorOverlap[] = [];

  for (const [username, data] of contributorMap.entries()) {
    const uniqueOrgs = new Set(data.contributions.map(c => c.org));
    if (uniqueOrgs.size >= 2) {
      overlappingContributors.push({
        username,
        avatarUrl: data.avatarUrl,
        contributions: data.contributions,
      });
    }
  }

  // Sort by number of orgs contributed to
  overlappingContributors.sort((a, b) => {
    const aOrgs = new Set(a.contributions.map(c => c.org)).size;
    const bOrgs = new Set(b.contributions.map(c => c.org)).size;
    return bOrgs - aOrgs;
  });

  // Take top 30
  const result = overlappingContributors.slice(0, 30);

  // Cache result
  contributorsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  console.log(`[GitHub] Contributor overlap completed in ${Date.now() - startTime}ms, found ${result.length} overlapping contributors`);

  return result;
}
