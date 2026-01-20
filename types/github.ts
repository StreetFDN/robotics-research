/**
 * GitHub technical momentum types for the Robotics Intelligence Globe
 *
 * Used to track open source activity, developer engagement,
 * and technical health of robotics companies via GitHub API.
 */

/**
 * Statistics for a single GitHub repository
 */
export interface RepoStats {
  /** Repository name (e.g., "spot-sdk") */
  name: string;
  /** Full repository path (e.g., "boston-dynamics/spot-sdk") */
  fullName: string;
  /** Repository description */
  description: string;
  /** GitHub URL */
  url: string;
  /** Number of stars */
  stars: number;
  /** Number of forks */
  forks: number;
  /** Number of watchers (subscribers) */
  watchers: number;
  /** Number of open issues */
  openIssues: number;
  /** Primary programming language */
  language: string;
  /** Repository creation date (ISO format) */
  createdAt: string;
  /** Last update date (ISO format) */
  updatedAt: string;
  /** Last push date (ISO format) */
  pushedAt: string;
}

/**
 * Weekly commit activity for a repository
 */
export interface CommitActivity {
  /** Unix timestamp for the start of the week */
  week: number;
  /** Total commits that week */
  total: number;
  /** Commits per day (Sunday=0 through Saturday=6) */
  days: number[];
}

/**
 * Contributor statistics for a repository
 */
export interface ContributorStats {
  /** GitHub username */
  author: string;
  /** Avatar URL */
  avatarUrl: string;
  /** Total commits by this contributor */
  total: number;
  /** Weekly breakdown: w=week timestamp, a=additions, d=deletions, c=commits */
  weeks: Array<{
    /** Week timestamp */
    w: number;
    /** Lines added */
    a: number;
    /** Lines deleted */
    d: number;
    /** Commits */
    c: number;
  }>;
}

/**
 * Language distribution entry
 */
export interface LanguageBreakdown {
  /** Programming language name */
  language: string;
  /** Number of repositories using this language */
  count: number;
}

/**
 * Complete technical momentum analysis for a company
 */
export interface TechnicalMomentum {
  /** GitHub organization name */
  organization: string;
  /** Total stars across all repositories */
  totalStars: number;
  /** Total forks across all repositories */
  totalForks: number;
  /** Number of public repositories */
  repoCount: number;
  /** Top repositories by stars */
  topRepos: RepoStats[];
  /** Commits in the last week */
  weeklyCommits: number;
  /** Commits in the last month (4 weeks) */
  monthlyCommits: number;
  /** Estimated stars gained per month */
  starVelocity: number;
  /** Commits per week average */
  commitVelocity: number;
  /** Overall activity score from 0 to 100 */
  activityScore: number;
  /** Most recent push date across all repos (ISO format) */
  lastActivity: string;
  /** Top programming languages used */
  topLanguages: LanguageBreakdown[];
}

/**
 * Mapping from company name to GitHub organization
 */
export interface CompanyGitHubMapping {
  /** GitHub organization name */
  org: string;
  /** Specific repos to track (optional) */
  repos?: string[];
}

/**
 * Activity level classification based on activity score
 */
export type GitHubActivityLevel = 'very_active' | 'active' | 'moderate' | 'low' | 'dormant';

/**
 * Thresholds for activity level classification
 */
export const GITHUB_ACTIVITY_THRESHOLDS: Record<GitHubActivityLevel, number> = {
  very_active: 80,
  active: 60,
  moderate: 40,
  low: 20,
  dormant: 0,
};

/**
 * Get activity level from activity score
 */
export function getGitHubActivityLevel(score: number): GitHubActivityLevel {
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.very_active) return 'very_active';
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.active) return 'active';
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.moderate) return 'moderate';
  if (score >= GITHUB_ACTIVITY_THRESHOLDS.low) return 'low';
  return 'dormant';
}

/**
 * Format star count for display
 */
export function formatStarCount(stars: number): string {
  if (stars >= 1_000_000) {
    return `${(stars / 1_000_000).toFixed(1)}M`;
  }
  if (stars >= 1_000) {
    return `${(stars / 1_000).toFixed(1)}k`;
  }
  return stars.toString();
}

/**
 * Calculate days since last activity
 */
export function getDaysSinceActivity(lastActivity: string): number {
  if (!lastActivity) return -1;

  const lastDate = new Date(lastActivity);
  if (isNaN(lastDate.getTime())) return -1;

  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Colors for activity level visualization
 */
export const GITHUB_ACTIVITY_COLORS: Record<GitHubActivityLevel, string> = {
  very_active: '#00FF88',
  active: '#00FFE0',
  moderate: '#FFB800',
  low: '#FF8800',
  dormant: '#666666',
};

/**
 * Known robotics companies with GitHub presence
 */
export const KNOWN_ROBOTICS_GITHUB_ORGS = [
  'boston-dynamics',
  'ros2',
  'NVIDIA',
  'google-deepmind',
  'facebookresearch',
  'unitreerobotics',
  'Skydio',
  'openai',
] as const;

export type KnownRoboticsOrg = typeof KNOWN_ROBOTICS_GITHUB_ORGS[number];
