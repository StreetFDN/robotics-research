/**
 * Deterministic funding parser for private companies CSV
 * Extracts valuation and date information from funding columns
 */

import type { FundingRoundData, FundingParseResult, FundingRound, ParseStatus, Confidence } from '../types/funding';

// Round name mappings
const ROUND_MAP: Record<string, FundingRound> = {
  'pre-seed': 'pre-seed',
  'preseed': 'pre-seed',
  'seed': 'seed',
  'series a': 'series-a',
  'series-a': 'series-a',
  'seriesa': 'series-a',
  'a': 'series-a',
  'a1': 'series-a',
  'a2': 'series-a',
  'series b': 'series-b',
  'series-b': 'series-b',
  'seriesb': 'series-b',
  'b': 'series-b',
  'series c': 'series-c',
  'series-c': 'series-c',
  'seriesc': 'series-c',
  'c': 'series-c',
  'series d': 'series-d',
  'series-d': 'series-d',
  'seriesd': 'series-d',
  'd': 'series-d',
  'series e': 'series-e',
  'series-e': 'series-e',
  'seriese': 'series-e',
  'e': 'series-e',
};

// Currency multipliers
const CURRENCY_MULTIPLIERS: Record<string, number> = {
  'k': 1_000,
  'm': 1_000_000,
  'b': 1_000_000_000,
  't': 1_000_000_000_000,
};

/**
 * Extract valuation from text
 * Supports: $200M, 1.2B, 750k, ranges ($50-70M), plus ($50M+), approx (~$), non-USD symbols
 */
export function extractValuation(text: string): { value?: number; currency?: string; notes: string } {
  if (!text || text.trim().toUpperCase() === 'N/A' || text.trim() === '') {
    return { notes: 'Empty or N/A' };
  }

  const normalized = text.trim();
  let notes = '';

  // Remove common prefixes/suffixes
  let cleanText = normalized
    .replace(/^target\s+/i, '')
    .replace(/\s*\(.*?\)/g, '') // Remove parenthetical notes
    .replace(/\s*\[.*?\]/g, '') // Remove bracket notes
    .trim();

  // Check for ranges (e.g., $50-70M, $50M-$70M)
  const rangeMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*[-–—]\s*\$?(\d+(?:\.\d+)?)\s*([kmbt])/i);
  if (rangeMatch) {
    const [, minStr, maxStr, suffix] = rangeMatch;
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 1;
    const avg = ((min + max) / 2) * multiplier;
    notes = `Range: $${min}${suffix}-$${max}${suffix}, using average`;
    return { value: avg, currency: 'USD', notes };
  }

  // Check for plus notation (e.g., $50M+)
  const plusMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt])\s*\+/i);
  if (plusMatch) {
    const [, numStr, suffix] = plusMatch;
    const value = parseFloat(numStr) * (CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 1);
    notes = `Minimum: $${numStr}${suffix}+`;
    return { value, currency: 'USD', notes };
  }

  // Check for approximate (~$50M)
  const approxMatch = cleanText.match(/~?\$?(\d+(?:\.\d+)?)\s*([kmbt])/i);
  if (approxMatch) {
    const [, numStr, suffix] = approxMatch;
    const value = parseFloat(numStr) * (CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 1);
    notes = cleanText.includes('~') ? 'Approximate value' : '';
    return { value, currency: 'USD', notes };
  }

  // Standard format: $200M, 1.2B, 750k
  const standardMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt])/i);
  if (standardMatch) {
    const [, numStr, suffix] = standardMatch;
    const value = parseFloat(numStr) * (CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 1);
    return { value, currency: 'USD', notes: '' };
  }

  // Try to find any number with multiplier
  const anyNumberMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*([kmbt])/i);
  if (anyNumberMatch) {
    const [, numStr, suffix] = anyNumberMatch;
    const value = parseFloat(numStr) * (CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 1);
    notes = 'Extracted from text';
    return { value, currency: 'USD', notes };
  }

  return { notes: `Could not extract valuation from: ${normalized}` };
}

/**
 * Extract date/time from text
 * Supports: Aug 2021, 08/2021, Q3 2021, 2021, Late 2022, etc.
 */
export function extractTime(text: string): { time?: string; notes: string } {
  if (!text || text.trim().toUpperCase() === 'N/A' || text.trim() === '') {
    return { notes: 'Empty or N/A' };
  }

  const normalized = text.trim();
  let notes = '';

  // Month name + year: Aug 2021, August 2021, Aug-2021
  const monthYearMatch = normalized.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/]?\s*(\d{4})/i);
  if (monthYearMatch) {
    const [, monthStr, year] = monthYearMatch;
    const monthMap: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    };
    const month = monthMap[monthStr.toLowerCase().substring(0, 3)];
    if (month) {
      return { time: `${month}/${year}`, notes: '' };
    }
  }

  // MM/YYYY or MM-YYYY: 08/2021, 8/2021, 08-2021
  const slashYearMatch = normalized.match(/(\d{1,2})\s*[-/]\s*(\d{4})/);
  if (slashYearMatch) {
    const [, month, year] = slashYearMatch;
    const monthPadded = month.padStart(2, '0');
    return { time: `${monthPadded}/${year}`, notes: '' };
  }

  // Quarter: Q3 2021, Q3/2021, Q3-2021
  const quarterMatch = normalized.match(/q([1-4])\s*[-/]?\s*(\d{4})/i);
  if (quarterMatch) {
    const [, quarter, year] = quarterMatch;
    const monthMap: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' };
    const month = monthMap[quarter];
    notes = `Quarter Q${quarter}`;
    return { time: `${month}/${year}`, notes };
  }

  // Year only: 2021
  const yearOnlyMatch = normalized.match(/\b(19|20)\d{2}\b/);
  if (yearOnlyMatch) {
    const year = yearOnlyMatch[0];
    notes = 'Year only, using mid-year';
    return { time: `06/${year}`, notes };
  }

  // Late/Early/Mid: Late 2022, Early 2023
  const qualifierMatch = normalized.match(/(late|early|mid)\s+(\d{4})/i);
  if (qualifierMatch) {
    const [, qualifier, year] = qualifierMatch;
    const monthMap: Record<string, string> = {
      'early': '03',
      'mid': '06',
      'late': '09',
    };
    const month = monthMap[qualifier.toLowerCase()] || '06';
    notes = `${qualifier} ${year}`;
    return { time: `${month}/${year}`, notes };
  }

  return { notes: `Could not extract time from: ${normalized}` };
}

/**
 * Determine round type from column name or text content
 */
export function determineRound(columnName: string, text?: string): FundingRound {
  const colLower = columnName.toLowerCase();
  
  // Check column name first
  for (const [key, round] of Object.entries(ROUND_MAP)) {
    if (colLower.includes(key)) {
      return round;
    }
  }

  // Check text content if provided
  if (text) {
    const textLower = text.toLowerCase();
    for (const [key, round] of Object.entries(ROUND_MAP)) {
      if (textLower.includes(key)) {
        return round;
      }
    }
  }

  return 'unknown';
}

/**
 * Parse a single funding column cell
 */
export function parseFundingCell(
  columnName: string,
  cellValue: string
): FundingParseResult {
  const rawCell = cellValue || '';
  const trimmed = rawCell.trim();

  // Handle empty/N/A
  if (!trimmed || trimmed.toUpperCase() === 'N/A') {
    return {
      rounds: [],
      parseStatus: 'OK',
      rawCell,
      notes: 'Empty or N/A',
    };
  }

  const round = determineRound(columnName, trimmed);
  const valuationResult = extractValuation(trimmed);
  const timeResult = extractTime(trimmed);

  // Determine parse status
  let parseStatus: ParseStatus = 'OK';
  if (!valuationResult.value && !timeResult.time) {
    parseStatus = 'FAILED';
  } else if (!valuationResult.value || !timeResult.time) {
    parseStatus = 'PARTIAL';
  }

  // Determine confidence
  let confidence: Confidence = 'high';
  if (parseStatus === 'FAILED') {
    confidence = 'low';
  } else if (parseStatus === 'PARTIAL') {
    confidence = 'med';
  } else if (valuationResult.notes || timeResult.notes) {
    confidence = 'med';
  }

  const roundData: FundingRoundData = {
    round,
    valuationUsd: valuationResult.value,
    time: timeResult.time,
    confidence,
    notes: [valuationResult.notes, timeResult.notes, rawCell]
      .filter(Boolean)
      .join('; '),
    sourceColumn: columnName,
    currency: valuationResult.currency || 'USD',
  };

  return {
    rounds: [roundData],
    parseStatus,
    rawCell,
    notes: `Round: ${round}, Valuation: ${valuationResult.value ? `$${valuationResult.value.toLocaleString()}` : 'N/A'}, Time: ${timeResult.time || 'N/A'}`,
  };
}

/**
 * Validate valuation is within plausible bounds
 */
export function validateValuation(value: number): { valid: boolean; reason?: string } {
  const MIN_VAL = 100_000; // $100k
  const MAX_VAL = 200_000_000_000; // $200B

  if (isNaN(value) || !isFinite(value)) {
    return { valid: false, reason: 'NaN or infinite' };
  }

  if (value < MIN_VAL) {
    return { valid: false, reason: `Below minimum: $${value.toLocaleString()} < $${MIN_VAL.toLocaleString()}` };
  }

  if (value > MAX_VAL) {
    return { valid: false, reason: `Above maximum: $${value.toLocaleString()} > $${MAX_VAL.toLocaleString()}` };
  }

  return { valid: true };
}

