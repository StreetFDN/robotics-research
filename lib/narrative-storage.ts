/**
 * Narrative Index Storage
 *
 * Handles persistent storage of narrative scores to data/narrative-history.json
 * Provides functions for appending new scores and retrieving historical data.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  NarrativeScore,
  StoredNarrativeScore,
  NarrativeHistory,
  NarrativePeriod,
} from '@/types/narrative';
import { detectNarrativeTrend } from '@/types/narrative';

// ============================================================================
// Configuration
// ============================================================================

/** Path to the narrative history JSON file */
const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'narrative-history.json');

/** Current schema version */
const SCHEMA_VERSION = 1;

/** Maximum number of scores to retain (approx 1 year of daily scores) */
const MAX_HISTORY_SIZE = 400;

// ============================================================================
// File Operations
// ============================================================================

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * Read the history file, creating it if it doesn't exist
 */
async function readHistory(): Promise<NarrativeHistory> {
  try {
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    const history = JSON.parse(content) as NarrativeHistory;

    // Migrate if needed
    if (history.version !== SCHEMA_VERSION) {
      return migrateHistory(history);
    }

    return history;
  } catch (error) {
    // File doesn't exist or is invalid, return empty history
    return {
      scores: [],
      lastUpdated: new Date().toISOString(),
      version: SCHEMA_VERSION,
    };
  }
}

/**
 * Write history to file
 */
async function writeHistory(history: NarrativeHistory): Promise<void> {
  await ensureDataDir();
  const content = JSON.stringify(history, null, 2);
  await fs.writeFile(HISTORY_FILE, content, 'utf-8');
}

/**
 * Migrate history from older schema versions
 */
function migrateHistory(history: NarrativeHistory): NarrativeHistory {
  // Currently only version 1, no migrations needed
  return {
    ...history,
    version: SCHEMA_VERSION,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Append a new score to the history
 *
 * @param score - The narrative score to store
 * @returns The stored score record
 *
 * @example
 * const stored = await appendScore({
 *   overall: 72.5,
 *   components: { github: 80, contracts: 70, news: 65, funding: 75, technical: 70 },
 *   trend: 'up',
 *   confidence: 0.95,
 *   signals: [],
 *   timestamp: new Date().toISOString()
 * });
 */
export async function appendScore(score: NarrativeScore): Promise<StoredNarrativeScore> {
  const history = await readHistory();

  // Create stored record (minimal fields for efficiency)
  const stored: StoredNarrativeScore = {
    timestamp: score.timestamp,
    overall: score.overall,
    components: score.components,
    trend: score.trend,
    confidence: score.confidence,
  };

  // Add to history
  history.scores.push(stored);

  // Trim if exceeds max size (remove oldest)
  if (history.scores.length > MAX_HISTORY_SIZE) {
    history.scores = history.scores.slice(-MAX_HISTORY_SIZE);
  }

  // Update metadata
  history.lastUpdated = new Date().toISOString();

  // Write back
  await writeHistory(history);

  return stored;
}

/**
 * Get all historical scores
 *
 * @param options - Query options
 * @returns Array of stored scores (oldest first)
 *
 * @example
 * const scores = await getScores({ period: '30d' });
 */
export async function getScores(options?: {
  period?: NarrativePeriod;
  limit?: number;
}): Promise<StoredNarrativeScore[]> {
  const history = await readHistory();
  let scores = history.scores;

  // Filter by period if specified
  if (options?.period) {
    const periodDays = parsePeriod(options.period);
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    scores = scores.filter(s => new Date(s.timestamp) >= cutoff);
  }

  // Limit results if specified
  if (options?.limit && options.limit > 0) {
    scores = scores.slice(-options.limit);
  }

  return scores;
}

/**
 * Get the most recent score
 *
 * @returns The latest score or null if no history
 */
export async function getLatestScore(): Promise<StoredNarrativeScore | null> {
  const history = await readHistory();
  if (history.scores.length === 0) return null;
  return history.scores[history.scores.length - 1];
}

/**
 * Get score statistics for a period
 *
 * @param period - Time period to analyze
 * @returns Statistics object
 */
export async function getScoreStats(period: NarrativePeriod = '30d'): Promise<{
  current: number | null;
  min: number;
  max: number;
  avg: number;
  trend: 'up' | 'down' | 'stable';
  count: number;
}> {
  const scores = await getScores({ period });

  if (scores.length === 0) {
    return {
      current: null,
      min: 0,
      max: 0,
      avg: 0,
      trend: 'stable',
      count: 0,
    };
  }

  const values = scores.map(s => s.overall);
  const current = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const trend = detectNarrativeTrend(scores);

  return {
    current,
    min,
    max,
    avg,
    trend,
    count: scores.length,
  };
}

/**
 * Clear all history (use with caution)
 */
export async function clearHistory(): Promise<void> {
  const emptyHistory: NarrativeHistory = {
    scores: [],
    lastUpdated: new Date().toISOString(),
    version: SCHEMA_VERSION,
  };
  await writeHistory(emptyHistory);
}

/**
 * Check if we have any historical data
 */
export async function hasHistory(): Promise<boolean> {
  const history = await readHistory();
  return history.scores.length > 0;
}

/**
 * Get the date range of available data
 */
export async function getDataRange(): Promise<{ start: string | null; end: string | null }> {
  const history = await readHistory();
  if (history.scores.length === 0) {
    return { start: null, end: null };
  }
  return {
    start: history.scores[0].timestamp,
    end: history.scores[history.scores.length - 1].timestamp,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse period string to days
 */
function parsePeriod(period: NarrativePeriod): number {
  switch (period) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 30;
  }
}

/**
 * Format scores for chart consumption
 *
 * @param scores - Historical scores
 * @returns Array of {date, value} objects for charting
 */
export function formatForChart(
  scores: StoredNarrativeScore[]
): Array<{ date: string; value: number; components: Record<string, number> }> {
  return scores.map(s => ({
    date: s.timestamp.split('T')[0], // YYYY-MM-DD
    value: s.overall,
    components: {
      github: s.components.github,
      contracts: s.components.contracts,
      news: s.components.news,
      funding: s.components.funding,
      technical: s.components.technical,
    },
  }));
}

/**
 * Calculate day-over-day change
 */
export function calculateChange(scores: StoredNarrativeScore[]): number | null {
  if (scores.length < 2) return null;
  const latest = scores[scores.length - 1].overall;
  const previous = scores[scores.length - 2].overall;
  return Math.round((latest - previous) * 10) / 10;
}
