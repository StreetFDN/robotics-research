/**
 * Similarity computation utilities for the Robotics Intelligence Globe
 *
 * Computes similarity between companies based on tags, region,
 * funding stage, and technology focus.
 */

import {
  SimilarCompany,
  SimilarityResult,
  SimilarityWeights,
  DEFAULT_SIMILARITY_WEIGHTS,
} from '@/types/similarity';
import type { PrivateCompany } from '@/types/companies';
import type { FundingRound } from '@/types/funding';

/**
 * Funding stage groups for similarity comparison
 */
const FUNDING_STAGE_GROUPS: Record<string, FundingRound[]> = {
  early: ['pre-seed', 'seed'],
  growth: ['series-a', 'series-a1', 'series-a2', 'series-b', 'series-b1', 'series-b2'],
  late: ['series-c', 'series-c1', 'series-c2', 'series-d', 'series-e'],
};

/**
 * Region groups for geographic similarity
 */
const REGION_GROUPS: Record<string, string[]> = {
  'north-america': ['US', 'USA', 'United States', 'Canada', 'CA'],
  'europe': ['UK', 'United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Sweden', 'Denmark', 'Norway', 'Finland', 'Spain', 'Italy'],
  'asia-pacific': ['China', 'Japan', 'South Korea', 'Singapore', 'Australia', 'India', 'Taiwan'],
  'other': [],
};

/**
 * Get funding stage group for a company
 */
function getFundingStageGroup(company: PrivateCompany): string {
  const rounds = company.fundingRounds || [];
  if (rounds.length === 0) return 'unknown';

  // Get latest round
  const stages = rounds.map(r => r.round);

  for (const [group, groupStages] of Object.entries(FUNDING_STAGE_GROUPS)) {
    if (stages.some(s => groupStages.includes(s))) {
      // Return the highest group found
      if (group === 'late') return 'late';
      if (group === 'growth' && !stages.some(s => FUNDING_STAGE_GROUPS.late.includes(s))) return 'growth';
    }
  }

  if (stages.some(s => FUNDING_STAGE_GROUPS.early.includes(s))) return 'early';
  return 'unknown';
}

/**
 * Get region group for a company
 */
function getRegionGroup(company: PrivateCompany): string {
  const country = company.country || '';

  for (const [group, countries] of Object.entries(REGION_GROUPS)) {
    if (countries.some(c => c.toLowerCase() === country.toLowerCase())) {
      return group;
    }
  }

  return 'other';
}

/**
 * Compute Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Normalize a tag for comparison (lowercase, trim, standardize)
 */
function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[-_]/g, ' ');
}

/**
 * Compute tag-based similarity between two companies
 */
function computeTagSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const tagsA = new Set((companyA.tags || []).map(normalizeTag));
  const tagsB = new Set((companyB.tags || []).map(normalizeTag));

  return jaccardSimilarity(tagsA, tagsB);
}

/**
 * Compute region-based similarity between two companies
 */
function computeRegionSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  // Same country = 1.0
  if (companyA.country && companyB.country &&
      companyA.country.toLowerCase() === companyB.country.toLowerCase()) {
    return 1.0;
  }

  // Same region group = 0.6
  const regionA = getRegionGroup(companyA);
  const regionB = getRegionGroup(companyB);
  if (regionA === regionB && regionA !== 'other') {
    return 0.6;
  }

  return 0.0;
}

/**
 * Compute funding stage similarity between two companies
 */
function computeFundingStageSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const stageA = getFundingStageGroup(companyA);
  const stageB = getFundingStageGroup(companyB);

  if (stageA === 'unknown' || stageB === 'unknown') {
    return 0.3; // Neutral when data missing
  }

  if (stageA === stageB) {
    return 1.0;
  }

  // Adjacent stages get partial similarity
  const stageOrder = ['early', 'growth', 'late'];
  const indexA = stageOrder.indexOf(stageA);
  const indexB = stageOrder.indexOf(stageB);

  if (Math.abs(indexA - indexB) === 1) {
    return 0.5;
  }

  return 0.0;
}

/**
 * Compute focus similarity based on description keywords
 */
function computeFocusSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const descA = (companyA.description || '').toLowerCase();
  const descB = (companyB.description || '').toLowerCase();

  if (!descA || !descB) return 0.3; // Neutral when missing

  // Extract significant words (5+ chars, excluding common words)
  const stopWords = new Set(['their', 'which', 'about', 'these', 'would', 'there', 'being', 'other', 'company', 'companies']);
  const extractWords = (text: string): Set<string> => {
    const words = text.match(/\b[a-z]{5,}\b/g) || [];
    return new Set(words.filter(w => !stopWords.has(w)));
  };

  const wordsA = extractWords(descA);
  const wordsB = extractWords(descB);

  return jaccardSimilarity(wordsA, wordsB);
}

/**
 * Compute overall similarity between two companies
 *
 * @param companyA - First company
 * @param companyB - Second company
 * @param weights - Optional custom weights
 * @returns Similarity score from 0 to 1
 */
export function computeSimilarity(
  companyA: PrivateCompany,
  companyB: PrivateCompany,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS
): number {
  // Handle edge case: same company
  if (companyA.id === companyB.id) {
    return 1.0;
  }

  // Handle null/undefined
  if (!companyA || !companyB) {
    return 0;
  }

  const tagSim = computeTagSimilarity(companyA, companyB);
  const regionSim = computeRegionSimilarity(companyA, companyB);
  const stageSim = computeFundingStageSimilarity(companyA, companyB);
  const focusSim = computeFocusSimilarity(companyA, companyB);

  const weightedSum =
    tagSim * weights.tags +
    regionSim * weights.region +
    stageSim * weights.fundingStage +
    focusSim * weights.focus;

  const totalWeight = weights.tags + weights.region + weights.fundingStage + weights.focus;

  const similarity = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Round to 2 decimal places
  return Math.round(similarity * 100) / 100;
}

/**
 * Extract traits shared between two companies
 *
 * @param companyA - First company
 * @param companyB - Second company
 * @returns Array of shared trait strings
 */
export function extractSharedTraits(companyA: PrivateCompany, companyB: PrivateCompany): string[] {
  const traits: string[] = [];

  // Shared tags
  const tagsA = new Set((companyA.tags || []).map(normalizeTag));
  const tagsB = new Set((companyB.tags || []).map(normalizeTag));
  const sharedTags = [...tagsA].filter(t => tagsB.has(t));
  traits.push(...sharedTags.slice(0, 3));

  // Same region
  if (companyA.country && companyB.country &&
      companyA.country.toLowerCase() === companyB.country.toLowerCase()) {
    traits.push(`${companyA.country}-based`);
  } else {
    const regionA = getRegionGroup(companyA);
    const regionB = getRegionGroup(companyB);
    if (regionA === regionB && regionA !== 'other') {
      traits.push(`${regionA.replace('-', ' ')} region`);
    }
  }

  // Same funding stage
  const stageA = getFundingStageGroup(companyA);
  const stageB = getFundingStageGroup(companyB);
  if (stageA === stageB && stageA !== 'unknown') {
    traits.push(`${stageA}-stage`);
  }

  return [...new Set(traits)]; // Deduplicate
}

/**
 * Extract key differences between two companies
 *
 * @param companyA - Source company
 * @param companyB - Comparison company
 * @returns Array of difference descriptions
 */
export function extractDifferences(companyA: PrivateCompany, companyB: PrivateCompany): string[] {
  const differences: string[] = [];

  // Different funding stages
  const stageA = getFundingStageGroup(companyA);
  const stageB = getFundingStageGroup(companyB);
  if (stageA !== stageB && stageA !== 'unknown' && stageB !== 'unknown') {
    const stageLabels: Record<string, string> = {
      early: 'Earlier stage',
      growth: 'Growth stage',
      late: 'Later stage',
    };
    const stageOrder = ['early', 'growth', 'late'];
    const comparison = stageOrder.indexOf(stageB) < stageOrder.indexOf(stageA)
      ? 'Earlier stage'
      : 'Later stage';
    differences.push(comparison);
  }

  // Different regions
  const regionA = getRegionGroup(companyA);
  const regionB = getRegionGroup(companyB);
  if (regionA !== regionB) {
    differences.push(`Different region (${regionB.replace('-', ' ')})`);
  }

  // Unique tags in companyB
  const tagsA = new Set((companyA.tags || []).map(normalizeTag));
  const tagsB = new Set((companyB.tags || []).map(normalizeTag));
  const uniqueTagsB = [...tagsB].filter(t => !tagsA.has(t));
  if (uniqueTagsB.length > 0) {
    differences.push(`Focus: ${uniqueTagsB.slice(0, 2).join(', ')}`);
  }

  return differences.slice(0, 3); // Limit to 3 differences
}

/**
 * Find companies most similar to a given company
 *
 * @param company - The source company
 * @param allCompanies - Array of all companies to compare against
 * @param limit - Maximum number of results (default: 5)
 * @param weights - Optional custom similarity weights
 * @returns Array of similar companies with scores and explanations
 */
export function findSimilarCompanies(
  company: PrivateCompany,
  allCompanies: PrivateCompany[],
  limit: number = 5,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS
): SimilarCompany[] {
  if (!company || !allCompanies || allCompanies.length === 0) {
    return [];
  }

  // Compute similarity for all other companies
  const similarities: Array<{ company: PrivateCompany; similarity: number }> = [];

  for (const other of allCompanies) {
    // Skip self
    if (other.id === company.id) continue;

    const similarity = computeSimilarity(company, other, weights);
    if (similarity > 0.1) { // Minimum threshold
      similarities.push({ company: other, similarity });
    }
  }

  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Take top N and build result objects
  return similarities.slice(0, limit).map(({ company: other, similarity }) => ({
    id: other.id,
    name: other.name,
    similarity,
    sharedTraits: extractSharedTraits(company, other),
    differences: extractDifferences(company, other),
  }));
}

/**
 * Build complete similarity result for a company
 *
 * @param company - The source company
 * @param allCompanies - Array of all companies
 * @param limit - Maximum similar companies to return
 * @returns Complete SimilarityResult object
 */
export function buildSimilarityResult(
  company: PrivateCompany,
  allCompanies: PrivateCompany[],
  limit: number = 5
): SimilarityResult {
  return {
    sourceCompany: company.id,
    similar: findSimilarCompanies(company, allCompanies, limit),
  };
}
