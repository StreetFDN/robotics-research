/**
 * Validation script for private_companies.v1.json dataset
 * 
 * Enforces data quality rules and fails if thresholds are exceeded
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PrivateCompany } from '../types/companies';

interface ValidationConfig {
  maxMissingCountryPercent: number; // Default: 30%
  maxMissingCityPercent: number; // Default: 40%
  maxMissingHQPercent: number; // Default: 50%
  strictMode: boolean; // If true, fail on any validation error
}

const DEFAULT_CONFIG: ValidationConfig = {
  maxMissingCountryPercent: 30,
  maxMissingCityPercent: 40,
  maxMissingHQPercent: 50,
  strictMode: false,
};

interface ValidationErrors {
  idNotUnique: string[];
  emptyName: string[];
  invalidCoordinates: string[];
  invalidTags: string[];
  missingCountry: string[];
  missingCity: string[];
  missingHQ: string[];
}

interface ValidationStats {
  total: number;
  errors: ValidationErrors;
  missingCountryPercent: number;
  missingCityPercent: number;
  missingHQPercent: number;
  passed: boolean;
}

/**
 * Validate a single company
 */
function validateCompany(company: PrivateCompany, allIds: Set<string>): string[] {
  const errors: string[] = [];

  // Check ID uniqueness
  if (allIds.has(company.id)) {
    errors.push(`duplicate_id`);
  }
  allIds.add(company.id);

  // Check name is non-empty
  if (!company.name || !company.name.trim()) {
    errors.push(`empty_name`);
  }

  // Check coordinates if present
  if (company.hq.lat !== undefined && company.hq.lon !== undefined) {
    const lat = company.hq.lat;
    const lon = company.hq.lon;

    if (!isFinite(lat) || !isFinite(lon)) {
      errors.push(`invalid_coordinates_non_finite`);
    } else if (lat < -90 || lat > 90) {
      errors.push(`invalid_coordinates_lat_out_of_bounds`);
    } else if (lon < -180 || lon > 180) {
      errors.push(`invalid_coordinates_lon_out_of_bounds`);
    }
  } else {
    errors.push(`missing_hq`);
  }

  // Check tags are lowercased
  for (const tag of company.tags) {
    if (tag !== tag.toLowerCase()) {
      errors.push(`invalid_tags_not_lowercased`);
      break;
    }
  }

  return errors;
}

/**
 * Validate entire dataset
 */
function validateDataset(companies: PrivateCompany[], config: ValidationConfig): ValidationStats {
  const errors: ValidationErrors = {
    idNotUnique: [],
    emptyName: [],
    invalidCoordinates: [],
    invalidTags: [],
    missingCountry: [],
    missingCity: [],
    missingHQ: [],
  };

  const seenIds = new Set<string>();
  let missingCountryCount = 0;
  let missingCityCount = 0;
  let missingHQCount = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const companyErrors = validateCompany(company, seenIds);

    // Categorize errors
    if (companyErrors.includes('duplicate_id')) {
      errors.idNotUnique.push(`${company.id} (row ${i + 1})`);
    }
    if (companyErrors.includes('empty_name')) {
      errors.emptyName.push(`${company.id} (row ${i + 1})`);
    }
    if (companyErrors.some(e => e.startsWith('invalid_coordinates'))) {
      errors.invalidCoordinates.push(`${company.id} (row ${i + 1})`);
    }
    if (companyErrors.includes('invalid_tags_not_lowercased')) {
      errors.invalidTags.push(`${company.id} (row ${i + 1})`);
    }
    if (companyErrors.includes('missing_hq') || company.hq.confidence === 'low' || (company.hq.lat === 0 && company.hq.lon === 0)) {
      missingHQCount++;
      errors.missingHQ.push(`${company.id} (row ${i + 1})`);
    }

    // Track missing fields
    if (!company.country) {
      missingCountryCount++;
      errors.missingCountry.push(`${company.id} (row ${i + 1})`);
    }
    if (!company.city) {
      missingCityCount++;
      errors.missingCity.push(`${company.id} (row ${i + 1})`);
    }
  }

  const total = companies.length;
  const missingCountryPercent = total > 0 ? (missingCountryCount / total) * 100 : 0;
  const missingCityPercent = total > 0 ? (missingCityCount / total) * 100 : 0;
  const missingHQPercent = total > 0 ? (missingHQCount / total) * 100 : 0;

  // Determine if validation passed
  let passed = true;
  const failures: string[] = [];

  if (errors.idNotUnique.length > 0) {
    passed = false;
    failures.push(`${errors.idNotUnique.length} duplicate IDs`);
  }
  if (errors.emptyName.length > 0) {
    passed = false;
    failures.push(`${errors.emptyName.length} empty names`);
  }
  if (errors.invalidCoordinates.length > 0) {
    passed = false;
    failures.push(`${errors.invalidCoordinates.length} invalid coordinates`);
  }
  if (errors.invalidTags.length > 0) {
    passed = false;
    failures.push(`${errors.invalidTags.length} non-lowercased tags`);
  }
  if (missingCountryPercent > config.maxMissingCountryPercent) {
    passed = false;
    failures.push(`${missingCountryPercent.toFixed(1)}% missing country (threshold: ${config.maxMissingCountryPercent}%)`);
  }
  if (missingCityPercent > config.maxMissingCityPercent) {
    passed = false;
    failures.push(`${missingCityPercent.toFixed(1)}% missing city (threshold: ${config.maxMissingCityPercent}%)`);
  }
  if (missingHQPercent > config.maxMissingHQPercent) {
    passed = false;
    failures.push(`${missingHQPercent.toFixed(1)}% missing HQ (threshold: ${config.maxMissingHQPercent}%)`);
  }

  return {
    total,
    errors,
    missingCountryPercent,
    missingCityPercent,
    missingHQPercent,
    passed,
  };
}

/**
 * Main validation function
 */
async function main() {
  const datasetPath = path.join(__dirname, '../data/processed/private_companies.v1.json');
  const config: ValidationConfig = { ...DEFAULT_CONFIG };

  // Parse command-line arguments for config
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-missing-country' && i + 1 < args.length) {
      config.maxMissingCountryPercent = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--max-missing-city' && i + 1 < args.length) {
      config.maxMissingCityPercent = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--max-missing-hq' && i + 1 < args.length) {
      config.maxMissingHQPercent = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--strict') {
      config.strictMode = true;
    }
  }

  console.log('Validating dataset...');
  console.log(`Config:`, config);
  console.log(`Dataset: ${datasetPath}\n`);

  // Check if file exists
  if (!fs.existsSync(datasetPath)) {
    console.error(`Error: Dataset file not found: ${datasetPath}`);
    console.error('Please run build_private_companies_dataset.ts first.');
    process.exit(1);
  }

  // Load dataset
  const jsonContent = fs.readFileSync(datasetPath, 'utf-8');
  const companies: PrivateCompany[] = JSON.parse(jsonContent);

  console.log(`Loaded ${companies.length} companies\n`);

  // Validate
  const stats = validateDataset(companies, config);

  // Print results
  console.log('Validation Results:');
  console.log('='.repeat(50));
  console.log(`Total companies: ${stats.total}`);
  console.log(`\nError counts:`);
  console.log(`  - Duplicate IDs: ${stats.errors.idNotUnique.length}`);
  console.log(`  - Empty names: ${stats.errors.emptyName.length}`);
  console.log(`  - Invalid coordinates: ${stats.errors.invalidCoordinates.length}`);
  console.log(`  - Non-lowercased tags: ${stats.errors.invalidTags.length}`);
  console.log(`\nMissing fields:`);
  console.log(`  - Country: ${stats.missingCountryPercent.toFixed(1)}% (${stats.errors.missingCountry.length}/${stats.total})`);
  console.log(`  - City: ${stats.missingCityPercent.toFixed(1)}% (${stats.errors.missingCity.length}/${stats.total})`);
  console.log(`  - HQ coordinates: ${stats.missingHQPercent.toFixed(1)}% (${stats.errors.missingHQ.length}/${stats.total})`);

  // Print detailed errors if any
  if (stats.errors.idNotUnique.length > 0) {
    console.log(`\nDuplicate IDs:`);
    stats.errors.idNotUnique.slice(0, 10).forEach(id => console.log(`  - ${id}`));
    if (stats.errors.idNotUnique.length > 10) {
      console.log(`  ... and ${stats.errors.idNotUnique.length - 10} more`);
    }
  }

  if (stats.errors.emptyName.length > 0) {
    console.log(`\nEmpty names:`);
    stats.errors.emptyName.slice(0, 10).forEach(id => console.log(`  - ${id}`));
  }

  if (stats.errors.invalidCoordinates.length > 0) {
    console.log(`\nInvalid coordinates:`);
    stats.errors.invalidCoordinates.slice(0, 10).forEach(id => console.log(`  - ${id}`));
  }

  if (stats.errors.invalidTags.length > 0) {
    console.log(`\nNon-lowercased tags:`);
    stats.errors.invalidTags.slice(0, 10).forEach(id => console.log(`  - ${id}`));
  }

  console.log('\n' + '='.repeat(50));
  
  // Collect failures
  const failures: string[] = [];
  if (stats.errors.idNotUnique.length > 0) {
    failures.push(`${stats.errors.idNotUnique.length} duplicate IDs`);
  }
  if (stats.errors.emptyName.length > 0) {
    failures.push(`${stats.errors.emptyName.length} empty names`);
  }
  if (stats.errors.invalidCoordinates.length > 0) {
    failures.push(`${stats.errors.invalidCoordinates.length} invalid coordinates`);
  }
  if (stats.errors.invalidTags.length > 0) {
    failures.push(`${stats.errors.invalidTags.length} non-lowercased tags`);
  }
  if (stats.missingCountryPercent > config.maxMissingCountryPercent) {
    failures.push(`${stats.missingCountryPercent.toFixed(1)}% missing country (threshold: ${config.maxMissingCountryPercent}%)`);
  }
  if (stats.missingCityPercent > config.maxMissingCityPercent) {
    failures.push(`${stats.missingCityPercent.toFixed(1)}% missing city (threshold: ${config.maxMissingCityPercent}%)`);
  }
  if (stats.missingHQPercent > config.maxMissingHQPercent) {
    failures.push(`${stats.missingHQPercent.toFixed(1)}% missing HQ (threshold: ${config.maxMissingHQPercent}%)`);
  }
  
  if (stats.passed) {
    console.log('✓ Validation PASSED');
    process.exit(0);
  } else {
    console.log('✗ Validation FAILED');
    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach(failure => console.log(`  - ${failure}`));
    }
    process.exit(1);
  }
}

// Run if executed directly
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

export { main, validateDataset };

