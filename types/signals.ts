/**
 * Early warning signals types for the Robotics Intelligence Globe
 *
 * Used to track news velocity, sentiment, and media coverage
 * for companies in the robotics ecosystem.
 */

/**
 * A news article with sentiment analysis
 */
export interface NewsArticle {
  /** Article headline */
  title: string;
  /** Publication name (e.g., "TechCrunch", "Reuters") */
  source: string;
  /** ISO timestamp of publication */
  publishedAt: string;
  /** Sentiment score from -1 (bearish) to 1 (bullish) */
  sentiment: number;
  /** Full URL to the article */
  url: string;
}

/**
 * Sentiment classification labels
 */
export type SentimentLabel = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/**
 * Trend direction for news velocity
 */
export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Complete signals data for a company
 */
export interface SignalsData {
  /** Company identifier */
  companyId: string;
  /** Company display name */
  companyName: string;
  /** Daily mention counts for the past 7 days (index 0 = 7 days ago) */
  newsVelocity: number[];
  /** Aggregate sentiment score from -1 to 1 */
  sentiment: number;
  /** Categorical sentiment label */
  sentimentLabel: SentimentLabel;
  /** Recent headlines with sentiment */
  headlines: NewsArticle[];
}

/**
 * Thresholds for sentiment classification
 */
export const SENTIMENT_THRESHOLDS = {
  BULLISH: 0.3,
  BEARISH: -0.3,
} as const;

/**
 * News velocity thresholds for activity classification
 */
export const VELOCITY_THRESHOLDS = {
  /** High activity: >10 mentions/day average */
  HIGH: 10,
  /** Medium activity: 3-10 mentions/day average */
  MEDIUM: 3,
  /** Low activity: <3 mentions/day average */
  LOW: 0,
} as const;

/**
 * Activity level classification
 */
export type ActivityLevel = 'high' | 'medium' | 'low' | 'none';

/**
 * Get activity level from news velocity data
 */
export function getActivityLevel(velocity: number[]): ActivityLevel {
  if (!velocity || velocity.length === 0) return 'none';

  const avg = velocity.reduce((sum, v) => sum + v, 0) / velocity.length;

  if (avg >= VELOCITY_THRESHOLDS.HIGH) return 'high';
  if (avg >= VELOCITY_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Colors for sentiment visualization
 */
export const SENTIMENT_COLORS = {
  BULLISH: '#00FF88',
  BEARISH: '#FF3B3B',
  NEUTRAL: '#666666',
} as const;

/**
 * Colors for trend visualization
 */
export const TREND_COLORS = {
  up: '#00FF88',
  down: '#FF3B3B',
  flat: '#00FFE0',
} as const;
