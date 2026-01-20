/**
 * Robotics Narrative Index types
 *
 * The Narrative Index is a single percentage score (0-100) tracking
 * the overall robotics narrative strength, computed from 5 components:
 * - GitHub activity (20%)
 * - Government contracts (25%)
 * - News sentiment/velocity (20%)
 * - Funding rounds (20%)
 * - Technical momentum (15%)
 */

// ============================================================================
// Component Scores
// ============================================================================

/**
 * Individual component scores that make up the Narrative Index
 * Each component is normalized to 0-100 scale
 */
export interface NarrativeComponents {
  /** GitHub activity score (stars, commits, releases) - Weight: 20% */
  github: number;
  /** Government contract activity score - Weight: 25% */
  contracts: number;
  /** News sentiment and velocity score - Weight: 20% */
  news: number;
  /** Funding rounds and amounts score - Weight: 20% */
  funding: number;
  /** Technical momentum score (repos, languages, tools) - Weight: 15% */
  technical: number;
}

/**
 * Component weights for the Narrative Index calculation
 * Must sum to 1.0
 */
export const NARRATIVE_WEIGHTS: Record<keyof NarrativeComponents, number> = {
  github: 0.20,
  contracts: 0.25,
  news: 0.20,
  funding: 0.20,
  technical: 0.15,
} as const;

// ============================================================================
// Signals
// ============================================================================

/**
 * A signal that contributed to the narrative score
 */
export interface NarrativeSignal {
  /** Signal type/category */
  type: 'github' | 'contracts' | 'news' | 'funding' | 'technical';
  /** Brief description of the signal */
  description: string;
  /** Impact on score: positive, negative, or neutral */
  impact: 'positive' | 'negative' | 'neutral';
  /** Magnitude of impact (0-10) */
  magnitude: number;
  /** Source of the signal */
  source?: string;
  /** Timestamp of the signal */
  timestamp?: string;
}

// ============================================================================
// Main Score Interface
// ============================================================================

/**
 * Complete Narrative Index score with all metadata
 */
export interface NarrativeScore {
  /** Overall narrative index (0-100) */
  overall: number;
  /** Individual component scores */
  components: NarrativeComponents;
  /** Trend direction based on recent history */
  trend: 'up' | 'down' | 'stable';
  /** Confidence in the score (0-1) based on data freshness */
  confidence: number;
  /** Key signals that influenced the score */
  signals: NarrativeSignal[];
  /** ISO timestamp when score was computed */
  timestamp: string;
  /** Data staleness info per component */
  dataAge?: NarrativeDataAge;
}

/**
 * Data age tracking for each component
 */
export interface NarrativeDataAge {
  github?: string;
  contracts?: string;
  news?: string;
  funding?: string;
  technical?: string;
}

// ============================================================================
// Historical Storage
// ============================================================================

/**
 * Stored historical score (minimal for storage efficiency)
 */
export interface StoredNarrativeScore {
  /** ISO timestamp */
  timestamp: string;
  /** Overall score (0-100) */
  overall: number;
  /** Component scores */
  components: NarrativeComponents;
  /** Trend at time of recording */
  trend: 'up' | 'down' | 'stable';
  /** Confidence at time of recording */
  confidence: number;
}

/**
 * Historical data file format
 */
export interface NarrativeHistory {
  /** Array of historical scores (oldest first) */
  scores: StoredNarrativeScore[];
  /** Last updated timestamp */
  lastUpdated: string;
  /** Schema version for migrations */
  version: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Time periods for trend analysis
 */
export type NarrativePeriod = '1d' | '7d' | '30d' | '90d';

/**
 * Narrative strength category
 */
export type NarrativeStrength = 'very_strong' | 'strong' | 'moderate' | 'weak' | 'very_weak';

/**
 * Thresholds for narrative strength classification
 */
export const NARRATIVE_STRENGTH_THRESHOLDS: Record<NarrativeStrength, number> = {
  very_strong: 80,
  strong: 65,
  moderate: 50,
  weak: 35,
  very_weak: 0,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the overall narrative score from components
 */
export function calculateNarrativeScore(components: NarrativeComponents): number {
  const weighted =
    components.github * NARRATIVE_WEIGHTS.github +
    components.contracts * NARRATIVE_WEIGHTS.contracts +
    components.news * NARRATIVE_WEIGHTS.news +
    components.funding * NARRATIVE_WEIGHTS.funding +
    components.technical * NARRATIVE_WEIGHTS.technical;

  return Math.round(weighted * 10) / 10;
}

/**
 * Get narrative strength category from score
 */
export function getNarrativeStrength(score: number): NarrativeStrength {
  if (score >= NARRATIVE_STRENGTH_THRESHOLDS.very_strong) return 'very_strong';
  if (score >= NARRATIVE_STRENGTH_THRESHOLDS.strong) return 'strong';
  if (score >= NARRATIVE_STRENGTH_THRESHOLDS.moderate) return 'moderate';
  if (score >= NARRATIVE_STRENGTH_THRESHOLDS.weak) return 'weak';
  return 'very_weak';
}

/**
 * Get color for narrative strength
 */
export function getNarrativeColor(strength: NarrativeStrength): string {
  switch (strength) {
    case 'very_strong': return '#00FF88';
    case 'strong': return '#00FFE0';
    case 'moderate': return '#FFB800';
    case 'weak': return '#FF8800';
    case 'very_weak': return '#FF3B3B';
  }
}

/**
 * Format narrative score for display
 */
export function formatNarrativeScore(score: number): string {
  return `${score.toFixed(1)}%`;
}

/**
 * Detect trend from historical scores
 */
export function detectNarrativeTrend(
  scores: StoredNarrativeScore[],
  lookbackDays: number = 7
): 'up' | 'down' | 'stable' {
  if (scores.length < 2) return 'stable';

  const now = new Date();
  const cutoff = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const recentScores = scores.filter(s => new Date(s.timestamp) >= cutoff);
  if (recentScores.length < 2) return 'stable';

  const oldest = recentScores[0].overall;
  const newest = recentScores[recentScores.length - 1].overall;
  const change = newest - oldest;

  if (change > 3) return 'up';
  if (change < -3) return 'down';
  return 'stable';
}

/**
 * Calculate confidence based on data freshness
 */
export function calculateConfidence(dataAge: NarrativeDataAge): number {
  const now = new Date();
  let totalFreshness = 0;
  let componentCount = 0;

  const maxAgeHours = 24; // Data older than 24h reduces confidence

  for (const [, timestamp] of Object.entries(dataAge)) {
    if (timestamp) {
      const age = now.getTime() - new Date(timestamp).getTime();
      const ageHours = age / (1000 * 60 * 60);
      const freshness = Math.max(0, 1 - ageHours / maxAgeHours);
      totalFreshness += freshness;
      componentCount++;
    }
  }

  if (componentCount === 0) return 0.5; // Default confidence
  return Math.round((totalFreshness / componentCount) * 100) / 100;
}
