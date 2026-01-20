/**
 * Power scoring and explanation types for the Robotics Intelligence Globe
 *
 * Power represents the influence, market position, and strategic importance
 * of companies and regions in the robotics ecosystem.
 */

/**
 * A single factor contributing to an entity's power score
 */
export interface PowerFactor {
  /** Factor name (e.g., "FUNDING STRENGTH", "TECHNOLOGY MOAT") */
  name: string;
  /** Score from 0 to 100 */
  score: number;
  /** Human-readable explanation of the score */
  explanation: string;
  /** Optional weight for weighted scoring (defaults to 1) */
  weight?: number;
}

/**
 * Complete power analysis for a company or region
 */
export interface PowerExplanation {
  /** Unique identifier of the entity */
  entityId: string;
  /** Display name of the entity */
  entityName: string;
  /** Overall power score from 0 to 100 */
  overallPower: number;
  /** Breakdown of individual power factors */
  factors: PowerFactor[];
  /** Key strengths and advantages */
  topContributors: string[];
  /** Potential weaknesses and risks */
  vulnerabilities: string[];
}

/**
 * Standardized power factor names
 */
export const POWER_FACTOR_NAMES = {
  FUNDING: 'FUNDING STRENGTH',
  TECHNOLOGY: 'TECHNOLOGY MOAT',
  TALENT: 'TALENT DENSITY',
  MARKET: 'MARKET POSITION',
  STRATEGIC: 'STRATEGIC BACKING',
} as const;

export type PowerFactorName = typeof POWER_FACTOR_NAMES[keyof typeof POWER_FACTOR_NAMES];

/**
 * Default weights for power factors
 */
export const POWER_FACTOR_WEIGHTS: Record<PowerFactorName, number> = {
  [POWER_FACTOR_NAMES.FUNDING]: 0.25,
  [POWER_FACTOR_NAMES.TECHNOLOGY]: 0.30,
  [POWER_FACTOR_NAMES.TALENT]: 0.15,
  [POWER_FACTOR_NAMES.MARKET]: 0.20,
  [POWER_FACTOR_NAMES.STRATEGIC]: 0.10,
};

/**
 * Power tier classification
 */
export type PowerTier = 'dominant' | 'major' | 'emerging' | 'nascent';

/**
 * Thresholds for power tier classification
 */
export const POWER_TIER_THRESHOLDS: Record<PowerTier, number> = {
  dominant: 85,
  major: 65,
  emerging: 40,
  nascent: 0,
};

/**
 * Get power tier from overall power score
 */
export function getPowerTier(score: number): PowerTier {
  if (score >= POWER_TIER_THRESHOLDS.dominant) return 'dominant';
  if (score >= POWER_TIER_THRESHOLDS.major) return 'major';
  if (score >= POWER_TIER_THRESHOLDS.emerging) return 'emerging';
  return 'nascent';
}
