/**
 * GitHub Intelligence types for the Robotics Intelligence Globe
 *
 * Comprehensive types for tracking open source activity, trending repos,
 * tech stack analysis, releases, and contributor flows in the robotics ecosystem.
 */

// ============================================================================
// Leaderboard Types
// ============================================================================

/**
 * Top repository summary for leaderboard display
 */
export interface TopRepoSummary {
  /** Repository name */
  name: string;
  /** Star count */
  stars: number;
}

/**
 * Organization entry in the GitHub leaderboard
 */
export interface OrgLeaderboardEntry {
  /** GitHub organization slug */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Commits in the last 7 days */
  commitsWeek: number;
  /** Commits in the last 30 days */
  commitsMonth: number;
  /** Total stars across all repos */
  starsTotal: number;
  /** Top repository by stars */
  topRepo: TopRepoSummary;
  /** Activity trend direction */
  trend: 'up' | 'down' | 'stable';
  /** Organization avatar URL */
  avatarUrl: string;
  /** Rank position (computed) */
  rank?: number;
}

/**
 * Leaderboard API response
 */
export interface LeaderboardResponse {
  /** List of organizations ranked by activity */
  orgs: OrgLeaderboardEntry[];
  /** When the data was last updated */
  updatedAt: string;
  /** Ranking metric used */
  rankedBy: 'commits' | 'stars' | 'velocity';
}

// ============================================================================
// Trending Repos Types
// ============================================================================

/**
 * A trending repository in the robotics space
 */
export interface TrendingRepo {
  /** Repository name */
  name: string;
  /** Full repository path (owner/repo) */
  fullName: string;
  /** Repository description */
  description: string;
  /** Current star count */
  stars: number;
  /** Stars gained in the tracking period */
  starsDelta: number;
  /** Primary programming language */
  language: string;
  /** Repository topics/tags */
  topics: string[];
  /** GitHub URL */
  url: string;
  /** Repository creation date (ISO format) */
  createdAt: string;
  /** Owner avatar URL */
  ownerAvatarUrl?: string;
}

/**
 * Trending repos API response
 */
export interface TrendingResponse {
  /** List of trending repositories */
  repos: TrendingRepo[];
  /** Time period for trending calculation */
  period: '24h' | '7d' | '30d';
  /** Topic filter applied (if any) */
  topic?: string;
}

/**
 * Available topic filters for trending repos
 */
export type TrendingTopic = 'humanoid' | 'drones' | 'manipulation' | 'ros' | 'ml' | 'all';

// ============================================================================
// Tech Stack / Language Types
// ============================================================================

/**
 * Language statistics across the robotics ecosystem
 */
export interface LanguageStats {
  /** Programming language name */
  name: string;
  /** Total bytes of code */
  bytes: number;
  /** Percentage of total codebase */
  percentage: number;
  /** GitHub language color (hex) */
  color: string;
  /** Organizations using this language */
  orgsUsing: string[];
  /** Number of repos using this language */
  repoCount: number;
}

/**
 * Tech stack API response
 */
export interface TechStackResponse {
  /** Language breakdown */
  languages: LanguageStats[];
  /** Total bytes analyzed */
  totalBytes: number;
  /** Number of repos analyzed */
  repoCount: number;
  /** Number of orgs analyzed */
  orgCount: number;
}

// ============================================================================
// Release Types
// ============================================================================

/**
 * Release type classification
 */
export type ReleaseType = 'major' | 'minor' | 'patch' | 'prerelease' | 'unknown';

/**
 * A release from a tracked repository
 */
export interface ReleaseInfo {
  /** Organization name */
  org: string;
  /** Repository name */
  repo: string;
  /** Version string (e.g., "v2.1.0") */
  version: string;
  /** Release name/title */
  name: string;
  /** Release date (ISO format) */
  date: string;
  /** Release notes/changelog (truncated) */
  notes: string;
  /** GitHub release URL */
  url: string;
  /** Whether this is a major release */
  isMajor: boolean;
  /** Parsed release type */
  releaseType: ReleaseType;
  /** Tag name */
  tagName: string;
  /** Is this a pre-release */
  isPrerelease: boolean;
}

/**
 * Release radar API response
 */
export interface ReleasesResponse {
  /** Recent releases */
  releases: ReleaseInfo[];
  /** Time window for releases */
  since: string;
  /** Number of repos tracked */
  trackedRepos: number;
}

// ============================================================================
// Contributor Flow Types
// ============================================================================

/**
 * Contribution to a specific organization/repo
 */
export interface OrgContribution {
  /** Organization name */
  org: string;
  /** Repository name (optional, for specific repo contributions) */
  repo?: string;
  /** Number of commits */
  commits: number;
  /** Time period of contributions */
  period?: string;
}

/**
 * A contributor with their organization affiliations
 */
export interface ContributorFlow {
  /** GitHub username */
  username: string;
  /** Avatar URL */
  avatarUrl: string;
  /** Profile URL */
  profileUrl: string;
  /** Contributions across organizations */
  contributions: OrgContribution[];
  /** Total commits across all tracked orgs */
  totalCommits: number;
}

/**
 * Flow between two organizations
 */
export interface OrgFlow {
  /** Source organization */
  from: string;
  /** Destination organization */
  to: string;
  /** Number of shared contributors */
  count: number;
  /** List of shared contributor usernames */
  contributors: string[];
}

/**
 * Contributor flow API response
 */
export interface ContributorFlowResponse {
  /** Individual contributor flows */
  contributors: ContributorFlow[];
  /** Aggregated flows between orgs */
  flows: OrgFlow[];
  /** Organizations analyzed */
  orgs: string[];
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * Tracked robotics organizations for GitHub intelligence
 */
export const TRACKED_ROBOTICS_ORGS = [
  'boston-dynamics',
  'figure-ai',
  'agilityrobotics',
  'anduril',
  'Skydio',
  'NVIDIA',
  'openai',
  'google-deepmind',
  'unitreerobotics',
  'ros2',
  'facebookresearch',
  'teslamotors',
] as const;

export type TrackedOrg = typeof TRACKED_ROBOTICS_ORGS[number];

/**
 * Time periods for data aggregation
 */
export type TimePeriod = '24h' | '7d' | '30d' | '90d' | '1y';

/**
 * Sort options for leaderboard
 */
export type LeaderboardSortBy = 'commits_week' | 'commits_month' | 'stars' | 'velocity';

/**
 * Cache status for API responses
 */
export interface CacheStatus {
  /** Whether data is from cache */
  cached: boolean;
  /** Cache age in seconds */
  age: number;
  /** Cache TTL in seconds */
  ttl: number;
}
