/**
 * Signal processing utilities for the Robotics Intelligence Globe
 *
 * Provides functions for sentiment analysis, time formatting,
 * trend detection, and news velocity normalization.
 */

import {
  SentimentLabel,
  TrendDirection,
  SENTIMENT_THRESHOLDS,
} from '@/types/signals';

/**
 * Get sentiment label from numeric score
 *
 * @param sentiment - Sentiment score from -1 to 1
 * @returns Categorical label: BULLISH, BEARISH, or NEUTRAL
 *
 * @example
 * getSentimentLabel(0.5)   // 'BULLISH'
 * getSentimentLabel(-0.5)  // 'BEARISH'
 * getSentimentLabel(0.1)   // 'NEUTRAL'
 */
export function getSentimentLabel(sentiment: number): SentimentLabel {
  // Handle NaN/undefined
  if (!Number.isFinite(sentiment)) {
    return 'NEUTRAL';
  }

  // Clamp to valid range
  const clamped = Math.max(-1, Math.min(1, sentiment));

  if (clamped >= SENTIMENT_THRESHOLDS.BULLISH) {
    return 'BULLISH';
  }
  if (clamped <= SENTIMENT_THRESHOLDS.BEARISH) {
    return 'BEARISH';
  }
  return 'NEUTRAL';
}

/**
 * Time interval definitions in milliseconds
 */
const TIME_INTERVALS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Format a date as relative time ago
 *
 * @param date - ISO timestamp string or Date object
 * @returns Human-readable relative time (e.g., "2h ago", "3d ago")
 *
 * @example
 * formatTimeAgo('2026-01-18T10:00:00Z') // "2h ago" (if current time is 12:00)
 * formatTimeAgo('2026-01-15T10:00:00Z') // "3d ago"
 */
export function formatTimeAgo(date: string | Date): string {
  // Handle invalid input
  if (!date) {
    return 'unknown';
  }

  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date.getTime();

  // Handle invalid date
  if (isNaN(timestamp)) {
    return 'unknown';
  }

  const now = Date.now();
  const diff = now - timestamp;

  // Future dates
  if (diff < 0) {
    return 'just now';
  }

  // Less than a minute
  if (diff < TIME_INTERVALS.minute) {
    return 'just now';
  }

  // Less than an hour
  if (diff < TIME_INTERVALS.hour) {
    const minutes = Math.floor(diff / TIME_INTERVALS.minute);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < TIME_INTERVALS.day) {
    const hours = Math.floor(diff / TIME_INTERVALS.hour);
    return `${hours}h ago`;
  }

  // Less than a week
  if (diff < TIME_INTERVALS.week) {
    const days = Math.floor(diff / TIME_INTERVALS.day);
    return `${days}d ago`;
  }

  // Less than a month
  if (diff < TIME_INTERVALS.month) {
    const weeks = Math.floor(diff / TIME_INTERVALS.week);
    return `${weeks}w ago`;
  }

  // Less than a year
  if (diff < TIME_INTERVALS.year) {
    const months = Math.floor(diff / TIME_INTERVALS.month);
    return `${months}mo ago`;
  }

  // More than a year
  const years = Math.floor(diff / TIME_INTERVALS.year);
  return `${years}y ago`;
}

/**
 * Compute trend direction from time series data
 *
 * Uses simple linear regression slope to determine trend
 *
 * @param data - Array of numeric values (index 0 = oldest)
 * @returns Trend direction: 'up', 'down', or 'flat'
 *
 * @example
 * computeTrend([1, 2, 3, 4, 5])  // 'up'
 * computeTrend([5, 4, 3, 2, 1])  // 'down'
 * computeTrend([3, 3, 3, 3, 3])  // 'flat'
 */
export function computeTrend(data: number[]): TrendDirection {
  // Handle edge cases
  if (!data || data.length < 2) {
    return 'flat';
  }

  // Filter out NaN values
  const validData = data.filter(v => Number.isFinite(v));
  if (validData.length < 2) {
    return 'flat';
  }

  const n = validData.length;

  // Calculate means
  const meanX = (n - 1) / 2;
  const meanY = validData.reduce((sum, v) => sum + v, 0) / n;

  // Calculate slope using least squares
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - meanX;
    const yDiff = validData[i] - meanY;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) {
    return 'flat';
  }

  const slope = numerator / denominator;

  // Determine trend with threshold (normalized by mean to handle scale)
  const threshold = Math.max(0.1, Math.abs(meanY) * 0.05);

  if (slope > threshold) {
    return 'up';
  }
  if (slope < -threshold) {
    return 'down';
  }
  return 'flat';
}

/**
 * Normalize news velocity counts to 0-100 scale
 *
 * Uses min-max normalization with optional baseline
 *
 * @param counts - Array of raw mention counts
 * @param baseline - Optional minimum value to use as 0 (default: 0)
 * @returns Normalized values from 0 to 100
 *
 * @example
 * normalizeNewsVelocity([0, 5, 10, 15, 20])  // [0, 25, 50, 75, 100]
 * normalizeNewsVelocity([10, 10, 10])        // [50, 50, 50] (all same = 50)
 */
export function normalizeNewsVelocity(counts: number[], baseline: number = 0): number[] {
  // Handle edge cases
  if (!counts || counts.length === 0) {
    return [];
  }

  // Filter and get valid numbers
  const validCounts = counts.map(c => (Number.isFinite(c) ? Math.max(baseline, c) : baseline));

  const min = Math.min(...validCounts);
  const max = Math.max(...validCounts);

  // If all values are the same, return 50s
  if (max === min) {
    return validCounts.map(() => 50);
  }

  // Normalize to 0-100
  const range = max - min;
  return validCounts.map(v => Math.round(((v - min) / range) * 100));
}

/**
 * Calculate average sentiment from multiple articles
 *
 * @param sentiments - Array of sentiment scores
 * @returns Average sentiment score
 */
export function averageSentiment(sentiments: number[]): number {
  if (!sentiments || sentiments.length === 0) {
    return 0;
  }

  const valid = sentiments.filter(s => Number.isFinite(s));
  if (valid.length === 0) {
    return 0;
  }

  const sum = valid.reduce((acc, s) => acc + s, 0);
  const avg = sum / valid.length;

  // Round to 2 decimal places and clamp
  return Math.round(Math.max(-1, Math.min(1, avg)) * 100) / 100;
}

/**
 * Determine if news velocity indicates an alert condition
 *
 * @param velocity - Array of daily mention counts
 * @param threshold - Multiplier for alert (default: 3x average)
 * @returns Whether current activity is anomalously high
 */
export function isVelocityAlert(velocity: number[], threshold: number = 3): boolean {
  if (!velocity || velocity.length < 2) {
    return false;
  }

  // Get the most recent value
  const current = velocity[velocity.length - 1];

  // Get the average of previous values
  const previous = velocity.slice(0, -1);
  const avgPrevious = previous.reduce((sum, v) => sum + v, 0) / previous.length;

  // Alert if current is significantly higher than average
  return avgPrevious > 0 && current > avgPrevious * threshold;
}

/**
 * Format sentiment as a percentage string
 *
 * @param sentiment - Sentiment score from -1 to 1
 * @returns Formatted string like "+65%" or "-32%"
 */
export function formatSentimentPercent(sentiment: number): string {
  if (!Number.isFinite(sentiment)) {
    return '0%';
  }

  const clamped = Math.max(-1, Math.min(1, sentiment));
  const percent = Math.round(clamped * 100);

  if (percent > 0) {
    return `+${percent}%`;
  }
  return `${percent}%`;
}
