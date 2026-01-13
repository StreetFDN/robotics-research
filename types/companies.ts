/**
 * Canonical schema for private robotics companies dataset
 */

export interface CompanyHQ {
  lat: number;
  lon: number;
  confidence: 'high' | 'med' | 'low';
  source: string;
  rawAddress?: string; // For addresses that look like street addresses
}

export interface CompanySource {
  dataset: 'private_companies.csv';
  row: number;
}

export interface PrivateCompany {
  id: string; // stable deterministic id
  name: string;
  aliases: string[]; // name variants, product names, abbreviations
  description?: string;
  tags: string[]; // humanoid, warehouse, etc
  website?: string;
  country?: string;
  region?: string;
  city?: string;
  hq: CompanyHQ;
  lastUpdated: string; // ISO
  source: CompanySource;
  fundingRounds?: import('./funding').FundingRoundData[]; // Added in v2
}

export interface DatasetSummary {
  totalRows: number;
  duplicatesDetected: number;
  withHQCoords: number;
  withHQCoordsPercent: number;
  missingCriticalFields: {
    name: number;
    country: number;
    city: number;
    hq: number;
  };
  generatedAt: string; // ISO
  version: string;
}

export interface QAMerge {
  id: string;
  mergedRecords: number;
  keptDescription: string; // length
  mergedTags: string[];
  mergedAliases: string[];
  keptHQ: { lat: number; lon: number; confidence: string };
  sourceRows: number[];
}

export interface QACoordFix {
  id: string;
  name: string;
  before: { lat: number; lon: number };
  after: { lat: number; lon: number };
  reason: string;
}

export interface QACoordIssue {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  issue: string;
}

export interface QALowConfidenceCoords {
  id: string;
  name: string;
  lat: number;
  lon: number;
  confidence: 'low';
  source: string;
  country?: string;
  city?: string;
  reason: string;
}

export interface QAReport {
  generatedAt: string; // ISO
  version: string;
  duplicatesMerged: QAMerge[];
  coordsFixed: QACoordFix[];
  coordsMissing: QACoordIssue[];
  suspiciousCoords: QACoordIssue[];
  lowConfidenceCoords: QALowConfidenceCoords[];
  summary: {
    totalMerges: number;
    totalCoordsFixed: number;
    totalCoordsMissing: number;
    totalSuspiciousCoords: number;
    totalLowConfidenceCoords: number;
  };
}

