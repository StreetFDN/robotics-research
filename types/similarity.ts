/**
 * Similarity computation types for the Robotics Intelligence Globe
 *
 * Used to find and explain relationships between companies
 * based on shared traits, funding stage, region, and technology focus.
 */

/**
 * A company similar to a source company with explanation
 */
export interface SimilarCompany {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Similarity score from 0 to 1 */
  similarity: number;
  /** Traits shared with the source company */
  sharedTraits: string[];
  /** Key differences from the source company */
  differences: string[];
}

/**
 * Complete similarity analysis result
 */
export interface SimilarityResult {
  /** ID of the source company being compared */
  sourceCompany: string;
  /** List of similar companies, sorted by similarity (descending) */
  similar: SimilarCompany[];
}

/**
 * Weights for different similarity dimensions
 */
export interface SimilarityWeights {
  /** Weight for tag/technology overlap (default: 0.40) */
  tags: number;
  /** Weight for geographic proximity (default: 0.20) */
  region: number;
  /** Weight for funding stage similarity (default: 0.25) */
  fundingStage: number;
  /** Weight for description/focus similarity (default: 0.15) */
  focus: number;
}

/**
 * Default similarity weights
 */
export const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {
  tags: 0.40,
  region: 0.20,
  fundingStage: 0.25,
  focus: 0.15,
};

/**
 * Similarity threshold classifications
 */
export type SimilarityLevel = 'very_high' | 'high' | 'moderate' | 'low';

/**
 * Thresholds for similarity level classification
 */
export const SIMILARITY_THRESHOLDS: Record<SimilarityLevel, number> = {
  very_high: 0.80,
  high: 0.60,
  moderate: 0.40,
  low: 0.0,
};

/**
 * Get similarity level from score
 */
export function getSimilarityLevel(score: number): SimilarityLevel {
  if (score >= SIMILARITY_THRESHOLDS.very_high) return 'very_high';
  if (score >= SIMILARITY_THRESHOLDS.high) return 'high';
  if (score >= SIMILARITY_THRESHOLDS.moderate) return 'moderate';
  return 'low';
}

/**
 * Format similarity score for display
 */
export function formatSimilarity(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Trait types for categorizing shared/different traits
 */
export type TraitType = 'technology' | 'region' | 'funding' | 'market' | 'other';

/**
 * A categorized trait for display
 */
export interface CategorizedTrait {
  trait: string;
  type: TraitType;
}
