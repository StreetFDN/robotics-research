/**
 * GitHub Intelligence utilities for the Robotics Intelligence Globe
 *
 * Provides functions for star velocity calculation, semver parsing,
 * language colors, commit formatting, and contributor grouping.
 */

import type {
  TrendingRepo,
  ReleaseType,
  ContributorFlow,
  OrgContribution,
} from '@/types/github-intel';

// ============================================================================
// Star Velocity
// ============================================================================

/**
 * Calculate star velocity (stars gained per day) for a repository
 *
 * @param stars - Current star count
 * @param createdAt - Repository creation date (ISO string)
 * @param recentStars - Stars gained in the period (optional)
 * @param days - Number of days to calculate velocity over (default: 7)
 * @returns Stars per day (velocity)
 *
 * @example
 * calculateStarVelocity(1000, '2025-01-01', 70, 7) // 10 stars/day
 */
export function calculateStarVelocity(
  stars: number,
  createdAt: string,
  recentStars?: number,
  days: number = 7
): number {
  // If we have recent stars data, use it directly
  if (recentStars !== undefined && days > 0) {
    return Math.round((recentStars / days) * 10) / 10;
  }

  // Fallback: estimate from total stars and repo age
  const created = new Date(createdAt);
  const now = new Date();
  const ageMs = now.getTime() - created.getTime();
  const ageDays = Math.max(1, ageMs / (1000 * 60 * 60 * 24));

  return Math.round((stars / ageDays) * 10) / 10;
}

/**
 * Calculate star delta (change) between two points
 *
 * @param currentStars - Current star count
 * @param previousStars - Previous star count
 * @returns Change in stars (can be negative)
 */
export function calculateStarDelta(currentStars: number, previousStars: number): number {
  return currentStars - previousStars;
}

/**
 * Get star velocity category
 *
 * @param velocity - Stars per day
 * @returns Category label
 */
export function getStarVelocityCategory(velocity: number): 'viral' | 'hot' | 'growing' | 'steady' | 'slow' {
  if (velocity >= 100) return 'viral';
  if (velocity >= 20) return 'hot';
  if (velocity >= 5) return 'growing';
  if (velocity >= 1) return 'steady';
  return 'slow';
}

// ============================================================================
// Semver / Release Parsing
// ============================================================================

/**
 * Semver regex pattern
 * Matches: v1.0.0, 1.0.0, v1.0.0-alpha, 1.0.0-beta.1, etc.
 */
const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;

/**
 * Parse a version string into components
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

/**
 * Parse a semver version string
 *
 * @param version - Version string (e.g., "v2.1.0", "1.0.0-beta")
 * @returns Parsed version object or null if invalid
 */
export function parseVersion(version: string): ParsedVersion | null {
  const match = version.match(SEMVER_REGEX);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
    raw: version,
  };
}

/**
 * Detect the type of release from a version string
 *
 * @param version - Version string
 * @returns Release type classification
 *
 * @example
 * detectMajorRelease('v2.0.0')     // 'major'
 * detectMajorRelease('v1.5.0')     // 'minor'
 * detectMajorRelease('v1.5.3')     // 'patch'
 * detectMajorRelease('v1.0.0-rc1') // 'prerelease'
 */
export function detectMajorRelease(version: string): ReleaseType {
  const parsed = parseVersion(version);

  if (!parsed) {
    // Try to detect from common patterns
    if (version.includes('alpha') || version.includes('beta') || version.includes('rc')) {
      return 'prerelease';
    }
    return 'unknown';
  }

  // Pre-release takes precedence
  if (parsed.prerelease) {
    return 'prerelease';
  }

  // Major release: X.0.0
  if (parsed.minor === 0 && parsed.patch === 0) {
    return 'major';
  }

  // Minor release: X.Y.0
  if (parsed.patch === 0) {
    return 'minor';
  }

  // Patch release
  return 'patch';
}

/**
 * Check if a release is a major version bump
 *
 * @param version - Version string
 * @returns True if major release
 */
export function isMajorRelease(version: string): boolean {
  return detectMajorRelease(version) === 'major';
}

/**
 * Format version for display
 *
 * @param version - Version string
 * @returns Formatted version (ensures 'v' prefix)
 */
export function formatVersion(version: string): string {
  if (version.startsWith('v')) return version;
  return `v${version}`;
}

// ============================================================================
// Language Colors
// ============================================================================

/**
 * GitHub language colors
 * Source: https://github.com/ozh/github-colors
 */
export const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
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
  'Ruby': '#701516',
  'Scala': '#c22d40',
  'CUDA': '#3A4E3A',
  'Shell': '#89e051',
  'Bash': '#89e051',
  'CMake': '#DA3434',
  'Makefile': '#427819',
  'Dockerfile': '#384d54',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'Jupyter Notebook': '#DA5B0B',
  'MATLAB': '#e16737',
  'R': '#198CE7',
  'Julia': '#a270ba',
  'Lua': '#000080',
  'Haskell': '#5e5086',
  'Elixir': '#6e4a7e',
  'Clojure': '#db5855',
  'Unknown': '#8b949e',
};

/**
 * Get the GitHub color for a programming language
 *
 * @param language - Programming language name
 * @returns Hex color code
 *
 * @example
 * getLanguageColor('Python')    // '#3572A5'
 * getLanguageColor('Rust')      // '#dea584'
 * getLanguageColor('Unknown')   // '#8b949e'
 */
export function getLanguageColor(language: string): string {
  return GITHUB_LANGUAGE_COLORS[language] || GITHUB_LANGUAGE_COLORS['Unknown'];
}

/**
 * Get all language colors as an array (for charts)
 */
export function getLanguageColorPalette(languages: string[]): string[] {
  return languages.map(getLanguageColor);
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a number with K/M/B suffix
 *
 * @param count - Number to format
 * @returns Formatted string
 *
 * @example
 * formatCommitCount(500)      // '500'
 * formatCommitCount(1500)     // '1.5k'
 * formatCommitCount(1500000)  // '1.5M'
 */
export function formatCommitCount(count: number): string {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1)}B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Format star delta with sign
 *
 * @param delta - Change in stars
 * @returns Formatted string with + or - prefix
 *
 * @example
 * formatStarDelta(125)  // '+125'
 * formatStarDelta(-50)  // '-50'
 * formatStarDelta(0)    // '0'
 */
export function formatStarDelta(delta: number): string {
  if (delta > 0) return `+${formatCommitCount(delta)}`;
  if (delta < 0) return formatCommitCount(delta);
  return '0';
}

/**
 * Format percentage for display
 *
 * @param value - Decimal percentage (0-1) or percentage (0-100)
 * @param isDecimal - Whether input is decimal (0-1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, isDecimal: boolean = false): string {
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

// ============================================================================
// Contributor Grouping
// ============================================================================

/**
 * Group contributors by their primary organization
 *
 * @param contributors - Array of contributor flows
 * @returns Map of org name to contributors
 */
export function groupContributorsByOrg(
  contributors: ContributorFlow[]
): Map<string, ContributorFlow[]> {
  const groups = new Map<string, ContributorFlow[]>();

  for (const contributor of contributors) {
    // Find primary org (most commits)
    const primaryContrib = contributor.contributions.reduce(
      (max, curr) => (curr.commits > max.commits ? curr : max),
      contributor.contributions[0]
    );

    if (primaryContrib) {
      const org = primaryContrib.org;
      const existing = groups.get(org) || [];
      existing.push(contributor);
      groups.set(org, existing);
    }
  }

  return groups;
}

/**
 * Find contributors who work across multiple organizations
 *
 * @param contributors - Array of contributor flows
 * @param minOrgs - Minimum number of orgs (default: 2)
 * @returns Contributors with cross-org activity
 */
export function findCrossOrgContributors(
  contributors: ContributorFlow[],
  minOrgs: number = 2
): ContributorFlow[] {
  return contributors.filter(c => c.contributions.length >= minOrgs);
}

/**
 * Calculate organization overlap from contributor data
 *
 * @param contributors - Array of contributor flows
 * @returns Map of "org1->org2" to count of shared contributors
 */
export function calculateOrgOverlap(
  contributors: ContributorFlow[]
): Map<string, number> {
  const overlap = new Map<string, number>();

  for (const contributor of contributors) {
    const orgs = contributor.contributions.map(c => c.org);

    // For each pair of orgs
    for (let i = 0; i < orgs.length; i++) {
      for (let j = i + 1; j < orgs.length; j++) {
        // Sort alphabetically for consistent keys
        const [org1, org2] = [orgs[i], orgs[j]].sort();
        const key = `${org1}->${org2}`;
        overlap.set(key, (overlap.get(key) || 0) + 1);
      }
    }
  }

  return overlap;
}

// ============================================================================
// Trend Detection
// ============================================================================

/**
 * Determine trend direction from data points
 *
 * @param values - Array of values (oldest first)
 * @returns Trend direction
 */
export function detectTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';

  const recent = values.slice(-3);
  const older = values.slice(0, 3);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  if (changePercent > 10) return 'up';
  if (changePercent < -10) return 'down';
  return 'stable';
}

/**
 * Get trend icon for display
 */
export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'stable': return '→';
  }
}

/**
 * Get trend color for display
 */
export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '#00FF88';
    case 'down': return '#FF3B3B';
    case 'stable': return '#8b949e';
  }
}
