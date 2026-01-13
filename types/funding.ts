/**
 * Funding and valuation types for private companies
 */

export type FundingRound = 'pre-seed' | 'seed' | 'series-a' | 'series-a1' | 'series-a2' | 'series-b' | 'series-b1' | 'series-b2' | 'series-c' | 'series-c1' | 'series-c2' | 'series-d' | 'series-e' | 'unknown';

export type ParseStatus = 'OK' | 'PARTIAL' | 'FAILED';

export type Confidence = 'high' | 'med' | 'low';

export interface FundingRoundData {
  round: FundingRound;
  valuationUsd?: number; // in USD, normalized
  moneyRaisedUsd?: number; // optional: funding amount when cell contains both amount and valuation
  time?: string; // MM/YYYY format
  confidence: Confidence;
  notes: string; // raw cell or parsing notes
  sourceColumn: string; // which CSV column this came from
  currency?: string; // USD, EUR, GBP, unknown
}

export interface FundingParseResult {
  rounds: FundingRoundData[];
  parseStatus: ParseStatus;
  rawCell: string; // original cell value
  notes: string; // overall parsing notes
}

export interface FundingQAEntry {
  companyId: string;
  companyName: string;
  sourceColumn: string;
  rawCell: string;
  parseStatus: ParseStatus;
  reason: string;
  parsedRounds: FundingRoundData[];
  llmAssisted?: boolean;
}

export interface FundingQAReport {
  generatedAt: string; // ISO
  version: string;
  totalRows: number;
  okCount: number;
  partialCount: number;
  failedCount: number;
  llmAssistedCount: number;
  entries: FundingQAEntry[];
  summary: {
    withMoneyRaised: number;
    withTargetValuations: number;
    withYearOnlyDates: number;
    roundsByStage: Record<string, number>;
    invalidTimeCount?: number;
    stageMismatchCount?: number;
    hqRegressionCount?: number;
    duplicatesMerged?: Array<{ merged: string[]; kept: string }>;
  };
}

export interface FundingIndexEntry {
  companyId: string;
  companyName: string;
  round: FundingRound;
  valuationUsd: number;
  time: string; // MM/YYYY
  confidence: Confidence;
  sourceColumn: string;
}

export interface FundingIndex {
  generatedAt: string; // ISO
  version: string;
  entries: FundingIndexEntry[];
}

export interface FundingSummary {
  generatedAt: string; // ISO
  version: string;
  totalCompanies: number;
  totalRounds: number;
  roundsByStage: Record<string, number>;
  okCount: number;
  partialCount: number;
  failedCount: number;
  withMoneyRaised: number;
  withTargetValuations: number;
  withYearOnlyDates: number;
  invalidTimeCount?: number;
  stageMismatchCount?: number;
  hqRegressionCount?: number;
  duplicatesMerged?: number;
}
