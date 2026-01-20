/**
 * Confidence and data quality types for the Robotics Intelligence Globe
 *
 * Used to communicate data reliability to users and enable
 * informed decision-making about data trustworthiness.
 */

/**
 * Metadata about data confidence and provenance
 */
export interface ConfidenceMeta {
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** ISO timestamp of last data update */
  lastUpdated: string;
  /** Data source identifier (e.g., "CoinGecko API", "Manual Entry") */
  source: string;
  /** Field completeness metrics */
  completeness: {
    /** Total number of expected fields */
    fields: number;
    /** Number of fields with non-null values */
    filled: number;
  };
}

/**
 * Categorical confidence level for UI display
 * - high: >0.8 confidence — data is complete and recent
 * - medium: 0.5-0.8 confidence — some data may be incomplete
 * - low: <0.5 confidence — significant data gaps
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Thresholds for confidence level categorization
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
} as const;

/**
 * Color codes for confidence levels (Palantir/CIA aesthetic)
 */
export const CONFIDENCE_COLORS = {
  high: '#00FF88',
  medium: '#FFB800',
  low: '#FF3B3B',
} as const;
