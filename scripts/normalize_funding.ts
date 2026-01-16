/**
 * Hybrid funding normalization pipeline
 * 
 * 1. Deterministic parsing first (regex/rules)
 * 2. Optional LLM assist only for unresolved rows
 * 
 * Usage: npm run build:funding [--use-llm=true]
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { parseFundingCell, validateValuation, determineRound } from './funding_parser';
import { processBatchWithLLM, loadLLMCache, saveLLMCache } from './llm_funding_assist';
import type { PrivateCompany } from '../types/companies';
import type { FundingRoundData, FundingQAReport, FundingQAEntry, FundingIndex, FundingIndexEntry, ParseStatus } from '../types/funding';

interface CSVRow {
  'Company Name': string;
  'Company ID': string;
  'Last Valuation': string;
  'Pre-Seed Valuation and Date': string;
  'Seed Valuation and Date': string;
  'Series A Valuation and Date': string;
  'Series B Valuation and Date': string;
  'Series C Valuation and Date': string;
  'Series D Valuation and Date': string;
  'Series E Valuation and Date': string;
  [key: string]: string;
}

// Funding columns to process
const FUNDING_COLUMNS = [
  'Last Valuation',
  'Pre-Seed Valuation and Date',
  'Seed Valuation and Date',
  'Series A Valuation and Date',
  'Series B Valuation and Date',
  'Series C Valuation and Date',
  'Series D Valuation and Date',
  'Series E Valuation and Date',
] as const;

/**
 * Load v1 companies dataset
 */
function loadV1Companies(): PrivateCompany[] {
  const v1Path = path.join(__dirname, '../data/processed/private_companies.v1.json');
  if (!fs.existsSync(v1Path)) {
    throw new Error(`v1 dataset not found at ${v1Path}. Run build:companies first.`);
  }
  return JSON.parse(fs.readFileSync(v1Path, 'utf-8'));
}

/**
 * Load raw CSV
 */
function loadCSV(): CSVRow[] {
  const csvPath = path.join(__dirname, '../data/raw/private_companies.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`);
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CSVRow[];
}

/**
 * Main normalization function
 */
async function normalizeFunding(useLLM: boolean = false): Promise<void> {
  console.log('[Funding Normalization] Starting...');
  console.log(`[Funding Normalization] LLM assist: ${useLLM ? 'ENABLED' : 'DISABLED'}`);

  // Load data
  const v1Companies = loadV1Companies();
  const csvRows = loadCSV();
  
  // Create company lookup by ID
  const companyMap = new Map<string, PrivateCompany>();
  for (const company of v1Companies) {
    companyMap.set(company.id, company);
  }

  // Create CSV row lookup by multiple keys:
  // 1. By row number (from source.row in v1 JSON)
  // 2. By Company ID
  // 3. By Company Name
  const csvMapById = new Map<string, CSVRow>();
  const csvMapByName = new Map<string, CSVRow>();
  const csvRowsByIndex = new Map<number, CSVRow>();
  
  csvRows.forEach((row, index) => {
    const companyId = row['Company ID']?.trim();
    const companyName = row['Company Name']?.trim();
    
    // Index is 0-based, but source.row is 1-based (header = row 1, first data = row 2)
    const rowNumber = index + 2; // +2 because: index 0 = row 2 (after header)
    
    if (companyId) {
      csvMapById.set(companyId.toLowerCase(), row);
    }
    if (companyName) {
      csvMapByName.set(companyName.toLowerCase(), row);
    }
    csvRowsByIndex.set(rowNumber, row);
  });

  // Load LLM cache if using LLM
  const llmCachePath = path.join(__dirname, '../data/processed/llm_funding_cache.json');
  if (useLLM) {
    loadLLMCache(llmCachePath);
  }

  // Process each company
  const qaEntries: FundingQAEntry[] = [];
  const companyRoundsMap = new Map<string, FundingRoundData[]>(); // companyId -> rounds
  const unresolvedItems: Array<{ companyId: string; companyName: string; sourceColumn: string; rawCell: string }> = [];

  for (const company of v1Companies) {
    // Try multiple matching strategies:
    // 1. Match by source.row number (most reliable)
    let csvRow: CSVRow | undefined;
    if (company.source?.row) {
      csvRow = csvRowsByIndex.get(company.source.row);
    }
    
    // 2. Fallback: match by Company ID
    if (!csvRow) {
      // Try to find Company ID in CSV that might match
      csvRow = csvMapById.get(company.id.toLowerCase());
    }
    
    // 3. Fallback: match by Company Name
    if (!csvRow) {
      csvRow = csvMapByName.get(company.name.toLowerCase());
    }
    
    if (!csvRow) {
      console.warn(`[Funding] No CSV row found for company ${company.id} (${company.name}) - source.row: ${company.source?.row}`);
      continue;
    }

    const companyRounds: FundingRoundData[] = [];

    // Process each funding column
    for (const column of FUNDING_COLUMNS) {
      const cellValue = csvRow[column] || '';
      const parseResult = parseFundingCell(column, cellValue);

      // Collect rounds for this company
      for (const round of parseResult.rounds) {
        // Validate valuation if present
        if (round.valuationUsd !== undefined) {
          const validation = validateValuation(round.valuationUsd);
          if (!validation.valid) {
            round.confidence = 'low';
            round.notes = `${round.notes}; ${validation.reason}`;
            console.warn(`[Funding] Suspicious valuation for ${company.name} - ${column}: ${validation.reason}`);
          }
        }

        companyRounds.push(round);
      }

      // Track QA entries for non-OK statuses
      if (parseResult.parseStatus !== 'OK') {
        qaEntries.push({
          companyId: company.id,
          companyName: company.name,
          sourceColumn: column,
          rawCell: cellValue,
          parseStatus: parseResult.parseStatus,
          reason: parseResult.notes,
          parsedRounds: parseResult.rounds,
          llmAssisted: false,
        });

        // Add to unresolved items for LLM assist
        if (useLLM && (parseResult.parseStatus === 'PARTIAL' || parseResult.parseStatus === 'FAILED') && cellValue.trim() && cellValue.toUpperCase() !== 'N/A') {
          unresolvedItems.push({
            companyId: company.id,
            companyName: company.name,
            sourceColumn: column,
            rawCell: cellValue,
          });
        }
      }
    }

    companyRoundsMap.set(company.id, companyRounds);
  }

  // Process unresolved items with LLM (in batches)
  if (useLLM && unresolvedItems.length > 0) {
    console.log(`[Funding] Processing ${unresolvedItems.length} unresolved items with LLM...`);
    
    const batchSize = 25;
    for (let i = 0; i < unresolvedItems.length; i += batchSize) {
      const batch = unresolvedItems.slice(i, i + batchSize);
      const llmResults = await processBatchWithLLM(batch);

      // Update QA entries and company rounds with LLM results
      for (const item of batch) {
        // Use same hash function as llm_funding_assist
        const { createHash: createHashFunc } = require('crypto');
        const cacheKey = createHashFunc('sha256')
          .update(`${item.companyId}|${item.sourceColumn}|${item.rawCell}`)
          .digest('hex');
        
        const llmRounds = llmResults.get(cacheKey);
        if (llmRounds && llmRounds.length > 0) {
          // Find corresponding QA entry
          const qaEntry = qaEntries.find(
            e => e.companyId === item.companyId && e.sourceColumn === item.sourceColumn
          );
          if (qaEntry) {
            qaEntry.llmAssisted = true;
            qaEntry.parsedRounds = llmRounds;
            qaEntry.parseStatus = llmRounds[0].valuationUsd || llmRounds[0].time ? 'PARTIAL' : 'FAILED';
          }

          // Add LLM rounds to company's rounds
          const companyRounds = companyRoundsMap.get(item.companyId) || [];
          companyRounds.push(...llmRounds);
          companyRoundsMap.set(item.companyId, companyRounds);
        }
      }
    }

    // Save LLM cache
    saveLLMCache(llmCachePath);
  }

  // Add funding rounds to companies
  const companiesWithFunding = v1Companies.map(company => {
    const companyRounds = companyRoundsMap.get(company.id) || [];
    return {
      ...company,
      fundingRounds: companyRounds,
    };
  });

  // Build funding index (flattened time series)
  const fundingIndex: FundingIndexEntry[] = [];
  for (const [companyId, rounds] of Array.from(companyRoundsMap.entries())) {
    const company = v1Companies.find(c => c.id === companyId);
    if (!company) continue;

    for (const round of rounds) {
      if (round.valuationUsd && round.time) {
        fundingIndex.push({
          companyId: company.id,
          companyName: company.name,
          round: round.round,
          valuationUsd: round.valuationUsd,
          time: round.time,
          confidence: round.confidence,
          sourceColumn: round.sourceColumn,
        });
      }
    }
  }

  // Sort index by time
  fundingIndex.sort((a, b) => {
    const [aMonth, aYear] = a.time.split('/').map(Number);
    const [bMonth, bYear] = b.time.split('/').map(Number);
    if (aYear !== bYear) return aYear - bYear;
    return aMonth - bMonth;
  });

  // Generate outputs
  const version = 'v2';
  const timestamp = new Date().toISOString();

  // 1. v2 companies JSON
  const v2Path = path.join(__dirname, '../data/processed/private_companies.v2.json');
  fs.writeFileSync(v2Path, JSON.stringify(companiesWithFunding, null, 2));
  console.log(`[Funding] Wrote v2 companies to ${v2Path}`);

  // 2. Funding index
  const indexPath = path.join(__dirname, '../data/processed/private_companies.v2.funding_index.json');
  const index: FundingIndex = {
    generatedAt: timestamp,
    version,
    entries: fundingIndex,
  };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`[Funding] Wrote funding index to ${indexPath}`);

  // 3. QA report
  const qaReport: FundingQAReport = {
    generatedAt: timestamp,
    version,
    totalRows: v1Companies.length * FUNDING_COLUMNS.length,
    okCount: v1Companies.length * FUNDING_COLUMNS.length - qaEntries.length,
    partialCount: qaEntries.filter(e => e.parseStatus === 'PARTIAL').length,
    failedCount: qaEntries.filter(e => e.parseStatus === 'FAILED').length,
    llmAssistedCount: qaEntries.filter(e => e.llmAssisted).length,
    entries: qaEntries,
    summary: {
      withMoneyRaised: 0,
      withTargetValuations: 0,
      withYearOnlyDates: 0,
      roundsByStage: {},
    },
  };
  const qaPath = path.join(__dirname, '../data/processed/private_companies.v2.qa.json');
  fs.writeFileSync(qaPath, JSON.stringify(qaReport, null, 2));
  console.log(`[Funding] Wrote QA report to ${qaPath}`);

  // Calculate total rounds
  const totalRounds = Array.from(companyRoundsMap.values()).reduce((sum, rounds) => sum + rounds.length, 0);

  // Summary
  console.log('\n[Funding Normalization] Summary:');
  console.log(`  Total companies: ${v1Companies.length}`);
  console.log(`  Total funding rounds extracted: ${totalRounds}`);
  console.log(`  Funding index entries: ${fundingIndex.length}`);
  console.log(`  OK parses: ${qaReport.okCount}`);
  console.log(`  PARTIAL parses: ${qaReport.partialCount}`);
  console.log(`  FAILED parses: ${qaReport.failedCount}`);
  console.log(`  LLM assisted: ${qaReport.llmAssistedCount}`);
  console.log('\n[Funding Normalization] Complete!');
}

// Main execution
if (require.main === module) {
  const useLLM = process.argv.includes('--use-llm=true');
  normalizeFunding(useLLM).catch(error => {
    console.error('[Funding Normalization] Error:', error);
    process.exit(1);
  });
}

export { normalizeFunding };

