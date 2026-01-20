/**
 * Confidence scoring utilities for the Robotics Intelligence Globe
 *
 * Provides functions to compute, categorize, and format data confidence levels.
 */

import {
  ConfidenceLevel,
  ConfidenceMeta,
  CONFIDENCE_THRESHOLDS,
} from '@/types/confidence';

/**
 * Check if a value is considered "filled" (non-null, non-undefined, non-empty)
 */
function isFilledValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

/**
 * Compute confidence score based on field completeness
 *
 * @param obj - Object to analyze for data completeness
 * @returns Confidence score from 0 to 1
 *
 * @example
 * computeConfidence({ a: 1, b: null, c: 'x' }) // ~0.67
 * computeConfidence({}) // 0
 * computeConfidence(null) // 0
 */
export function computeConfidence(obj: Record<string, unknown> | null | undefined): number {
  // Handle null/undefined input
  if (!obj || typeof obj !== 'object') {
    return 0;
  }

  const keys = Object.keys(obj);

  // Handle empty objects
  if (keys.length === 0) {
    return 0;
  }

  const filledCount = keys.filter((key) => isFilledValue(obj[key])).length;
  const confidence = filledCount / keys.length;

  // Round to 2 decimal places to avoid floating point issues
  return Math.round(confidence * 100) / 100;
}

/**
 * Get categorical confidence level from numeric score
 *
 * @param confidence - Confidence score from 0 to 1
 * @returns Categorical level: 'high', 'medium', or 'low'
 *
 * @example
 * getConfidenceLevel(0.9)  // 'high'
 * getConfidenceLevel(0.65) // 'medium'
 * getConfidenceLevel(0.3)  // 'low'
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  // Handle out-of-range values gracefully
  const clampedConfidence = Math.max(0, Math.min(1, confidence));

  if (clampedConfidence >= CONFIDENCE_THRESHOLDS.high) {
    return 'high';
  }
  if (clampedConfidence >= CONFIDENCE_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'low';
}

/**
 * Format confidence score as percentage string
 *
 * @param confidence - Confidence score from 0 to 1
 * @returns Formatted percentage string (e.g., "85%")
 *
 * @example
 * formatConfidence(0.85)  // "85%"
 * formatConfidence(0.666) // "67%"
 * formatConfidence(1.5)   // "100%" (clamped)
 */
export function formatConfidence(confidence: number): string {
  // Clamp to valid range and handle NaN
  const safeConfidence = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0;

  const percentage = Math.round(safeConfidence * 100);
  return `${percentage}%`;
}

/**
 * Build a complete ConfidenceMeta object from an object
 *
 * @param obj - Object to analyze
 * @param source - Data source identifier
 * @returns Complete ConfidenceMeta object
 */
export function buildConfidenceMeta(
  obj: Record<string, unknown> | null | undefined,
  source: string
): ConfidenceMeta {
  const keys = obj && typeof obj === 'object' ? Object.keys(obj) : [];
  const filledCount = obj
    ? keys.filter((key) => isFilledValue(obj[key])).length
    : 0;

  return {
    confidence: computeConfidence(obj),
    lastUpdated: new Date().toISOString(),
    source,
    completeness: {
      fields: keys.length,
      filled: filledCount,
    },
  };
}

/**
 * Merge multiple confidence scores with optional weights
 *
 * @param scores - Array of confidence scores
 * @param weights - Optional weights for each score (defaults to equal weighting)
 * @returns Weighted average confidence score
 */
export function mergeConfidenceScores(
  scores: number[],
  weights?: number[]
): number {
  if (scores.length === 0) {
    return 0;
  }

  const effectiveWeights = weights || scores.map(() => 1);

  if (effectiveWeights.length !== scores.length) {
    // Fallback to equal weighting if mismatch
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return 0;
  }

  const weightedSum = scores.reduce(
    (sum, score, i) => sum + score * effectiveWeights[i],
    0
  );

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
