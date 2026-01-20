/**
 * Centralized copy/microcopy constants
 * Owner: A6 (UX/IA + Copy)
 *
 * Guidelines:
 * - Intel-grade tone: concise, precise, no casual phrasing
 * - Avoid hedging language ("maybe", "might", "could be")
 * - Use em-dash (—) for pauses, not hyphens
 */

// =============================================================================
// CONFIDENCE INDICATORS
// =============================================================================

export const CONFIDENCE_TOOLTIPS = {
  high: 'High confidence — data is complete and recent',
  medium: 'Moderate confidence — some data may be incomplete',
  low: 'Low confidence — significant data gaps',
} as const;

export const CONFIDENCE_LABELS = {
  high: 'High',
  medium: 'Moderate',
  low: 'Low',
} as const;

/**
 * Get tooltip text based on confidence value (0-1)
 */
export function getConfidenceTooltip(confidence: number): string {
  if (confidence > 0.8) return CONFIDENCE_TOOLTIPS.high;
  if (confidence >= 0.5) return CONFIDENCE_TOOLTIPS.medium;
  return CONFIDENCE_TOOLTIPS.low;
}

// =============================================================================
// COMMAND BAR
// =============================================================================

export const COMMAND_BAR = {
  placeholder: 'Search companies, filter by region, or type a command...',
  helperText: "Try: 'show funding > $10M' or 'compare Figure vs Boston Dynamics'",
  emptyState: 'No results found',
  loadingText: 'Searching...',
} as const;

// =============================================================================
// COMMAND BAR — EXAMPLE COMMANDS
// =============================================================================

export const COMMAND_EXAMPLES = [
  { command: 'show funding > $10M', description: 'Filter by funding amount' },
  { command: 'region: Asia', description: 'Filter by geographic region' },
  { command: 'compare Figure vs Boston Dynamics', description: 'Side-by-side comparison' },
  { command: 'sort by valuation', description: 'Sort companies by valuation' },
  { command: 'humanoid robots', description: 'Search by category' },
] as const;

// =============================================================================
// DATA PROVENANCE
// =============================================================================

export const PROVENANCE_LABELS = {
  lastUpdated: 'Last updated',
  source: 'Source',
  completeness: 'Data completeness',
} as const;

// =============================================================================
// ACCESSIBILITY
// =============================================================================

export const ARIA_LABELS = {
  confidenceBadge: (pct: number) => `Data confidence: ${pct}%`,
  commandBarOpen: 'Open command bar',
  commandBarClose: 'Close command bar',
  commandBarInput: 'Enter search query or command',
} as const;

// =============================================================================
// POWER ANALYSIS (Sprint 2)
// =============================================================================

export const POWER_PANEL = {
  title: 'POWER ANALYSIS',
  factorsHeader: 'POWER FACTORS',
  contributorsHeader: 'TOP CONTRIBUTORS',
  vulnerabilitiesHeader: 'VULNERABILITIES',
} as const;

/**
 * Standardized power factor names
 * Use ALL CAPS for display consistency with intel aesthetic
 */
export const POWER_FACTORS = {
  funding: 'FUNDING STRENGTH',
  technology: 'TECHNOLOGY MOAT',
  talent: 'TALENT DENSITY',
  market: 'MARKET POSITION',
  strategic: 'STRATEGIC BACKING',
} as const;

/**
 * Explanation templates for power factors
 * Use template literals with placeholders: {amount}, {rounds}, {specialty}, {count}, {source}
 */
export const POWER_EXPLANATIONS = {
  funding: {
    high: '{amount} raised across {rounds} rounds',
    medium: '{amount} raised — moderate funding trajectory',
    low: 'Early-stage funding — {amount} raised',
  },
  technology: {
    high: 'Industry-leading {specialty}',
    medium: 'Established {specialty} capabilities',
    low: 'Developing {specialty} technology',
  },
  talent: {
    high: '{count}+ team members, {source} talent pipeline',
    medium: '{count} team members with domain expertise',
    low: 'Small team — {count} members',
  },
  market: {
    high: 'Dominant position in {segment}',
    medium: 'Growing presence in {segment}',
    low: 'Emerging player in {segment}',
  },
  strategic: {
    high: 'Backed by {backer} — deep strategic alignment',
    medium: 'Strategic investment from {backer}',
    low: 'Limited strategic partnerships',
  },
} as const;

export const POWER_EMPTY_STATES = {
  noData: 'Power analysis unavailable for this entity',
  loading: 'Analyzing power factors...',
  error: 'Unable to compute power analysis',
} as const;

// =============================================================================
// SIMILARITY EXPLORER (Sprint 2)
// =============================================================================

export const SIMILARITY_PANEL = {
  title: 'SIMILAR ENTITIES',
  matchLabel: (pct: number) => `${Math.round(pct * 100)}% MATCH`,
  sharedTraitsHeader: 'COMMON FACTORS',
  differencesHeader: 'KEY DIFFERENCES',
} as const;

export const SIMILARITY_EMPTY_STATES = {
  noResults: 'No similar entities found in current dataset',
  loading: 'Identifying similar entities...',
  error: 'Unable to compute similarity',
} as const;

/**
 * Trait display names — maps internal trait keys to user-facing labels
 */
export const TRAIT_LABELS: Record<string, string> = {
  humanoid: 'Humanoid Robotics',
  'venture-backed': 'Venture-Backed',
  'us-based': 'US-Based',
  'asia-based': 'Asia-Based',
  'europe-based': 'Europe-Based',
  'early-stage': 'Early Stage',
  'growth-stage': 'Growth Stage',
  'late-stage': 'Late Stage',
  'hardware-focused': 'Hardware Focus',
  'software-focused': 'Software Focus',
  'ai-native': 'AI-Native',
  autonomous: 'Autonomous Systems',
  industrial: 'Industrial Applications',
  consumer: 'Consumer Applications',
  defense: 'Defense/Aerospace',
  logistics: 'Logistics/Delivery',
  healthcare: 'Healthcare',
  manufacturing: 'Manufacturing',
} as const;

/**
 * Format trait for display — looks up label or title-cases raw trait
 */
export function formatTrait(trait: string): string {
  const normalized = trait.toLowerCase().replace(/\s+/g, '-');
  return TRAIT_LABELS[normalized] ?? trait.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// =============================================================================
// COMPARISON COPY (Sprint 2)
// =============================================================================

export const COMPARISON = {
  greaterThan: 'outperforms',
  lessThan: 'trails',
  equal: 'matches',
  vsLabel: 'vs',
} as const;

// =============================================================================
// ACCESSIBILITY (Sprint 2 additions)
// =============================================================================

export const ARIA_LABELS_SPRINT2 = {
  powerPanel: 'Power analysis panel',
  powerFactor: (name: string, score: number) => `${name}: ${score} out of 100`,
  similarityPanel: 'Similar entities panel',
  similarCompany: (name: string, pct: number) => `${name}, ${Math.round(pct * 100)}% similar`,
  expandDetails: 'Expand details',
  collapseDetails: 'Collapse details',
} as const;

// =============================================================================
// EARLY WARNING SIGNALS (Sprint 3)
// =============================================================================

export const SIGNALS_PANEL = {
  title: 'EARLY WARNING',
  velocityLabel: 'NEWS VELOCITY (7D)',
  sentimentLabel: 'SENTIMENT SIGNAL',
  headlinesHeader: 'RECENT COVERAGE',
} as const;

/**
 * Sentiment labels — thresholds: >0.3 bullish, <-0.3 bearish, else neutral
 */
export const SENTIMENT_LABELS = {
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  neutral: 'NEUTRAL',
} as const;

/**
 * Get sentiment label based on score (-1 to 1)
 */
export function getSentimentLabel(sentiment: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (sentiment > 0.3) return 'BULLISH';
  if (sentiment < -0.3) return 'BEARISH';
  return 'NEUTRAL';
}

export const SIGNALS_TOOLTIPS = {
  newsVelocity: 'Daily mention count over the past 7 days',
  sentiment: 'Aggregate sentiment from recent headlines (-1 bearish to +1 bullish)',
  headline: (source: string) => `Source: ${source}`,
} as const;

export const SIGNALS_EMPTY_STATES = {
  noNews: 'No recent news coverage for this entity',
  loading: 'Fetching news signals...',
  error: 'Unable to retrieve news data',
  apiUnavailable: 'News data unavailable — API limit reached',
} as const;

// =============================================================================
// COMMAND BAR — NLP PARSING (Sprint 3)
// =============================================================================

/**
 * Updated command bar copy for NLP-powered parsing
 */
export const COMMAND_BAR_NLP = {
  placeholder: 'Search or enter a command...',
  parsing: 'Interpreting command...',
  successPreview: (action: string) => `Will apply: ${action}`,
  error: "Could not interpret command. Try: 'show humanoid companies'",
  fallbackHint: "Command not recognized. Examples: 'filter by humanoid', 'select Figure AI'",
} as const;

/**
 * Action descriptions for command preview
 */
export const COMMAND_ACTION_DESCRIPTIONS: Record<string, (params: Record<string, unknown>) => string> = {
  filter: (p) => {
    if (p.tags) return `Filter by: ${(p.tags as string[]).join(', ')}`;
    if (p.field && p.operator && p.value) {
      const opMap: Record<string, string> = { gt: '>', lt: '<', eq: '=', contains: 'contains' };
      return `Filter: ${p.field} ${opMap[p.operator as string] || p.operator} ${p.value}`;
    }
    return 'Apply filter';
  },
  select: (p) => `Select: ${p.companyName}`,
  compare: (p) => `Compare: ${(p.companies as string[]).join(' vs ')}`,
  search: (p) => `Search: "${p.query}"`,
} as const;

/**
 * Format command action for user preview
 */
export function formatCommandPreview(action: string, params: Record<string, unknown>): string {
  const formatter = COMMAND_ACTION_DESCRIPTIONS[action];
  return formatter ? formatter(params) : `Execute: ${action}`;
}

export const COMMAND_EXAMPLES_NLP = [
  { command: 'show humanoid companies', description: 'Filter by category' },
  { command: 'select Figure AI', description: 'Select a specific company' },
  { command: 'compare Boston Dynamics and Figure', description: 'Compare two companies' },
  { command: 'funding greater than $50M', description: 'Filter by funding amount' },
  { command: 'companies in Asia', description: 'Filter by region' },
] as const;

// =============================================================================
// TIME FORMATTING (Sprint 3)
// =============================================================================

export const TIME_LABELS = {
  justNow: 'Just now',
  minutesAgo: (n: number) => `${n}m ago`,
  hoursAgo: (n: number) => `${n}h ago`,
  daysAgo: (n: number) => `${n}d ago`,
  weeksAgo: (n: number) => `${n}w ago`,
} as const;

// =============================================================================
// ACCESSIBILITY (Sprint 3 additions)
// =============================================================================

export const ARIA_LABELS_SPRINT3 = {
  signalsPanel: 'Early warning signals panel',
  newsVelocity: 'News velocity chart showing 7-day mention trend',
  sentimentIndicator: (label: string, value: number) =>
    `Sentiment: ${label}, score ${value.toFixed(2)}`,
  headline: (title: string, source: string) => `Headline: ${title}, from ${source}`,
  sparkLine: (trend: 'up' | 'down' | 'flat') => `Trend chart showing ${trend}ward movement`,
  commandInput: 'Enter natural language command',
  commandParsing: 'Processing command',
} as const;

// =============================================================================
// GOVERNMENT CONTRACTS (Sprint 4)
// =============================================================================

export const CONTRACTS_PANEL = {
  title: 'GOVERNMENT CONTRACTS',
  totalAwardedLabel: 'TOTAL AWARDED',
  activeContractsLabel: 'ACTIVE CONTRACTS',
  topAgencyLabel: 'TOP AGENCY',
  recentAwardsLabel: 'RECENT AWARDS',
  yearlyTrendLabel: 'YEARLY TREND',
  sourceLabel: 'Source: USASpending.gov',
  viewAllLabel: 'VIEW ALL →',
} as const;

export const CONTRACTS_METRICS = {
  ofTotal: (active: number, total: number) => `of ${total} total`,
  yearOverYear: (change: number) => `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% YoY`,
  showMore: (count: number) => `+${count} MORE`,
  showLess: 'SHOW LESS',
} as const;

export const CONTRACTS_EMPTY_STATES = {
  noContracts: 'No government contracts found',
  loading: 'Searching USASpending.gov...',
  error: 'Failed to fetch contract data',
  rateLimited: 'API rate limit reached — try again later',
} as const;

export const CONTRACTS_TOOLTIPS = {
  totalAwarded: 'Cumulative value of all federal contract awards',
  activeContracts: 'Contracts currently in active performance period',
  topAgency: 'Federal agency with highest contract value',
  yearlyTrend: 'Contract award amounts by fiscal year',
} as const;

// =============================================================================
// TECHNICAL MOMENTUM / GITHUB (Sprint 4)
// =============================================================================

export const GITHUB_PANEL = {
  title: 'TECHNICAL MOMENTUM',
  activityScoreLabel: 'ACTIVITY SCORE',
  starsLabel: 'Stars',
  forksLabel: 'Forks',
  reposLabel: 'Repos',
  starVelocityLabel: 'Star Velocity',
  commitRateLabel: 'Commit Rate',
  topLanguagesLabel: 'TOP LANGUAGES',
  topReposLabel: 'TOP REPOSITORIES',
  lastActivityLabel: (timeAgo: string) => `Last activity: ${timeAgo}`,
  viewOnGitHub: 'VIEW ON GITHUB →',
} as const;

export const GITHUB_METRICS = {
  activityScore: (score: number) => `${score}/100`,
  starVelocity: (count: number) => `+${count}/mo`,
  commitRate: (count: number) => `${count}/week`,
  starsCount: (count: number) => `⭐ ${count}`,
  updated: (timeAgo: string) => `Updated ${timeAgo}`,
} as const;

export const GITHUB_EMPTY_STATES = {
  noPresence: 'No GitHub presence found',
  loading: 'Searching GitHub...',
  error: 'Failed to fetch GitHub data',
  rateLimited: 'GitHub API rate limit reached',
} as const;

export const GITHUB_TOOLTIPS = {
  activityScore: 'Composite score based on commits, stars, and recent activity (0-100)',
  starVelocity: 'Average new stars gained per month',
  commitRate: 'Average commits per week across all repositories',
  topLanguages: 'Most frequently used programming languages',
} as const;

/**
 * Activity score thresholds for color coding
 * High: >= 70 (green), Medium: >= 40 (amber), Low: < 40 (red)
 */
export const GITHUB_ACTIVITY_THRESHOLDS = {
  high: 70,
  medium: 40,
} as const;

export function getActivityScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.high) return 'high';
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

// =============================================================================
// ACCESSIBILITY (Sprint 4 additions)
// =============================================================================

export const ARIA_LABELS_SPRINT4 = {
  contractsPanel: 'Government contracts panel',
  contractCard: (amount: string, agency: string) => `Contract: ${amount} from ${agency}`,
  contractsTrend: 'Yearly contract award trend chart',
  githubPanel: 'Technical momentum panel showing GitHub activity',
  activityScore: (score: number) => `Activity score: ${score} out of 100`,
  repoCard: (name: string, stars: number) => `Repository: ${name}, ${stars} stars`,
  languageBadge: (lang: string) => `Programming language: ${lang}`,
} as const;

// =============================================================================
// GITHUB INTELLIGENCE DASHBOARD (Sprint 5)
// =============================================================================

/**
 * Section header for the GitHub Intelligence feature set
 */
export const GITHUB_INTEL_SECTION = {
  title: 'GITHUB INTELLIGENCE',
  subtitle: 'Open source activity across the robotics ecosystem',
} as const;

// -----------------------------------------------------------------------------
// 1. LEADERBOARD
// -----------------------------------------------------------------------------

export const LEADERBOARD_PANEL = {
  title: 'OPEN SOURCE LEADERBOARD',
  subtitle: 'Weekly commit activity rankings',
  columns: {
    rank: '#',
    org: 'ORGANIZATION',
    commitsWeek: 'COMMITS/WK',
    starsTotal: 'TOTAL STARS',
    topRepo: 'TOP REPO',
    trend: 'TREND',
  },
  sortOptions: ['Commits', 'Stars', 'Repos', 'Velocity'],
} as const;

export const LEADERBOARD_BADGES = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
} as const;

export const LEADERBOARD_TRENDS = {
  up: '↑',
  down: '↓',
  stable: '—',
} as const;

export const LEADERBOARD_EMPTY_STATES = {
  noData: 'No leaderboard data available',
  loading: 'Ranking organizations by commit activity...',
  error: 'Failed to load leaderboard',
} as const;

// -----------------------------------------------------------------------------
// 2. TRENDING REPOS
// -----------------------------------------------------------------------------

export const TRENDING_PANEL = {
  title: 'TRENDING REPOSITORIES',
  subtitle: 'Fastest-growing robotics repos this week',
  filterLabel: 'FILTER BY TOPIC',
  filters: [
    { key: 'all', label: 'All' },
    { key: 'humanoid', label: 'Humanoid' },
    { key: 'drones', label: 'Drones' },
    { key: 'manipulation', label: 'Manipulation' },
    { key: 'ros', label: 'ROS' },
    { key: 'ml', label: 'ML/AI' },
  ],
} as const;

export const TRENDING_METRICS = {
  starDelta: (delta: number) => `+${delta} this week`,
  starsTotal: (count: number) => `⭐ ${count}`,
} as const;

export const TRENDING_EMPTY_STATES = {
  noRepos: 'No trending repos found for this filter',
  loading: 'Discovering trending repositories...',
  error: 'Failed to load trending repos',
} as const;

// -----------------------------------------------------------------------------
// 3. TECH STACK ANALYSIS
// -----------------------------------------------------------------------------

export const TECHSTACK_PANEL = {
  title: 'TECH STACK ANALYSIS',
  subtitle: 'Language distribution across robotics organizations',
  legendLabel: 'LANGUAGES',
  chartLabel: 'DISTRIBUTION',
} as const;

export const TECHSTACK_LABELS = {
  bytesLabel: 'bytes of code',
  percentageLabel: (pct: number) => `${pct.toFixed(1)}%`,
  orgsUsing: (count: number) => `${count} orgs`,
} as const;

/**
 * GitHub language colors (official)
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3572A5',
  'C++': '#f34b7d',
  C: '#555555',
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CUDA: '#3A4E3A',
  Shell: '#89e051',
  CMake: '#DA3434',
  Jupyter: '#F37626',
  MATLAB: '#e16737',
} as const;

export const TECHSTACK_EMPTY_STATES = {
  noData: 'No language data available',
  loading: 'Analyzing tech stacks...',
  error: 'Failed to load tech stack data',
} as const;

// -----------------------------------------------------------------------------
// 4. RELEASE RADAR
// -----------------------------------------------------------------------------

export const RELEASES_PANEL = {
  title: 'RELEASE RADAR',
  subtitle: 'Recent releases from tracked repositories',
  viewChangelogLabel: 'VIEW CHANGELOG',
  majorReleaseLabel: 'MAJOR',
  minorReleaseLabel: 'MINOR',
  patchReleaseLabel: 'PATCH',
} as const;

export const RELEASES_METRICS = {
  version: (v: string) => `v${v}`,
  daysAgo: (days: number) => days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`,
} as const;

/**
 * Detect release type from semantic version
 */
export function getReleaseType(version: string): 'major' | 'minor' | 'patch' {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return 'patch';
  const [, major, minor] = match;
  if (minor === '0' && major !== '0') return 'major';
  if (parseInt(major) > 0 || parseInt(minor) > 0) return 'minor';
  return 'patch';
}

export const RELEASES_EMPTY_STATES = {
  noReleases: 'No recent releases from tracked repositories',
  loading: 'Scanning release activity...',
  error: 'Failed to load releases',
} as const;

// -----------------------------------------------------------------------------
// 5. CONTRIBUTOR FLOW
// -----------------------------------------------------------------------------

export const CONTRIBUTORS_PANEL = {
  title: 'CONTRIBUTOR FLOW',
  subtitle: 'Developer movement between robotics organizations',
  flowLabel: 'TALENT MIGRATION',
  tableHeaders: {
    contributor: 'CONTRIBUTOR',
    from: 'FROM',
    to: 'TO',
    contributions: 'CONTRIBUTIONS',
  },
} as const;

export const CONTRIBUTORS_METRICS = {
  flowDescription: (from: string, to: string, count: number) =>
    `${count} contributor${count > 1 ? 's' : ''} from ${from} now at ${to}`,
  contributionCount: (count: number) => `${count} commits`,
} as const;

export const CONTRIBUTORS_EMPTY_STATES = {
  noFlows: 'No contributor movement detected between tracked organizations',
  loading: 'Analyzing contributor networks...',
  error: 'Failed to load contributor data',
  rateLimited: 'GitHub API rate limit reached — contributor analysis unavailable',
} as const;

// -----------------------------------------------------------------------------
// GITHUB INTEL — TOOLTIPS
// -----------------------------------------------------------------------------

export const GITHUB_INTEL_TOOLTIPS = {
  leaderboard: 'Organizations ranked by weekly commit activity across all public repos',
  trending: 'Repositories that gained the most stars in the past 7 days',
  techStack: 'Aggregate language usage across all tracked robotics organizations',
  releases: 'Recent version releases from robotics SDKs and frameworks',
  contributors: 'Developers who have contributed to multiple robotics organizations',
  starDelta: 'Stars gained in the past 7 days',
  commitVelocity: 'Average commits per week over the past month',
} as const;

// -----------------------------------------------------------------------------
// ACCESSIBILITY (Sprint 5)
// -----------------------------------------------------------------------------

export const ARIA_LABELS_SPRINT5 = {
  githubIntelSection: 'GitHub Intelligence dashboard section',
  leaderboardPanel: 'Open source leaderboard showing organization rankings',
  leaderboardRow: (rank: number, org: string) => `Rank ${rank}: ${org}`,
  trendingPanel: 'Trending repositories panel',
  trendingRepo: (name: string, stars: number, delta: number) =>
    `${name}: ${stars} stars, +${delta} this week`,
  techStackPanel: 'Tech stack analysis panel',
  techStackSegment: (lang: string, pct: number) => `${lang}: ${pct.toFixed(1)}%`,
  releasesPanel: 'Release radar panel',
  releaseCard: (org: string, repo: string, version: string) =>
    `${org}/${repo} version ${version}`,
  contributorsPanel: 'Contributor flow panel',
  contributorFlow: (from: string, to: string) => `Talent flow from ${from} to ${to}`,
} as const;

// =============================================================================
// ROBOTICS NARRATIVE INDEX (Sprint 6)
// =============================================================================

/**
 * Robotics Narrative Index (RNI) — single % score tracking the robotics narrative
 * Formula: GitHub×0.20 + Contracts×0.25 + News×0.20 + Funding×0.20 + Technical×0.15
 */

export const NARRATIVE_PANEL = {
  title: 'ROBOTICS NARRATIVE INDEX',
  subtitle: 'Composite signal strength across data sources',
  scoreLabel: 'RNI SCORE',
  componentsLabel: 'COMPONENTS',
  signalsLabel: 'ACTIVE SIGNALS',
  trendsLabel: 'TREND (30D)',
  lastUpdatedLabel: 'Last calculated',
} as const;

/**
 * Narrative level thresholds and labels
 * STRONG: 80-100%, BUILDING: 60-79%, NEUTRAL: 40-59%, WEAKENING: 20-39%, COLD: 0-19%
 */
export const NARRATIVE_LEVELS = {
  strong: {
    label: 'STRONG',
    description: 'Robotics narrative is dominant across all signals',
    threshold: 80,
    color: '#00FF88',
  },
  building: {
    label: 'BUILDING',
    description: 'Growing momentum — multiple positive signals',
    threshold: 60,
    color: '#00FFE0',
  },
  neutral: {
    label: 'NEUTRAL',
    description: 'Mixed signals — narrative holding steady',
    threshold: 40,
    color: '#FFB800',
  },
  weakening: {
    label: 'WEAKENING',
    description: 'Declining signals — narrative losing momentum',
    threshold: 20,
    color: '#FF8800',
  },
  cold: {
    label: 'COLD',
    description: 'Minimal activity — narrative at low point',
    threshold: 0,
    color: '#FF4444',
  },
} as const;

/**
 * Get narrative level based on RNI score (0-100)
 */
export function getNarrativeLevel(score: number): keyof typeof NARRATIVE_LEVELS {
  if (score >= NARRATIVE_LEVELS.strong.threshold) return 'strong';
  if (score >= NARRATIVE_LEVELS.building.threshold) return 'building';
  if (score >= NARRATIVE_LEVELS.neutral.threshold) return 'neutral';
  if (score >= NARRATIVE_LEVELS.weakening.threshold) return 'weakening';
  return 'cold';
}

/**
 * RNI component labels with weights
 */
export const NARRATIVE_COMPONENTS = {
  github: { label: 'GitHub Activity', weight: 0.20, abbr: 'GH' },
  contracts: { label: 'Gov Contracts', weight: 0.25, abbr: 'GOV' },
  news: { label: 'News Sentiment', weight: 0.20, abbr: 'NEWS' },
  funding: { label: 'Funding Flow', weight: 0.20, abbr: 'FUND' },
  technical: { label: 'Technical Momentum', weight: 0.15, abbr: 'TECH' },
} as const;

export const NARRATIVE_METRICS = {
  scoreDisplay: (score: number) => `${Math.round(score)}%`,
  componentScore: (name: string, score: number, weight: number) =>
    `${name}: ${Math.round(score)}% (×${weight})`,
  trendDelta: (delta: number) =>
    delta >= 0 ? `▲ ${Math.abs(delta).toFixed(1)}%` : `▼ ${Math.abs(delta).toFixed(1)}%`,
  weightLabel: (weight: number) => `${(weight * 100).toFixed(0)}%`,
} as const;

export const NARRATIVE_SIGNALS = {
  positive: '↑',
  negative: '↓',
  neutral: '—',
} as const;

export const NARRATIVE_CHART = {
  title: 'RNI TREND',
  yAxisLabel: 'RNI Score (%)',
  xAxisLabel: 'Date',
  tooltipLabel: (date: string, score: number) => `${date}: ${Math.round(score)}%`,
  periodOptions: ['7D', '30D', '90D', 'YTD', 'ALL'],
} as const;

export const NARRATIVE_EMPTY_STATES = {
  noData: 'Insufficient data to calculate Narrative Index',
  loading: 'Calculating Narrative Index...',
  error: 'Failed to compute Narrative Index',
  partial: (available: number, required: number) =>
    `${available}/${required} data sources available — index may be incomplete`,
} as const;

export const NARRATIVE_TOOLTIPS = {
  score: 'Composite score combining GitHub activity, government contracts, news sentiment, funding flow, and technical momentum',
  github: 'Open source activity: commits, stars, and repo growth (20% weight)',
  contracts: 'Federal contract awards and government spending signals (25% weight)',
  news: 'Media coverage sentiment and mention velocity (20% weight)',
  funding: 'Venture funding rounds and valuation trends (20% weight)',
  technical: 'Patent activity and technical development signals (15% weight)',
  trend: '30-day moving average change in RNI score',
} as const;

// -----------------------------------------------------------------------------
// TELEGRAM DAILY BRIEFING (Sprint 6)
// -----------------------------------------------------------------------------

export const TELEGRAM_BRIEFING = {
  header: '📊 ROBOTICS NARRATIVE INDEX — DAILY BRIEFING',
  scoreSection: 'RNI SCORE',
  componentsSection: 'COMPONENT BREAKDOWN',
  signalsSection: 'KEY SIGNALS',
  footer: 'Generated by Street Robotics Intelligence',
} as const;

export const TELEGRAM_TEMPLATES = {
  dailyScore: (score: number, level: string, delta: number) =>
    `RNI: ${Math.round(score)}% [${level}]\n` +
    `Trend: ${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% vs yesterday`,
  componentLine: (name: string, score: number, signal: string) =>
    `  ${signal} ${name}: ${Math.round(score)}%`,
  signalBullet: (text: string) => `• ${text}`,
  divider: '─'.repeat(32),
} as const;

/**
 * Format complete Telegram daily briefing
 */
export function formatTelegramBriefing(
  score: number,
  level: string,
  delta: number,
  components: Array<{ name: string; score: number; trend: 'up' | 'down' | 'neutral' }>,
  signals: string[]
): string {
  const trendSymbol = (t: string) =>
    t === 'up' ? NARRATIVE_SIGNALS.positive : t === 'down' ? NARRATIVE_SIGNALS.negative : NARRATIVE_SIGNALS.neutral;

  const lines = [
    TELEGRAM_BRIEFING.header,
    TELEGRAM_TEMPLATES.divider,
    '',
    TELEGRAM_TEMPLATES.dailyScore(score, level, delta),
    '',
    TELEGRAM_BRIEFING.componentsSection + ':',
    ...components.map((c) => TELEGRAM_TEMPLATES.componentLine(c.name, c.score, trendSymbol(c.trend))),
    '',
  ];

  if (signals.length > 0) {
    lines.push(TELEGRAM_BRIEFING.signalsSection + ':');
    lines.push(...signals.slice(0, 5).map(TELEGRAM_TEMPLATES.signalBullet));
    lines.push('');
  }

  lines.push(TELEGRAM_TEMPLATES.divider);
  lines.push(TELEGRAM_BRIEFING.footer);

  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// ACCESSIBILITY (Sprint 6)
// -----------------------------------------------------------------------------

export const ARIA_LABELS_SPRINT6 = {
  narrativePanel: 'Robotics Narrative Index panel',
  narrativeScore: (score: number, level: string) =>
    `Narrative Index score: ${Math.round(score)}%, status: ${level}`,
  narrativeChart: 'Narrative Index trend chart over time',
  narrativeComponent: (name: string, score: number) =>
    `Component ${name}: ${Math.round(score)}%`,
  narrativeTrend: (delta: number) =>
    `30-day trend: ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} percent`,
} as const;
