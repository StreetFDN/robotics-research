/**
 * ETL script for processing private_companies.csv into canonical JSON format
 * 
 * Outputs:
 * - data/processed/private_companies.v1.json (processed companies)
 * - data/processed/private_companies.v1.summary.json (dataset statistics)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createHash } from 'crypto';
import type { PrivateCompany, DatasetSummary, QAReport, QAMerge, QACoordFix, QACoordIssue, QALowConfidenceCoords } from '../types/companies';
import { geocodeCompany, finalizeGeocoding, type GeocoderProvider } from './geocode';

interface CSVRow {
  'Company Name': string;
  'Brief Description': string;
  'Company ID': string;
  'Founder Name': string;
  'Geolocation': string;
  'Last Valuation': string;
  'Location City': string;
  'Notable Investors': string;
  [key: string]: string;
}

// Common robotics tags/keywords to extract
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

// Country/region mappings for normalization
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
  'estonia': 'Estonia',
  'norway': 'Norway',
  'portugal': 'Portugal',
  'netherlands': 'Netherlands',
  'japan': 'Japan',
};

// UK city mappings (cities that indicate UK location)
const UK_CITIES: string[] = [
  'london', 'manchester', 'birmingham', 'glasgow', 'edinburgh', 'liverpool',
  'bristol', 'sheffield', 'leeds', 'cardiff', 'belfast', 'newcastle',
  'nottingham', 'southampton', 'portsmouth', 'cambridge', 'oxford',
  'bath', 'york', 'brighton', 'norwich', 'plymouth', 'swansea',
  'reading', 'middlesbrough', 'preston', 'blackpool', 'coventry',
  'leicester', 'sunderland', 'ipswich', 'bournemouth', 'peterborough',
  'bolton', 'stoke-on-trent', 'wolverhampton', 'derby', 'southend-on-sea',
  'northampton', 'dudley', 'luton', 'colchester', 'eastbourne',
  'southport', 'canterbury', 'blackburn', 'watford', 'burnley',
  'yarmouth', 'worcester', 'rochdale', 'solihull', 'maidstone',
  'whitehaven', 'aberdeen', 'inverness', 'dundee', 'perth', 'dumfries',
];

// US state to region mappings
const US_REGION_MAPPINGS: Record<string, string> = {
  'california': 'West',
  'oregon': 'West',
  'washington': 'West',
  'nevada': 'West',
  'arizona': 'West',
  'colorado': 'West',
  'utah': 'West',
  'idaho': 'West',
  'montana': 'West',
  'wyoming': 'West',
  'new mexico': 'West',
  'alaska': 'West',
  'hawaii': 'West',
  'texas': 'South',
  'florida': 'South',
  'georgia': 'South',
  'north carolina': 'South',
  'south carolina': 'South',
  'virginia': 'South',
  'tennessee': 'South',
  'louisiana': 'South',
  'alabama': 'South',
  'mississippi': 'South',
  'arkansas': 'South',
  'oklahoma': 'South',
  'kentucky': 'South',
  'west virginia': 'South',
  'maryland': 'South',
  'delaware': 'South',
  'new york': 'Northeast',
  'massachusetts': 'Northeast',
  'pennsylvania': 'Northeast',
  'new jersey': 'Northeast',
  'connecticut': 'Northeast',
  'rhode island': 'Northeast',
  'vermont': 'Northeast',
  'new hampshire': 'Northeast',
  'maine': 'Northeast',
  'illinois': 'Midwest',
  'ohio': 'Midwest',
  'michigan': 'Midwest',
  'wisconsin': 'Midwest',
  'minnesota': 'Midwest',
  'iowa': 'Midwest',
  'missouri': 'Midwest',
  'indiana': 'Midwest',
  'kansas': 'Midwest',
  'nebraska': 'Midwest',
  'north dakota': 'Midwest',
  'south dakota': 'Midwest',
};

/**
 * Normalize string: trim, lowercase (for comparison), preserve original for output
 */
function normalizeString(str: string | undefined): string {
  if (!str) return '';
  return str.trim();
}

/**
 * Extract and parse coordinates from various formats
 */
function parseCoordinates(geolocation: string): { lat: number; lon: number; confidence: 'high' | 'med' | 'low'; source: string } | null {
  if (!geolocation || !geolocation.trim()) {
    return null;
  }

  // Remove degree symbols and other formatting
  const cleaned = geolocation.replace(/[°'"NSWE]/gi, '').trim();
  
  // Try pattern: "lat, lon" or "lat,lon"
  const commaMatch = cleaned.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1]);
    const lon = parseFloat(commaMatch[2]);
    if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        lat,
        lon,
        confidence: 'high',
        source: 'geolocation_field'
      };
    }
  }

  // Try space-separated: "lat lon"
  const spaceMatch = cleaned.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
  if (spaceMatch) {
    const lat = parseFloat(spaceMatch[1]);
    const lon = parseFloat(spaceMatch[2]);
    if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        lat,
        lon,
        confidence: 'med',
        source: 'geolocation_field_parsed'
      };
    }
  }

  return null;
}

// US state abbreviations mapping
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  'ca': 'california',
  'calif': 'california',
  'or': 'oregon',
  'wa': 'washington',
  'ny': 'new york',
  'ma': 'massachusetts',
  'tx': 'texas',
  'fl': 'florida',
  'pa': 'pennsylvania',
  'co': 'colorado',
  'nc': 'north carolina',
  'ga': 'georgia',
  'mi': 'michigan',
  'oh': 'ohio',
  'il': 'illinois',
  'nj': 'new jersey',
  'va': 'virginia',
  'az': 'arizona',
  'tn': 'tennessee',
  'in': 'indiana',
  'mo': 'missouri',
  'md': 'maryland',
  'wi': 'wisconsin',
  'mn': 'minnesota',
  'ct': 'connecticut',
  'sc': 'south carolina',
  'al': 'alabama',
  'la': 'louisiana',
  'ky': 'kentucky',
  'ok': 'oklahoma',
  'ut': 'utah',
  'ia': 'iowa',
  'nv': 'nevada',
  'ar': 'arkansas',
  'ms': 'mississippi',
  'ks': 'kansas',
  'nm': 'new mexico',
  'ne': 'nebraska',
  'wv': 'west virginia',
  'id': 'idaho',
  'hi': 'hawaii',
  'nh': 'new hampshire',
  'me': 'maine',
  'mt': 'montana',
  'ri': 'rhode island',
  'de': 'delaware',
  'sd': 'south dakota',
  'nd': 'north dakota',
  'ak': 'alaska',
  'dc': 'district of columbia',
  'vt': 'vermont',
  'wy': 'wyoming',
};

/**
 * Extract country, city, region from Location City field
 */
function parseLocation(locationCity: string): { country?: string; region?: string; city?: string } {
  if (!locationCity || !locationCity.trim()) {
    return {};
  }

  const normalized = normalizeString(locationCity).toLowerCase();
  const result: { country?: string; region?: string; city?: string } = {};

  // First check for explicit country mentions
  let countryFound = false;
  for (const [key, country] of Object.entries(COUNTRY_MAPPINGS)) {
    if (normalized.includes(key)) {
      result.country = country;
      countryFound = true;
      
      // If US, try to extract state and region
      if (country === 'United States') {
        for (const [state, region] of Object.entries(US_REGION_MAPPINGS)) {
          if (normalized.includes(state)) {
            result.region = region;
            break;
          }
        }
      }
      break;
    }
  }

  // If no country found, check for US states (full names and abbreviations)
  if (!countryFound) {
    // Check for full state names
    for (const [state, region] of Object.entries(US_REGION_MAPPINGS)) {
      if (normalized.includes(state)) {
        result.country = 'United States';
        result.region = region;
        countryFound = true;
        break;
      }
    }
    
    // Check for state abbreviations (CA, OR, etc.)
    if (!countryFound) {
      for (const [abbr, stateFull] of Object.entries(US_STATE_ABBREVIATIONS)) {
        // Match abbreviations followed by comma, end of string, or space
        const abbrPattern = new RegExp(`\\b${abbr}\\.?\\b(?:,|$|\\s)`, 'i');
        if (abbrPattern.test(locationCity)) {
          result.country = 'United States';
          result.region = US_REGION_MAPPINGS[stateFull];
          countryFound = true;
          break;
        }
      }
    }
    
    // Also check for common US location indicators
    if (!countryFound && (normalized.includes('silicon valley') || normalized.includes('bay area'))) {
      result.country = 'United States';
      result.region = 'West';
      countryFound = true;
    }
    
    // Check for UK cities
    if (!countryFound) {
      for (const ukCity of UK_CITIES) {
        if (normalized.includes(ukCity)) {
          result.country = 'United Kingdom';
          countryFound = true;
          break;
        }
      }
    }
  }

  // Extract city (usually first part before comma or parentheses)
  const cityMatch = locationCity.match(/^([^,(]+?)(?:\s*\(|,|$)/);
  if (cityMatch) {
    result.city = normalizeString(cityMatch[1]);
  }

  return result;
}

/**
 * Extract website URL from description or other fields
 */
function extractWebsite(description: string, companyId: string): string | undefined {
  // Look for http(s) URLs
  const urlMatch = description?.match(/https?:\/\/(?:www\.)?([^\s\/\)]+)/i);
  if (urlMatch) {
    return urlMatch[0];
  }
  
  // Could infer from company ID, but better to leave undefined if not found
  return undefined;
}

/**
 * Generate deterministic ID from name and website
 */
function generateId(name: string, website?: string): string {
  const normalizedName = normalizeString(name).toLowerCase();
  const domain = website ? new URL(website).hostname.replace(/^www\./, '') : '';
  const combined = `${normalizedName}|${domain}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Build aliases from name, website, and description
 */
function buildAliases(name: string, website?: string, description?: string): string[] {
  const aliases = new Set<string>();
  
  // Add original name
  const normalizedName = normalizeString(name);
  if (normalizedName) {
    aliases.add(normalizedName);
  }
  
  // Add stripped punctuation version
  const stripped = normalizedName.replace(/[.,\-_]/g, '').trim();
  if (stripped && stripped !== normalizedName) {
    aliases.add(stripped);
  }
  
  // Add lowercase version
  aliases.add(normalizedName.toLowerCase());
  
  // Extract domain name tokens from website
  if (website) {
    try {
      const hostname = new URL(website).hostname.replace(/^www\./, '');
      const domainParts = hostname.split('.');
      if (domainParts.length > 0) {
        aliases.add(domainParts[0]); // e.g., "figure" from "figure.ai"
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  // Extract company/product names from description (basic heuristic)
  if (description) {
    // Look for capitalized words/phrases that might be product names
    const productMatches = description.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
    if (productMatches) {
      productMatches.slice(0, 3).forEach(match => {
        if (match.length > 2 && match.length < 30 && !match.includes('Company') && !match.includes('Founder')) {
          aliases.add(match);
        }
      });
    }
  }
  
  return Array.from(aliases).filter(Boolean);
}

/**
 * Extract tags from description
 */
function extractTags(description: string): string[] {
  if (!description) return [];
  
  const normalized = description.toLowerCase();
  const tags = new Set<string>();
  
  for (const keyword of TAG_KEYWORDS) {
    if (normalized.includes(keyword.toLowerCase())) {
      tags.add(keyword.toLowerCase());
    }
  }
  
  return Array.from(tags).sort();
}

/**
 * Deduplicate companies by ID, merging records
 */
function deduplicateCompanies(companies: PrivateCompany[]): { companies: PrivateCompany[]; merges: QAMerge[] } {
  const mergedMap = new Map<string, PrivateCompany[]>();
  const merges: QAMerge[] = [];

  // Group companies by ID
  for (const company of companies) {
    if (!mergedMap.has(company.id)) {
      mergedMap.set(company.id, []);
    }
    mergedMap.get(company.id)!.push(company);
  }

  const deduplicated: PrivateCompany[] = [];

  for (const [id, duplicates] of mergedMap.entries()) {
    if (duplicates.length === 1) {
      deduplicated.push(duplicates[0]);
    } else {
      // Merge duplicates
      const merge = mergeCompanies(duplicates);
      deduplicated.push(merge.merged);
      merges.push(merge.mergeRecord);
    }
  }

  return { companies: deduplicated, merges };
}

/**
 * Merge multiple company records into one
 */
function mergeCompanies(companies: PrivateCompany[]): { merged: PrivateCompany; mergeRecord: QAMerge } {
  // Keep the first one as base
  const base = { ...companies[0] };

  // Find best description (longer)
  let bestDescription = base.description || '';
  for (const company of companies.slice(1)) {
    if (company.description && company.description.length > bestDescription.length) {
      bestDescription = company.description;
    }
  }

  // Union tags and aliases
  const allTags = new Set<string>(base.tags || []);
  const allAliases = new Set<string>(base.aliases || []);
  const sourceRows: number[] = [base.source.row];

  for (const company of companies.slice(1)) {
    (company.tags || []).forEach(tag => allTags.add(tag));
    (company.aliases || []).forEach(alias => allAliases.add(alias));
    sourceRows.push(company.source.row);
  }

  // Find best HQ (highest confidence, non-zero coords preferred)
  let bestHQ = base.hq;
  const hqConfidenceScore = { high: 3, med: 2, low: 1 };
  
  for (const company of companies.slice(1)) {
    const currentScore = hqConfidenceScore[company.hq.confidence];
    const bestScore = hqConfidenceScore[bestHQ.confidence];
    const currentHasCoords = company.hq.lat !== 0 || company.hq.lon !== 0;
    const bestHasCoords = bestHQ.lat !== 0 || bestHQ.lon !== 0;

    if (currentScore > bestScore || (currentScore === bestScore && currentHasCoords && !bestHasCoords)) {
      bestHQ = company.hq;
    }
  }

  const merged: PrivateCompany = {
    ...base,
    description: bestDescription || undefined,
    tags: Array.from(allTags).sort(),
    aliases: Array.from(allAliases).sort(),
    hq: bestHQ,
    lastUpdated: new Date().toISOString(),
  };

  const mergeRecord: QAMerge = {
    id: base.id,
    mergedRecords: companies.length,
    keptDescription: bestDescription,
    mergedTags: Array.from(allTags).sort(),
    mergedAliases: Array.from(allAliases).sort(),
    keptHQ: bestHQ,
    sourceRows: sourceRows.sort((a, b) => a - b),
  };

  return { merged, mergeRecord };
}

/**
 * Check if a string looks like a street address
 */
function looksLikeStreetAddress(str: string): boolean {
  if (!str) return false;
  const normalized = str.trim();
  
  // Patterns that indicate street addresses
  const addressPatterns = [
    /\d+\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Pl|Place|Ct|Court)/i,
    /\d+[A-Z]?\s+[A-Z][a-z]+/i, // "123 Main" or "123A Main"
    /Suite\s+\d+/i,
    /Unit\s+\d+/i,
    /#\d+/,
    /PO Box/i,
    /P\.?O\.?\s*Box/i,
  ];

  return addressPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Normalize city field - move street addresses to hq.rawAddress
 */
function normalizeCity(company: PrivateCompany): PrivateCompany {
  if (!company.city || !looksLikeStreetAddress(company.city)) {
    return company;
  }

  const updated = { ...company };
  updated.hq = {
    ...updated.hq,
    rawAddress: company.city,
  };
  updated.city = undefined;
  
  return updated;
}

/**
 * Fix impossible coordinates
 */
function fixCoordinates(companies: PrivateCompany[]): { companies: PrivateCompany[]; fixes: QACoordFix[]; missing: QACoordIssue[]; suspicious: QACoordIssue[] } {
  const fixes: QACoordFix[] = [];
  const missing: QACoordIssue[] = [];
  const suspicious: QACoordIssue[] = [];
  const fixed: PrivateCompany[] = [];

  for (const company of companies) {
    let updated = { ...company };
    let wasFixed = false;

    // Check if lat=0 AND lon=0 (treat as missing)
    if (company.hq.lat === 0 && company.hq.lon === 0) {
      missing.push({
        id: company.id,
        name: company.name,
        lat: 0,
        lon: 0,
        country: company.country,
        issue: 'lat=0 and lon=0 (treated as missing)',
      });
      // Keep as is, will be handled later
      fixed.push(updated);
      continue;
    }

    // Check for US/Canada with positive longitude (should be negative)
    if ((company.country === 'United States' || company.country === 'Canada') && company.hq.lon > 0 && company.hq.lon < 180) {
      const before = { lat: company.hq.lat, lon: company.hq.lon };
      updated.hq = {
        ...updated.hq,
        lon: -company.hq.lon,
        source: 'qa_fix_lon_sign',
      };
      fixes.push({
        id: company.id,
        name: company.name,
        before,
        after: { lat: updated.hq.lat, lon: updated.hq.lon },
        reason: `US/Canada location with positive longitude, flipped to negative`,
      });
      wasFixed = true;
    }

    // Check for coordinates out of bounds (use updated coordinates if fixed)
    const checkLat = updated.hq.lat;
    const checkLon = updated.hq.lon;
    if (checkLat < -90 || checkLat > 90 || checkLon < -180 || checkLon > 180) {
      suspicious.push({
        id: company.id,
        name: company.name,
        lat: checkLat,
        lon: checkLon,
        country: company.country,
        issue: `Coordinates out of bounds (lat: ${checkLat}, lon: ${checkLon})`,
      });
    }

    fixed.push(updated);
  }

  return { companies: fixed, fixes, missing, suspicious };
}

/**
 * Enrich companies with geocoding
 */
async function enrichWithGeocoding(companies: PrivateCompany[]): Promise<{ companies: PrivateCompany[]; lowConfidenceCoords: QALowConfidenceCoords[] }> {
  console.log('Enriching with geocoding...');
  
  // Get geocoder config from environment
  const provider = (process.env.GEOCODER_PROVIDER || 'nominatim') as GeocoderProvider;
  const apiKey = process.env.GEOCODER_API_KEY;
  
  console.log(`  Using provider: ${provider}`);
  if (provider !== 'nominatim' && !apiKey) {
    console.warn(`  Warning: API key not provided for ${provider}, geocoding will fail`);
  }
  
  const enriched: PrivateCompany[] = [];
  const lowConfidenceCoords: QALowConfidenceCoords[] = [];
  
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    
    // Only geocode if we don't have valid coordinates (0,0 treated as missing in QA cleanup)
    const needsGeocoding = company.hq.lat === 0 && company.hq.lon === 0;
    
    if (needsGeocoding) {
      const geocodeInput = {
        address: company.hq.rawAddress,
        city: company.city,
        region: company.region,
        country: company.country,
        existingLat: company.hq.lat !== 0 || company.hq.lon !== 0 ? company.hq.lat : undefined,
        existingLon: company.hq.lat !== 0 || company.hq.lon !== 0 ? company.hq.lon : undefined,
      };
      
      try {
        const geocodeResult = await geocodeCompany(geocodeInput, provider, apiKey);
        
        if (geocodeResult) {
          // Update HQ with geocoded result
          const updated = {
            ...company,
            hq: {
              ...company.hq,
              lat: geocodeResult.lat,
              lon: geocodeResult.lon,
              confidence: geocodeResult.confidence,
              source: geocodeResult.source,
            },
          };
          enriched.push(updated);
          
          // Track low confidence coords for QA report
          if (geocodeResult.confidence === 'low') {
            lowConfidenceCoords.push({
              id: company.id,
              name: company.name,
              lat: geocodeResult.lat,
              lon: geocodeResult.lon,
              confidence: 'low',
              source: geocodeResult.source,
              country: company.country,
              city: company.city,
              reason: `Geocoded with ${geocodeResult.confidence} confidence (${geocodeResult.source})`,
            });
          }
        } else {
          // No geocode result, keep original
          enriched.push(company);
          
          // Track missing coords
          if (company.hq.lat === 0 && company.hq.lon === 0) {
            lowConfidenceCoords.push({
              id: company.id,
              name: company.name,
              lat: 0,
              lon: 0,
              confidence: 'low',
              source: company.hq.source,
              country: company.country,
              city: company.city,
              reason: 'Geocoding failed or no location data available',
            });
          }
        }
      } catch (error) {
        console.warn(`Geocoding failed for ${company.name}:`, error instanceof Error ? error.message : error);
        enriched.push(company);
        
        if (company.hq.lat === 0 && company.hq.lon === 0) {
          lowConfidenceCoords.push({
            id: company.id,
            name: company.name,
            lat: 0,
            lon: 0,
            confidence: 'low',
            source: company.hq.source,
            country: company.country,
            city: company.city,
            reason: `Geocoding error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } else {
      // Already has coordinates, keep as is
      enriched.push(company);
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`    Processed ${i + 1}/${companies.length} companies...`);
    }
  }
  
  // Finalize geocoding (save cache)
  finalizeGeocoding();
  
  console.log(`    Geocoded ${lowConfidenceCoords.length} companies with low confidence or missing coords`);
  
  return { companies: enriched, lowConfidenceCoords };
}

/**
 * Apply QA cleanup to companies
 */
function applyQACleanup(companies: PrivateCompany[]): { companies: PrivateCompany[]; qaReport: QAReport } {
  console.log('Applying QA cleanup...');

  // Step 1: Deduplicate
  console.log('  Step 1: Deduplicating...');
  const { companies: deduplicated, merges } = deduplicateCompanies(companies);
  console.log(`    Merged ${merges.length} duplicate groups`);

  // Step 2: Normalize city fields
  console.log('  Step 2: Normalizing city fields...');
  const cityNormalized = deduplicated.map(company => normalizeCity(company));
  const cityFixesCount = cityNormalized.filter((c, i) => c.city !== deduplicated[i].city).length;
  console.log(`    Fixed ${cityFixesCount} city fields that looked like addresses`);

  // Step 3: Fix coordinates
  console.log('  Step 3: Fixing coordinates...');
  const { companies: coordFixed, fixes, missing, suspicious } = fixCoordinates(cityNormalized);
  console.log(`    Fixed ${fixes.length} coordinate issues`);
  console.log(`    Found ${missing.length} missing coordinates`);
  console.log(`    Found ${suspicious.length} suspicious coordinates`);

  // Generate QA report (without geocoding data yet)
  const qaReport: QAReport = {
    generatedAt: new Date().toISOString(),
    version: '1.0',
    duplicatesMerged: merges,
    coordsFixed: fixes,
    coordsMissing: missing,
    suspiciousCoords: suspicious,
    lowConfidenceCoords: [], // Will be populated after geocoding
    summary: {
      totalMerges: merges.length,
      totalCoordsFixed: fixes.length,
      totalCoordsMissing: missing.length,
      totalSuspiciousCoords: suspicious.length,
      totalLowConfidenceCoords: 0, // Will be updated after geocoding
    },
  };

  return { companies: coordFixed, qaReport };
}

/**
 * Main ETL function
 */
async function main() {
  const inputPath = path.join(__dirname, '../data/raw/private_companies.csv');
  const outputDir = path.join(__dirname, '../data/processed');
  const outputPath = path.join(outputDir, 'private_companies.v1.json');
  const summaryPath = path.join(outputDir, 'private_companies.v1.summary.json');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read and parse CSV
  console.log('Reading CSV file...');
  let csvContent = fs.readFileSync(inputPath, 'utf-8');
  
  // Remove BOM (Byte Order Mark) if present
  if (csvContent.charCodeAt(0) === 0xFEFF) {
    csvContent = csvContent.slice(1);
  }
  
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Loaded ${records.length} rows`);

  const companies: PrivateCompany[] = [];
  const seenIds = new Set<string>();
  let duplicatesDetected = 0;
  let withHQCoords = 0;
  const missingFields = {
    name: 0,
    country: 0,
    city: 0,
    hq: 0,
  };

  // Process each row
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // +2 because CSV is 1-indexed and has header

    const name = normalizeString(row['Company Name']);
    if (!name) {
      missingFields.name++;
      continue;
    }

    const description = normalizeString(row['Brief Description']);
    const website = extractWebsite(description, row['Company ID']);
    const id = generateId(name, website);

    // Check for duplicates
    if (seenIds.has(id)) {
      duplicatesDetected++;
      console.warn(`Duplicate ID detected at row ${rowNum}: ${name} (ID: ${id})`);
    }
    seenIds.add(id);

    // Parse coordinates
    let hqCoords = parseCoordinates(row['Geolocation']);
    if (hqCoords) {
      withHQCoords++;
    } else {
      missingFields.hq++;
      // Use default coordinates if not available (with low confidence)
      hqCoords = {
        lat: 0,
        lon: 0,
        confidence: 'low',
        source: 'default'
      };
    }

    // Parse location
    const location = parseLocation(row['Location City']);
    if (!location.country) {
      missingFields.country++;
    }
    if (!location.city) {
      missingFields.city++;
    }

    // Build company object
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

    companies.push(company);
  }

  // Apply QA cleanup
  const { companies: cleanedCompanies, qaReport: qaReportPreGeocode } = applyQACleanup(companies);

  // Enrich with geocoding
  const { companies: geocodedCompanies, lowConfidenceCoords } = await enrichWithGeocoding(cleanedCompanies);

  // Update QA report with geocoding results
  const qaReport: QAReport = {
    ...qaReportPreGeocode,
    lowConfidenceCoords,
    summary: {
      ...qaReportPreGeocode.summary,
      totalLowConfidenceCoords: lowConfidenceCoords.length,
    },
  };

  // Sort by name
  geocodedCompanies.sort((a, b) => a.name.localeCompare(b.name));

  // Generate summary (using geocoded companies)
  const geocodedWithCoords = geocodedCompanies.filter(c => c.hq.lat !== 0 || c.hq.lon !== 0).length;
  const summary: DatasetSummary = {
    totalRows: records.length,
    duplicatesDetected: qaReport.summary.totalMerges,
    withHQCoords: geocodedWithCoords,
    withHQCoordsPercent: geocodedCompanies.length > 0 ? Math.round((geocodedWithCoords / geocodedCompanies.length) * 100 * 100) / 100 : 0,
    missingCriticalFields: {
      name: missingFields.name,
      country: geocodedCompanies.filter(c => !c.country).length,
      city: geocodedCompanies.filter(c => !c.city).length,
      hq: geocodedCompanies.filter(c => c.hq.lat === 0 && c.hq.lon === 0).length,
    },
    generatedAt: new Date().toISOString(),
    version: '1.0',
  };

  // Write output files
  const qaPath = path.join(outputDir, 'private_companies.v1.qa.json');
  console.log('Writing output files...');
  fs.writeFileSync(outputPath, JSON.stringify(geocodedCompanies, null, 2), 'utf-8');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  fs.writeFileSync(qaPath, JSON.stringify(qaReport, null, 2), 'utf-8');

  console.log('\n✓ Processing complete!');
  console.log(`  - Processed ${geocodedCompanies.length} companies (after deduplication)`);
  console.log(`  - Output: ${outputPath}`);
  console.log(`  - Summary: ${summaryPath}`);
  console.log(`  - QA Report: ${qaPath}`);
  console.log(`\nSummary:`);
  console.log(`  - Total rows: ${summary.totalRows}`);
  console.log(`  - Duplicates merged: ${summary.duplicatesDetected}`);
  console.log(`  - With HQ coordinates: ${summary.withHQCoords} (${summary.withHQCoordsPercent}%)`);
  console.log(`  - Missing fields:`);
  console.log(`    - Name: ${summary.missingCriticalFields.name}`);
  console.log(`    - Country: ${summary.missingCriticalFields.country}`);
  console.log(`    - City: ${summary.missingCriticalFields.city}`);
  console.log(`    - HQ: ${summary.missingCriticalFields.hq}`);
  console.log(`\nQA Report:`);
  console.log(`  - Merges: ${qaReport.summary.totalMerges}`);
  console.log(`  - Coordinates fixed: ${qaReport.summary.totalCoordsFixed}`);
  console.log(`  - Coordinates missing: ${qaReport.summary.totalCoordsMissing}`);
  console.log(`  - Suspicious coordinates: ${qaReport.summary.totalSuspiciousCoords}`);
  console.log(`  - Low confidence/missing coords: ${qaReport.summary.totalLowConfidenceCoords}`);
}

// Run if executed directly
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

export { main };

