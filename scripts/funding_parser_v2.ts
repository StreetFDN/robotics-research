/**
 * Enhanced funding parser v2 - handles edge cases and complex patterns
 */

import type { FundingRoundData, FundingParseResult, FundingRound, Confidence } from '../types/funding';

// Round name mappings with sub-round support
const ROUND_MAP: Record<string, FundingRound> = {
  'pre-seed': 'pre-seed',
  'preseed': 'pre-seed',
  'seed': 'seed',
  'series a': 'series-a',
  'series-a': 'series-a',
  'seriesa': 'series-a',
  'a': 'series-a',
  'a1': 'series-a1',
  'a2': 'series-a2',
  'series b': 'series-b',
  'series-b': 'series-b',
  'seriesb': 'series-b',
  'b': 'series-b',
  'b1': 'series-b1',
  'b2': 'series-b2',
  'series c': 'series-c',
  'series-c': 'series-c',
  'seriesc': 'series-c',
  'c': 'series-c',
  'c1': 'series-c1',
  'c2': 'series-c2',
  'series d': 'series-d',
  'series-d': 'series-d',
  'seriesd': 'series-d',
  'd': 'series-d',
  'series e': 'series-e',
  'series-e': 'series-e',
  'seriese': 'series-e',
  'e': 'series-e',
};

// Currency multipliers - word and abbreviation support
const CURRENCY_MULTIPLIERS: Record<string, number> = {
  'k': 1_000,
  'thousand': 1_000,
  'm': 1_000_000,
  'million': 1_000_000,
  'b': 1_000_000_000,
  'billion': 1_000_000_000,
  'bn': 1_000_000_000,
  't': 1_000_000_000_000,
  'trillion': 1_000_000_000_000,
};

// Month name mappings
const MONTH_MAP: Record<string, string> = {
  'jan': '01', 'january': '01',
  'feb': '02', 'february': '02',
  'mar': '03', 'march': '03',
  'apr': '04', 'april': '04',
  'may': '05',
  'jun': '06', 'june': '06',
  'jul': '07', 'july': '07',
  'aug': '08', 'august': '08',
  'sep': '09', 'september': '09',
  'oct': '10', 'october': '10',
  'nov': '11', 'november': '11',
  'dec': '12', 'december': '12',
};

/**
 * Check if text indicates a raise/grant rather than valuation
 */
function isRaiseOrGrant(text: string): boolean {
  const lower = text.toLowerCase();
  const raiseKeywords = [
    'raised', 'funding', 'grant', 'nsf', 'seed funding', 
    'series a raised', 'series b raised', 'round size',
    'raised $', 'funding of', 'grant of'
  ];
  
  // Check if it contains raise keywords but NOT valuation keywords
  const hasRaiseKeyword = raiseKeywords.some(kw => lower.includes(kw));
  const hasValuationKeyword = lower.includes('valuation') || 
                              lower.includes('valued at') || 
                              lower.includes('post-money') || 
                              lower.includes('pre-money') ||
                              lower.includes('at $');
  
  return hasRaiseKeyword && !hasValuationKeyword;
}

/**
 * Extract valuation from text with enhanced pattern matching
 */
export function extractValuation(text: string): { 
  value?: number; 
  moneyRaised?: number; // For cases like "$50M at Est. $200M"
  currency?: string; 
  notes: string;
  hasTarget?: boolean;
  hasEst?: boolean;
  isRaise?: boolean; // True if this is a raise/grant, not a valuation
} {
  if (!text || text.trim().toUpperCase() === 'N/A' || text.trim() === '') {
    return { notes: 'Empty or N/A' };
  }

  const normalized = text.trim();
  let notes: string[] = [];
  let hasTarget = false;
  let hasEst = false;
  const isRaise = isRaiseOrGrant(normalized);

  // Check for estimation/target keywords
  const estPatterns = /\b(est\.?|estimated|~|approx\.?|approximately|target)\b/gi;
  if (estPatterns.test(normalized)) {
    hasEst = true;
    if (normalized.toLowerCase().includes('target')) {
      hasTarget = true;
      notes.push('target valuation');
    } else {
      notes.push('estimated');
    }
  }
  
  if (isRaise) {
    notes.push('raise/grant (not valuation)');
  }

  // Remove common prefixes/suffixes
  let cleanText = normalized
    .replace(/^target\s+/i, '')
    .replace(/^est\.?\s*/i, '')
    .replace(/^estimated\s*/i, '')
    .replace(/\s*\(.*?\)/g, '') // Remove parenthetical notes (we'll extract separately)
    .replace(/\s*\[.*?\]/g, '') // Remove bracket notes
    .trim();

  // Handle cases with BOTH funding amount and valuation
  // Pattern: "$50M at Est. $200M" or "$50M at $200M"
  const bothAmountMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion)\s+at\s+(?:est\.?\s*)?\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion)/i);
  if (bothAmountMatch) {
    const [, raisedNum, raisedSuffix, valNum, valSuffix] = bothAmountMatch;
    const raisedMultiplier = CURRENCY_MULTIPLIERS[raisedSuffix.toLowerCase()] || 
      (raisedSuffix.toLowerCase().includes('million') ? 1_000_000 : 
       raisedSuffix.toLowerCase().includes('billion') ? 1_000_000_000 : 1);
    const valMultiplier = CURRENCY_MULTIPLIERS[valSuffix.toLowerCase()] || 
      (valSuffix.toLowerCase().includes('million') ? 1_000_000 : 
       valSuffix.toLowerCase().includes('billion') ? 1_000_000_000 : 1);
    
    const moneyRaised = parseFloat(raisedNum) * raisedMultiplier;
    const value = parseFloat(valNum) * valMultiplier;
    notes.push(`both_present: funding $${raisedNum}${raisedSuffix}, valuation $${valNum}${valSuffix}`);
    return { value, moneyRaised, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst, isRaise: false };
  }
  
  // If this is a raise/grant, extract as moneyRaised only
  if (isRaise) {
    // Standard format with word multipliers: $200M, 1.2B, 750k, $17 million, $1.2 billion
    const standardMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion|thousand)/i);
    if (standardMatch) {
      const [, numStr, suffix] = standardMatch;
      const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 
        (suffix.toLowerCase().includes('million') ? 1_000_000 : 
         suffix.toLowerCase().includes('billion') ? 1_000_000_000 : 
         suffix.toLowerCase().includes('thousand') ? 1_000 : 1);
      const moneyRaised = parseFloat(numStr) * multiplier;
      notes.push('raise/grant amount');
      return { moneyRaised, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst, isRaise: true };
    }
  }

  // Check for ranges (e.g., $50-70M, $50M-$70M)
  const rangeMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*[-–—]\s*\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion)/i);
  if (rangeMatch) {
    const [, minStr, maxStr, suffix] = rangeMatch;
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 
      (suffix.toLowerCase().includes('million') ? 1_000_000 : 
       suffix.toLowerCase().includes('billion') ? 1_000_000_000 : 1);
    const avg = ((min + max) / 2) * multiplier;
    notes.push(`Range: $${min}${suffix}-$${max}${suffix}, using average`);
    return { value: avg, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst };
  }

  // Check for plus notation (e.g., $50M+)
  const plusMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion)\s*\+/i);
  if (plusMatch) {
    const [, numStr, suffix] = plusMatch;
    const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 
      (suffix.toLowerCase().includes('million') ? 1_000_000 : 
       suffix.toLowerCase().includes('billion') ? 1_000_000_000 : 1);
    const value = parseFloat(numStr) * multiplier;
    notes.push(`Minimum: $${numStr}${suffix}+`);
    return { value, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst };
  }

  // Standard format with word multipliers: $200M, 1.2B, 750k, $17 million, $1.2 billion
  const standardMatch = cleanText.match(/\$?(\d+(?:\.\d+)?)\s*([kmbt]|million|billion|thousand)/i);
  if (standardMatch) {
    const [, numStr, suffix] = standardMatch;
    const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 
      (suffix.toLowerCase().includes('million') ? 1_000_000 : 
       suffix.toLowerCase().includes('billion') ? 1_000_000_000 : 
       suffix.toLowerCase().includes('thousand') ? 1_000 : 1);
    const value = parseFloat(numStr) * multiplier;
    if (notes.length === 0) {
      notes.push('extracted');
    }
    return { value, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst, isRaise: false };
  }

  // Try to find any number with multiplier
  const anyNumberMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*([kmbt]|million|billion|thousand)/i);
  if (anyNumberMatch) {
    const [, numStr, suffix] = anyNumberMatch;
    const multiplier = CURRENCY_MULTIPLIERS[suffix.toLowerCase()] || 
      (suffix.toLowerCase().includes('million') ? 1_000_000 : 
       suffix.toLowerCase().includes('billion') ? 1_000_000_000 : 
       suffix.toLowerCase().includes('thousand') ? 1_000 : 1);
    const value = parseFloat(numStr) * multiplier;
    notes.push('extracted from text');
    return { value, currency: 'USD', notes: notes.join('; '), hasTarget, hasEst, isRaise: false };
  }

  return { notes: `Could not extract valuation from: ${normalized}`, isRaise: false };
}

/**
 * Extract date/time from text with enhanced pattern matching
 */
export function extractTime(text: string): { time?: string; notes: string } {
  if (!text || text.trim().toUpperCase() === 'N/A' || text.trim() === '') {
    return { notes: 'Empty or N/A' };
  }

  const normalized = text.trim();
  let notes: string[] = [];
  const times: Array<{ time: string; specificity: number; notes: string }> = []; // specificity: 2=month+year, 1=year-only

  // Extract dates from parentheses first (often contains round info + date)
  const parenMatches = normalized.matchAll(/\(([^)]+)\)/g);
  for (const match of parenMatches) {
    const parenContent = match[1];
    
    // Look for dates in parentheses: "(Series B 2025)" or "(Series B - Nov 2025)"
    const parenYearMatch = parenContent.match(/\b(19|20)\d{2}\b/);
    if (parenYearMatch) {
      const year = parenYearMatch[0];
      
      // Check for month in parentheses
      const parenMonthMatch = parenContent.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/]?\s*(\d{4})/i);
      if (parenMonthMatch) {
        const [, monthStr, yearStr] = parenMonthMatch;
        const month = MONTH_MAP[monthStr.toLowerCase().substring(0, 3)];
        if (month) {
          times.push({ time: `${month}/${yearStr}`, specificity: 2, notes: 'from parentheses' });
        }
      } else {
        // Year only in parentheses
        times.push({ time: `01/${year}`, specificity: 1, notes: 'year-only from parentheses' });
      }
    }
  }

  // Month name + year: Aug 2021, August 2021, Aug-2021, Nov 2025
  const monthYearMatch = normalized.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/]?\s*(\d{4})/i);
  if (monthYearMatch) {
    const [, monthStr, year] = monthYearMatch;
    const month = MONTH_MAP[monthStr.toLowerCase().substring(0, 3)];
    if (month) {
      times.push({ time: `${month}/${year}`, specificity: 2, notes: '' });
    }
  }

  // Check for year ranges FIRST (e.g., "2022-2025") - must come before MM/YYYY parsing
  const yearRangeMatch = normalized.match(/\b(19|20)(\d{2})\s*[-–—]\s*(19|20)(\d{2})\b/);
  if (yearRangeMatch) {
    const [, startCentury, startYear, endCentury, endYear] = yearRangeMatch;
    const startFull = `${startCentury}${startYear}`;
    const endFull = `${endCentury}${endYear}`;
    // Use end year with note about range
    notes.push(`range ${startFull}–${endFull}`);
    times.push({ time: `01/${endFull}`, specificity: 1, notes: `range ${startFull}–${endFull}` });
  }

  // MM/YYYY or MM-YYYY: 08/2021, 8/2021, 08-2021
  // BUT: must validate month is 01-12 to avoid matching year ranges like "22-2025"
  const slashYearMatch = normalized.match(/(\d{1,2})\s*[-/]\s*(\d{4})/);
  if (slashYearMatch) {
    const [, month, year] = slashYearMatch;
    const monthNum = parseInt(month, 10);
    // Only accept if month is valid (01-12)
    if (monthNum >= 1 && monthNum <= 12) {
      const monthPadded = month.padStart(2, '0');
      times.push({ time: `${monthPadded}/${year}`, specificity: 2, notes: '' });
    } else {
      // Invalid month - likely a year range that wasn't caught above
      notes.push(`invalid_time_parsed_from:${normalized.substring(0, 50)}`);
    }
  }

  // Quarter: Q3 2021, Q3/2021, Q3-2021
  const quarterMatch = normalized.match(/q([1-4])\s*[-/]?\s*(\d{4})/i);
  if (quarterMatch) {
    const [, quarter, year] = quarterMatch;
    const monthMap: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' };
    const month = monthMap[quarter];
    notes.push(`Quarter Q${quarter}`);
    times.push({ time: `${month}/${year}`, specificity: 2, notes: `quarter Q${quarter}` });
  }

  // Year only: 2021 (but not if we already have a more specific date)
  const yearOnlyMatch = normalized.match(/\b(19|20)\d{2}\b/);
  if (yearOnlyMatch) {
    const year = yearOnlyMatch[0];
    // Only add if we don't have a more specific date
    if (times.length === 0 || times.every(t => t.specificity === 1)) {
      notes.push('year-only');
      times.push({ time: `01/${year}`, specificity: 1, notes: 'year-only' });
    }
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
    notes.push(`${qualifier} ${year}`);
    times.push({ time: `${month}/${year}`, specificity: 2, notes: `${qualifier} ${year}` });
  }

  // Choose most specific time (month+year beats year-only)
  if (times.length > 0) {
    const bestTime = times.reduce((best, current) => 
      current.specificity > best.specificity ? current : best
    );
    
    // Validate the time format: MM must be 01-12
    const [month, year] = bestTime.time.split('/');
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      // Invalid month - set time to null and add note
      const allNotes = [...notes, bestTime.notes, `invalid_time_parsed_from:${normalized.substring(0, 50)}`].filter(Boolean);
      return { time: undefined, notes: allNotes.join('; ') };
    }
    
    const allNotes = [...notes, bestTime.notes].filter(Boolean);
    return { time: bestTime.time, notes: allNotes.join('; ') };
  }

  return { notes: `Could not extract time from: ${normalized}` };
}

/**
 * Determine round type from column name or text content with sub-round support
 * PRIORITY: Column name is primary, text content only overrides for explicit sub-rounds
 */
export function determineRound(columnName: string, text?: string): FundingRound {
  const colLower = columnName.toLowerCase();
  
  // Determine base round from column name FIRST (this is the primary source)
  let baseRound: FundingRound | null = null;
  
  // Map column names to rounds
  if (colLower.includes('pre-seed') || colLower.includes('preseed')) {
    baseRound = 'pre-seed';
  } else if (colLower.includes('seed') && !colLower.includes('pre')) {
    baseRound = 'seed';
  } else if (colLower.includes('series a') || colLower.includes('series-a')) {
    baseRound = 'series-a';
  } else if (colLower.includes('series b') || colLower.includes('series-b')) {
    baseRound = 'series-b';
  } else if (colLower.includes('series c') || colLower.includes('series-c')) {
    baseRound = 'series-c';
  } else if (colLower.includes('series d') || colLower.includes('series-d')) {
    baseRound = 'series-d';
  } else if (colLower.includes('series e') || colLower.includes('series-e')) {
    baseRound = 'series-e';
  } else if (colLower.includes('last valuation')) {
    baseRound = 'unknown'; // "Last Valuation" doesn't map to a specific round
  }
  
  // Check for sub-round in text (A2, B1, etc.) - this can override base round
  if (text && baseRound) {
    const subRoundMatch = text.match(/\b([a-e])(\d+)\b/i);
    if (subRoundMatch) {
      const [, letter, num] = subRoundMatch;
      const subRoundKey = `${letter.toLowerCase()}${num}`;
      if (ROUND_MAP[subRoundKey]) {
        return ROUND_MAP[subRoundKey] as FundingRound;
      }
    }
  }
  
  // Return base round from column name
  if (baseRound) {
    return baseRound;
  }

  // Fallback: Check text content only if column name didn't match
  if (text) {
    const textLower = text.toLowerCase();
    
    // Check for explicit round mentions (only if column name didn't match)
    for (const [key, round] of Object.entries(ROUND_MAP)) {
      if (textLower.includes(key)) {
        // Check for sub-round
        const subRoundMatch = text.match(/\b([a-e])(\d+)\b/i);
        if (subRoundMatch) {
          const [, letter, num] = subRoundMatch;
          const subRoundKey = `${letter.toLowerCase()}${num}`;
          if (ROUND_MAP[subRoundKey]) {
            return ROUND_MAP[subRoundKey] as FundingRound;
          }
        }
        return round;
      }
    }
    
    // Check for sub-round notation like "A2" or "B1" (standalone)
    const subRoundMatch = text.match(/\b([a-e])(\d+)\b/i);
    if (subRoundMatch) {
      const [, letter, num] = subRoundMatch;
      const subRoundKey = `${letter.toLowerCase()}${num}`;
      if (ROUND_MAP[subRoundKey]) {
        return ROUND_MAP[subRoundKey] as FundingRound;
      }
    }
  }

  return 'unknown';
}

/**
 * Parse a single funding column cell with enhanced pattern matching
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

  // If this is a raise/grant, use moneyRaisedUsd instead of valuationUsd
  const isRaise = valuationResult.isRaise || false;
  
  // Determine parse status
  let parseStatus: ParseStatus = 'OK';
  const hasValue = isRaise ? (valuationResult.moneyRaised !== undefined) : (valuationResult.value !== undefined);
  if (!hasValue && !timeResult.time) {
    parseStatus = 'FAILED';
  } else if (!hasValue || !timeResult.time) {
    parseStatus = 'PARTIAL';
  }

  // Determine confidence
  let confidence: Confidence = 'high';
  if (parseStatus === 'FAILED') {
    confidence = 'low';
  } else if (parseStatus === 'PARTIAL') {
    confidence = 'med';
  } else if (valuationResult.hasTarget) {
    confidence = 'low';
  } else if (valuationResult.hasEst || timeResult.notes.includes('year-only') || timeResult.notes.includes('quarter')) {
    confidence = 'med';
  } else if (valuationResult.notes || timeResult.notes) {
    confidence = 'med';
  }

  // Build notes
  const allNotes: string[] = [];
  if (valuationResult.notes) allNotes.push(valuationResult.notes);
  if (timeResult.notes) allNotes.push(timeResult.notes);
  if (rawCell && !allNotes.includes(rawCell)) allNotes.push(rawCell);

  const roundData: FundingRoundData = {
    round,
    valuationUsd: isRaise ? undefined : valuationResult.value,
    moneyRaisedUsd: isRaise ? valuationResult.moneyRaised : valuationResult.moneyRaised,
    time: timeResult.time,
    confidence,
    notes: allNotes.join('; '),
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

