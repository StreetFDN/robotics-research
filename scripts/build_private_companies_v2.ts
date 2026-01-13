/**
 * Unified build script for private companies v2
 * Combines normalization (ids, tags, aliases, hq) with enhanced funding parsing
 * 
 * Outputs:
 * - data/processed/private_companies.v2.json (final merged dataset)
 * - data/processed/private_companies.v2.funding_index.json (flattened time series)
 * - data/processed/private_companies.v2.qa.json (QA report for non-OK rows)
 * - data/processed/private_companies.v2.summary.json (dataset statistics)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createHash } from 'crypto';
import type { PrivateCompany } from '../types/companies';
import type { FundingRoundData, FundingQAReport, FundingQAEntry, FundingIndex, FundingIndexEntry, FundingSummary, ParseStatus } from '../types/funding';
import { parseFundingCell, validateValuation } from './funding_parser_v2';

interface CSVRow {
  'Company Name': string;
  'Brief Description': string;
  'Company ID': string;
  'Founder Name': string;
  'Geolocation': string;
  'Last Valuation': string;
  'Location City': string;
  'Notable Investors': string;
  'Pre-Seed Valuation and Date': string;
  'Seed Valuation and Date': string;
  'Series A Valuation and Date': string;
  'Series B Valuation and Date': string;
  'Series C Valuation and Date': string;
  'Series D Valuation and Date': string;
  'Series E Valuation and Date': string;
  [key: string]: string;
}

// Reuse normalization functions from build_private_companies_dataset.ts
function normalizeString(str: string | undefined): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

function parseCoordinates(geolocation: string): { lat: number; lon: number; confidence: 'high' | 'med' | 'low'; source: string } | null {
  if (!geolocation || !geolocation.trim()) {
    return null;
  }

  // Try to parse as "lat,lon" or "lat, lon"
  const match = geolocation.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    
    // Basic validation
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        lat,
        lon,
        confidence: 'high',
        source: 'csv_geolocation',
      };
    }
  }

  return null;
}

function parseLocation(locationCity: string): { country?: string; region?: string; city?: string } {
  if (!locationCity || !locationCity.trim()) {
    return {};
  }

  const normalized = normalizeString(locationCity).toLowerCase();
  const result: { country?: string; region?: string; city?: string } = {};

  // Simplified country detection (reuse from original if needed)
  const COUNTRY_MAPPINGS: Record<string, string> = {
    'usa': 'United States',
    'us': 'United States',
    'united states': 'United States',
    'uk': 'United Kingdom',
    'united kingdom': 'United Kingdom',
    'canada': 'Canada',
    'switzerland': 'Switzerland',
    'germany': 'Germany',
    'china': 'China',
    'india': 'India',
    'spain': 'Spain',
    'france': 'France',
  };

  for (const [key, country] of Object.entries(COUNTRY_MAPPINGS)) {
    if (normalized.includes(key)) {
      result.country = country;
      break;
    }
  }

  // Extract city
  const cityMatch = locationCity.match(/^([^,(]+?)(?:\s*\(|,|$)/);
  if (cityMatch) {
    result.city = normalizeString(cityMatch[1]);
  }

  return result;
}

function extractWebsite(description: string, companyId: string): string | undefined {
  const urlMatch = description?.match(/https?:\/\/(?:www\.)?([^\s\/\)]+)/i);
  if (urlMatch) {
    return urlMatch[0];
  }
  return undefined;
}

function generateId(name: string, website?: string): string {
  const normalizedName = normalizeString(name).toLowerCase();
  const domain = website ? new URL(website).hostname.replace(/^www\./, '') : '';
  const combined = `${normalizedName}|${domain}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

function buildAliases(name: string, website?: string, description?: string): string[] {
  const aliases: string[] = [];
  
  // Add name variations
  aliases.push(name);
  
  // Extract domain from website
  if (website) {
    try {
      const domain = new URL(website).hostname.replace(/^www\./, '');
      if (domain && domain !== name.toLowerCase()) {
        aliases.push(domain);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return Array.from(new Set(aliases));
}

function extractTags(description: string): string[] {
  if (!description) return [];
  
  const TAG_KEYWORDS = [
    'humanoid', 'warehouse', 'logistics', 'agricultural', 'agriculture', 'farming',
    'autonomous', 'delivery', 'service', 'industrial', 'manufacturing', 'construction',
    'healthcare', 'medical', 'surgical', 'food', 'restaurant', 'cooking',
    'cleaning', 'domestic', 'household', 'consumer', 'defense', 'military',
    'mobile', 'manipulation', 'gripper', 'quadruped', 'bipedal', 'legged',
    'collaborative', 'cobot', 'pick-and-place', 'piece-picking', 'fulfillment',
    'inspection', 'security', 'surveillance', 'monitoring', 'harvesting',
    'weeding', 'precision agriculture', 'foundation model', 'foundation ai',
    'general-purpose', 'general purpose', 'dexterous', 'manipulation',
  ];
  
  const normalized = description.toLowerCase();
  const found: string[] = [];
  
  for (const tag of TAG_KEYWORDS) {
    if (normalized.includes(tag)) {
      found.push(tag);
    }
  }
  
  return found;
}

/**
 * Load v1 companies to preserve HQ coords
 */
function loadV1Companies(): Map<string, PrivateCompany> {
  const v1Path = path.join(__dirname, '../data/processed/private_companies.v1.json');
  if (!fs.existsSync(v1Path)) {
    console.warn(`[V2 Build] v1 file not found at ${v1Path}, will create new companies`);
    return new Map();
  }
  
  const v1Content = fs.readFileSync(v1Path, 'utf-8');
  const v1Companies: PrivateCompany[] = JSON.parse(v1Content);
  const v1Map = new Map<string, PrivateCompany>();
  
  for (const company of v1Companies) {
    v1Map.set(company.id, company);
  }
  
  console.log(`[V2 Build] Loaded ${v1Companies.length} companies from v1`);
  return v1Map;
}

/**
 * Deduplicate companies by ID
 */
function deduplicateCompanies(companies: PrivateCompany[]): {
  deduplicated: PrivateCompany[];
  merges: Array<{ merged: string[]; kept: string }>;
} {
  const byId = new Map<string, PrivateCompany[]>();
  
  // Group by ID
  for (const company of companies) {
    if (!byId.has(company.id)) {
      byId.set(company.id, []);
    }
    byId.get(company.id)!.push(company);
  }
  
  const deduplicated: PrivateCompany[] = [];
  const merges: Array<{ merged: string[]; kept: string }> = [];
  
  for (const [id, group] of byId.entries()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      // Merge multiple entries
      const merged = group.reduce((best, current) => {
        // Keep longest description
        if ((current.description?.length || 0) > (best.description?.length || 0)) {
          best.description = current.description;
        }
        
        // Union tags
        const allTags = new Set([...best.tags, ...current.tags]);
        best.tags = Array.from(allTags);
        
        // Union aliases
        const allAliases = new Set([...best.aliases, ...current.aliases]);
        best.aliases = Array.from(allAliases);
        
        // Keep best HQ (highest confidence, non-zero)
        if (current.hq.confidence === 'high' && (best.hq.lat === 0 || best.hq.lon === 0)) {
          best.hq = current.hq;
        } else if (current.hq.confidence === 'med' && best.hq.confidence === 'low' && (best.hq.lat === 0 || best.hq.lon === 0)) {
          best.hq = current.hq;
        } else if (current.hq.lat !== 0 && current.hq.lon !== 0 && (best.hq.lat === 0 || best.hq.lon === 0)) {
          best.hq = current.hq;
        }
        
        // Merge funding rounds (dedupe by round+time+valuationUsd+moneyRaisedUsd)
        const existingRounds = new Map<string, FundingRoundData>();
        for (const round of best.fundingRounds || []) {
          const key = `${round.round}|${round.time || ''}|${round.valuationUsd || ''}|${round.moneyRaisedUsd || ''}`;
          existingRounds.set(key, round);
        }
        for (const round of current.fundingRounds || []) {
          const key = `${round.round}|${round.time || ''}|${round.valuationUsd || ''}|${round.moneyRaisedUsd || ''}`;
          if (!existingRounds.has(key)) {
            existingRounds.set(key, round);
          }
        }
        best.fundingRounds = Array.from(existingRounds.values());
        
        return best;
      }, group[0]);
      
      deduplicated.push(merged);
      merges.push({
        merged: group.map(c => c.name),
        kept: merged.name,
      });
    }
  }
  
  return { deduplicated, merges };
}

/**
 * Validate time format (MM must be 01-12)
 */
function validateTime(time: string | undefined): { valid: boolean; reason?: string } {
  if (!time) return { valid: false, reason: 'missing' };
  
  const parts = time.split('/');
  if (parts.length !== 2) {
    return { valid: false, reason: `invalid format: ${time}` };
  }
  
  const month = parseInt(parts[0], 10);
  const year = parseInt(parts[1], 10);
  
  if (isNaN(month) || isNaN(year)) {
    return { valid: false, reason: `non-numeric: ${time}` };
  }
  
  if (month < 1 || month > 12) {
    return { valid: false, reason: `invalid month: ${month} (must be 01-12)` };
  }
  
  if (year < 1900 || year > 2100) {
    return { valid: false, reason: `invalid year: ${year}` };
  }
  
  return { valid: true };
}

/**
 * Check if round matches expected from source column
 */
function getExpectedRound(columnName: string): FundingRound | null {
  const colLower = columnName.toLowerCase();
  if (colLower.includes('pre-seed') || colLower.includes('preseed')) return 'pre-seed';
  if (colLower.includes('seed') && !colLower.includes('pre')) return 'seed';
  if (colLower.includes('series a') || colLower.includes('series-a')) return 'series-a';
  if (colLower.includes('series b') || colLower.includes('series-b')) return 'series-b';
  if (colLower.includes('series c') || colLower.includes('series-c')) return 'series-c';
  if (colLower.includes('series d') || colLower.includes('series-d')) return 'series-d';
  if (colLower.includes('series e') || colLower.includes('series-e')) return 'series-e';
  if (colLower.includes('last valuation')) return null; // "Last Valuation" doesn't have a specific round
  return null;
}

/**
 * Main build function
 */
async function buildV2(): Promise<void> {
  const inputPath = path.join(__dirname, '../data/raw/private_companies.csv');
  const outputDir = path.join(__dirname, '../data/processed');
  const v2Path = path.join(outputDir, 'private_companies.v2.json');
  const fundingIndexPath = path.join(outputDir, 'private_companies.v2.funding_index.json');
  const qaPath = path.join(outputDir, 'private_companies.v2.qa.json');
  const summaryPath = path.join(outputDir, 'private_companies.v2.summary.json');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('[V2 Build] Starting...');
  
  // Load v1 companies to preserve HQ coords
  const v1Companies = loadV1Companies();
  
  console.log(`[V2 Build] Reading CSV from: ${inputPath}`);

  // Read and parse CSV
  let csvContent = fs.readFileSync(inputPath, 'utf-8');
  
  // Remove BOM if present
  if (csvContent.charCodeAt(0) === 0xFEFF) {
    csvContent = csvContent.slice(1);
  }
  
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[V2 Build] Loaded ${records.length} rows from CSV`);

  // Funding columns to parse
  const FUNDING_COLUMNS = [
    'Last Valuation',
    'Pre-Seed Valuation and Date',
    'Seed Valuation and Date',
    'Series A Valuation and Date',
    'Series B Valuation and Date',
    'Series C Valuation and Date',
    'Series D Valuation and Date',
    'Series E Valuation and Date',
  ];

  const companies: PrivateCompany[] = [];
  const allRounds: Array<FundingRoundData & { companyId: string }> = [];
  const qaEntries: FundingQAEntry[] = [];
  
  let okCount = 0;
  let partialCount = 0;
  let failedCount = 0;
  let withMoneyRaised = 0;
  let withTargetValuations = 0;
  let withYearOnlyDates = 0;
  let invalidTimeCount = 0;
  let stageMismatchCount = 0;
  let hqRegressionCount = 0;
  const roundsByStage: Record<string, number> = {};

  // Process each row
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // +2 because CSV is 1-indexed and has header

    const name = normalizeString(row['Company Name']);
    if (!name) {
      console.warn(`[V2 Build] Skipping row ${rowNum}: missing company name`);
      continue;
    }

    const description = normalizeString(row['Brief Description']);
    const website = extractWebsite(description, row['Company ID']);
    const id = generateId(name, website);

    // Preserve HQ from v1 if available, otherwise parse from CSV
    let hqCoords;
    const v1Company = v1Companies.get(id);
    if (v1Company && v1Company.hq && v1Company.hq.lat !== 0 && v1Company.hq.lon !== 0) {
      // Use v1 HQ coords
      hqCoords = v1Company.hq;
    } else {
      // Parse from CSV
      hqCoords = parseCoordinates(row['Geolocation']);
      if (!hqCoords) {
        hqCoords = {
          lat: 0,
          lon: 0,
          confidence: 'low',
          source: 'default'
        };
      }
    }

    // Parse location
    const location = parseLocation(row['Location City']);

    // Build base company object
    const company: PrivateCompany = {
      id,
      name,
      aliases: buildAliases(name, website, description),
      description: description || undefined,
      tags: extractTags(description),
      website: website || undefined,
      country: location.country,
      region: location.region,
      city: location.city,
      hq: hqCoords,
      lastUpdated: new Date().toISOString(),
      source: {
        dataset: 'private_companies.csv',
        row: rowNum,
      },
    };

    // Parse funding columns
    const companyRounds: FundingRoundData[] = [];
    
    for (const columnName of FUNDING_COLUMNS) {
      const cellValue = row[columnName] || '';
      
      if (!cellValue.trim() || cellValue.trim().toUpperCase() === 'N/A') {
        continue; // Skip empty/N/A cells
      }

      const parseResult = parseFundingCell(columnName, cellValue);
      
      // Track parse status
      if (parseResult.parseStatus === 'OK') {
        okCount++;
      } else if (parseResult.parseStatus === 'PARTIAL') {
        partialCount++;
      } else {
        failedCount++;
      }

      // Add rounds to company
      for (const round of parseResult.rounds) {
        // Validate time format
        const timeValidation = validateTime(round.time);
        if (!timeValidation.valid && round.time) {
          invalidTimeCount++;
          console.warn(`[V2 Build] ${name}: Invalid time ${round.time} - ${timeValidation.reason}`);
          round.time = undefined;
          round.notes = `${round.notes}; invalid_time: ${timeValidation.reason}`;
          round.confidence = 'low';
        }
        
        // Check stage mismatch
        const expectedRound = getExpectedRound(columnName);
        if (expectedRound && round.round !== expectedRound && round.round !== 'unknown') {
          // Allow sub-rounds (e.g., series-a2 from Series A column is OK)
          const baseRound = round.round.replace(/\d+$/, '');
          const expectedBase = expectedRound.replace(/\d+$/, '');
          if (baseRound !== expectedBase) {
            stageMismatchCount++;
            console.warn(`[V2 Build] ${name}: Stage mismatch - expected ${expectedRound} from "${columnName}", got ${round.round}`);
          }
        }
        
        // Validate valuation if present
        if (round.valuationUsd !== undefined) {
          const validation = validateValuation(round.valuationUsd);
          if (!validation.valid) {
            console.warn(`[V2 Build] ${name}: Invalid valuation ${round.valuationUsd} - ${validation.reason}`);
            // Still include it but note the issue
            round.notes = `${round.notes}; ${validation.reason}`;
            round.confidence = 'low';
          }
        }

        // Track statistics
        if (round.moneyRaisedUsd !== undefined) {
          withMoneyRaised++;
        }
        if (round.notes?.includes('target')) {
          withTargetValuations++;
        }
        if (round.time && round.notes?.includes('year-only')) {
          withYearOnlyDates++;
        }
        
        roundsByStage[round.round] = (roundsByStage[round.round] || 0) + 1;

        // Add company ID for indexing
        const roundWithCompanyId = { ...round, companyId: id };
        allRounds.push(roundWithCompanyId);
        companyRounds.push(round);
      }

      // Add to QA if not OK
      if (parseResult.parseStatus !== 'OK') {
        qaEntries.push({
          companyId: id,
          companyName: name,
          sourceColumn: columnName,
          rawCell: cellValue,
          parseStatus: parseResult.parseStatus,
          reason: parseResult.notes || 'Parsing issue',
          parsedRounds: parseResult.rounds,
          llmAssisted: false,
        });
      }
    }

    // Add funding rounds to company
    if (companyRounds.length > 0) {
      company.fundingRounds = companyRounds;
    }

    companies.push(company);
  }

  console.log(`[V2 Build] Processed ${companies.length} companies`);
  
  // Deduplicate companies
  console.log(`[V2 Build] Deduplicating companies...`);
  const { deduplicated, merges } = deduplicateCompanies(companies);
  if (merges.length > 0) {
    console.log(`[V2 Build] Merged ${merges.length} duplicate groups:`);
    for (const merge of merges) {
      console.log(`  - Merged ${merge.merged.join(', ')} -> kept ${merge.kept}`);
    }
  }
  
  // Check for HQ regressions
  for (const company of deduplicated) {
    const v1Company = v1Companies.get(company.id);
    if (v1Company && v1Company.hq && v1Company.hq.lat !== 0 && v1Company.hq.lon !== 0) {
      if (company.hq.lat === 0 && company.hq.lon === 0) {
        hqRegressionCount++;
        console.warn(`[V2 Build] ${company.name}: HQ regression detected, restoring from v1`);
        company.hq = v1Company.hq;
      }
    }
  }
  
  console.log(`[V2 Build] Funding parsing: OK=${okCount}, PARTIAL=${partialCount}, FAILED=${failedCount}`);
  console.log(`[V2 Build] Total funding rounds extracted: ${allRounds.length}`);
  console.log(`[V2 Build] Invalid times: ${invalidTimeCount}`);
  console.log(`[V2 Build] Stage mismatches: ${stageMismatchCount}`);
  console.log(`[V2 Build] HQ regressions (fixed): ${hqRegressionCount}`);

  // Build funding index (only rounds with valuation and time)
  const fundingIndexEntries: FundingIndexEntry[] = allRounds
    .filter(r => r.valuationUsd !== undefined && r.time !== undefined)
    .map(r => ({
      companyId: r.companyId,
      companyName: deduplicated.find(c => c.id === r.companyId)?.name || 'Unknown',
      round: r.round,
      valuationUsd: r.valuationUsd!,
      time: r.time!,
      confidence: r.confidence,
      sourceColumn: r.sourceColumn,
    }))
    .sort((a, b) => {
      // Sort by time, then by company name
      if (a.time !== b.time) {
        return a.time.localeCompare(b.time);
      }
      return a.companyName.localeCompare(b.companyName);
    });

  console.log(`[V2 Build] Funding index entries: ${fundingIndexEntries.length}`);

  // Build QA report
  const qaReport: FundingQAReport = {
    generatedAt: new Date().toISOString(),
    version: '2.0',
    totalRows: okCount + partialCount + failedCount,
    okCount,
    partialCount,
    failedCount,
    llmAssistedCount: 0,
    entries: qaEntries,
    summary: {
      withMoneyRaised,
      withTargetValuations,
      withYearOnlyDates,
      roundsByStage,
      invalidTimeCount,
      stageMismatchCount,
      hqRegressionCount,
      duplicatesMerged: merges,
    },
  };

  // Build summary
  const summary: FundingSummary = {
    generatedAt: new Date().toISOString(),
    version: '2.0',
    totalCompanies: deduplicated.length,
    totalRounds: allRounds.length,
    roundsByStage,
    okCount,
    partialCount,
    failedCount,
    withMoneyRaised,
    withTargetValuations,
    withYearOnlyDates,
    invalidTimeCount,
    stageMismatchCount,
    hqRegressionCount,
    duplicatesMerged: merges.length,
  };

  // Build funding index
  const fundingIndex: FundingIndex = {
    generatedAt: new Date().toISOString(),
    version: '2.0',
    entries: fundingIndexEntries,
  };

  // Write outputs
  console.log(`[V2 Build] Writing outputs...`);
  fs.writeFileSync(v2Path, JSON.stringify(deduplicated, null, 2));
  console.log(`[V2 Build] Wrote v2 companies to ${v2Path}`);

  fs.writeFileSync(fundingIndexPath, JSON.stringify(fundingIndex, null, 2));
  console.log(`[V2 Build] Wrote funding index to ${fundingIndexPath}`);

  fs.writeFileSync(qaPath, JSON.stringify(qaReport, null, 2));
  console.log(`[V2 Build] Wrote QA report to ${qaPath}`);

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`[V2 Build] Wrote summary to ${summaryPath}`);

  console.log(`[V2 Build] Summary:`);
  console.log(`  Total companies: ${summary.totalCompanies} (${merges.length} duplicates merged)`);
  console.log(`  Total funding rounds: ${summary.totalRounds}`);
  console.log(`  Funding index entries: ${fundingIndexEntries.length}`);
  console.log(`  OK parses: ${okCount}`);
  console.log(`  PARTIAL parses: ${partialCount}`);
  console.log(`  FAILED parses: ${failedCount}`);
  console.log(`  Invalid times: ${invalidTimeCount}`);
  console.log(`  Stage mismatches: ${stageMismatchCount}`);
  console.log(`  HQ regressions (fixed): ${hqRegressionCount}`);
  console.log(`  With money raised: ${withMoneyRaised}`);
  console.log(`  With target valuations: ${withTargetValuations}`);
  console.log(`  With year-only dates: ${withYearOnlyDates}`);
  console.log(`[V2 Build] Complete!`);
}

// Run if called directly
if (require.main === module) {
  buildV2().catch(error => {
    console.error('[V2 Build] Error:', error);
    process.exit(1);
  });
}

export { buildV2 };

