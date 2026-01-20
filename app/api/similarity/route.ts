import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { buildConfidenceMeta } from '@/utils/confidence';
import type { PrivateCompany } from '@/types/companies';

export const runtime = 'nodejs';

// Cache for company data
let companiesCache: PrivateCompany[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 300000; // 5 minutes

// Similarity weights
const SIMILARITY_WEIGHTS = {
  tags: 0.40,
  region: 0.20,
  fundingStage: 0.25,
  description: 0.15,
};

// Funding stage mapping for comparison
const FUNDING_STAGES: Record<string, number> = {
  'pre-seed': 1,
  'seed': 2,
  'series-a': 3,
  'series-a1': 3,
  'series-a2': 3,
  'series-b': 4,
  'series-b1': 4,
  'series-b2': 4,
  'series-c': 5,
  'series-c1': 5,
  'series-c2': 5,
  'series-d': 6,
  'series-e': 7,
  'unknown': 0,
};

async function loadCompanies(): Promise<PrivateCompany[]> {
  const now = Date.now();
  if (companiesCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return companiesCache;
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'private_companies.v2.json');
  const data = await fs.readFile(filePath, 'utf-8');
  companiesCache = JSON.parse(data) as PrivateCompany[];
  cacheTimestamp = now;
  return companiesCache;
}

// Jaccard similarity for tag sets
function computeTagSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) return 0;

  const setA = new Set(tagsA.map(t => t.toLowerCase()));
  const setB = new Set(tagsB.map(t => t.toLowerCase()));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// Region similarity (same region = 1, same country = 0.5, else 0)
function computeRegionSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const cityA = (companyA.city || '').toLowerCase();
  const cityB = (companyB.city || '').toLowerCase();
  const countryA = (companyA.country || '').toLowerCase();
  const countryB = (companyB.country || '').toLowerCase();
  const regionA = (companyA.region || '').toLowerCase();
  const regionB = (companyB.region || '').toLowerCase();

  if (cityA && cityB && cityA === cityB) return 1.0;
  if (regionA && regionB && regionA === regionB) return 0.8;
  if (countryA && countryB && countryA === countryB) return 0.5;
  return 0;
}

// Funding stage similarity
function computeFundingStageSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const getLatestStage = (company: PrivateCompany): number => {
    if (!company.fundingRounds || company.fundingRounds.length === 0) return 0;
    const stages = company.fundingRounds.map(r => FUNDING_STAGES[r.round] || 0);
    return Math.max(...stages);
  };

  const stageA = getLatestStage(companyA);
  const stageB = getLatestStage(companyB);

  if (stageA === 0 || stageB === 0) return 0.3; // Unknown stage

  const diff = Math.abs(stageA - stageB);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.4;
  return 0.2;
}

// Simple description keyword similarity
function computeDescriptionSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const extractKeywords = (desc: string): Set<string> => {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
    const words = (desc || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    return new Set(words);
  };

  const keywordsA = extractKeywords(companyA.description || '');
  const keywordsB = extractKeywords(companyB.description || '');

  if (keywordsA.size === 0 && keywordsB.size === 0) return 0;

  const intersection = new Set([...keywordsA].filter(x => keywordsB.has(x)));
  const union = new Set([...keywordsA, ...keywordsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// Compute overall similarity between two companies
function computeSimilarity(companyA: PrivateCompany, companyB: PrivateCompany): number {
  const tagSim = computeTagSimilarity(companyA.tags || [], companyB.tags || []);
  const regionSim = computeRegionSimilarity(companyA, companyB);
  const fundingSim = computeFundingStageSimilarity(companyA, companyB);
  const descSim = computeDescriptionSimilarity(companyA, companyB);

  const similarity =
    tagSim * SIMILARITY_WEIGHTS.tags +
    regionSim * SIMILARITY_WEIGHTS.region +
    fundingSim * SIMILARITY_WEIGHTS.fundingStage +
    descSim * SIMILARITY_WEIGHTS.description;

  return Math.round(similarity * 100) / 100;
}

// Extract shared traits between two companies
function extractSharedTraits(companyA: PrivateCompany, companyB: PrivateCompany): string[] {
  const traits: string[] = [];
  const tagsA = new Set((companyA.tags || []).map(t => t.toLowerCase()));
  const tagsB = new Set((companyB.tags || []).map(t => t.toLowerCase()));

  // Shared tags
  const sharedTags = [...tagsA].filter(t => tagsB.has(t));
  traits.push(...sharedTags.slice(0, 3));

  // Same region/country
  if (companyA.country && companyB.country && companyA.country.toLowerCase() === companyB.country.toLowerCase()) {
    traits.push(companyA.country + '-based');
  }

  // Same funding stage
  const getLatestRound = (company: PrivateCompany): string | null => {
    if (!company.fundingRounds || company.fundingRounds.length === 0) return null;
    const sorted = [...company.fundingRounds].sort((a, b) => (FUNDING_STAGES[b.round] || 0) - (FUNDING_STAGES[a.round] || 0));
    return sorted[0].round;
  };

  const roundA = getLatestRound(companyA);
  const roundB = getLatestRound(companyB);
  if (roundA && roundB && roundA === roundB) {
    traits.push(roundA.replace('-', ' ').toUpperCase() + ' stage');
  } else if (roundA && roundB) {
    const stageA = FUNDING_STAGES[roundA] || 0;
    const stageB = FUNDING_STAGES[roundB] || 0;
    if (Math.abs(stageA - stageB) <= 1) {
      traits.push('Similar funding stage');
    }
  }

  return traits.slice(0, 4);
}

// Extract key differences between two companies
function extractDifferences(companyA: PrivateCompany, companyB: PrivateCompany): string[] {
  const differences: string[] = [];

  // Funding stage difference
  const getLatestStage = (company: PrivateCompany): { round: string; stage: number } | null => {
    if (!company.fundingRounds || company.fundingRounds.length === 0) return null;
    const sorted = [...company.fundingRounds].sort((a, b) => (FUNDING_STAGES[b.round] || 0) - (FUNDING_STAGES[a.round] || 0));
    return { round: sorted[0].round, stage: FUNDING_STAGES[sorted[0].round] || 0 };
  };

  const stageA = getLatestStage(companyA);
  const stageB = getLatestStage(companyB);

  if (stageA && stageB && Math.abs(stageA.stage - stageB.stage) >= 2) {
    if (stageB.stage < stageA.stage) {
      differences.push('Earlier stage');
    } else {
      differences.push('Later stage');
    }
  }

  // Region difference
  if (companyA.country && companyB.country && companyA.country.toLowerCase() !== companyB.country.toLowerCase()) {
    differences.push('Different region (' + companyB.country + ')');
  }

  // Unique tags in B (not in A)
  const tagsA = new Set((companyA.tags || []).map(t => t.toLowerCase()));
  const tagsB = (companyB.tags || []).filter(t => !tagsA.has(t.toLowerCase()));
  if (tagsB.length > 0) {
    differences.push('Focus: ' + tagsB.slice(0, 2).join(', '));
  }

  // Valuation difference
  const getMaxValuation = (company: PrivateCompany): number => {
    if (!company.fundingRounds) return 0;
    const vals = company.fundingRounds.filter(r => r.valuationUsd).map(r => r.valuationUsd || 0);
    return vals.length > 0 ? Math.max(...vals) : 0;
  };

  const valA = getMaxValuation(companyA);
  const valB = getMaxValuation(companyB);
  if (valA > 0 && valB > 0) {
    if (valB < valA * 0.3) {
      differences.push('Lower valuation');
    } else if (valB > valA * 3) {
      differences.push('Higher valuation');
    }
  }

  return differences.slice(0, 3);
}

// Find similar companies
function findSimilarCompanies(
  sourceCompany: PrivateCompany,
  allCompanies: PrivateCompany[],
  limit: number = 5
): Array<{
  id: string;
  name: string;
  similarity: number;
  sharedTraits: string[];
  differences: string[];
}> {
  const similarities = allCompanies
    .filter(c => c.id !== sourceCompany.id) // Exclude source company
    .map(company => ({
      id: company.id,
      name: company.name,
      similarity: computeSimilarity(sourceCompany, company),
      sharedTraits: extractSharedTraits(sourceCompany, company),
      differences: extractDifferences(sourceCompany, company),
    }))
    .filter(s => s.similarity > 0.1) // Minimum similarity threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return similarities;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');
  const limit = parseInt(searchParams.get('limit') || '5');

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Missing companyId parameter' },
      { status: 400 }
    );
  }

  try {
    const companies = await loadCompanies();

    // Find source company by ID or name
    const sourceCompany = companies.find(
      c => c.id === companyId || c.name.toLowerCase() === companyId.toLowerCase()
    );

    if (!sourceCompany) {
      return NextResponse.json(
        { ok: false, error: 'Company not found', companyId },
        { status: 404 }
      );
    }

    // Find similar companies
    const similarCompanies = findSimilarCompanies(sourceCompany, companies, Math.min(limit, 10));

    const result = {
      sourceCompany: {
        id: sourceCompany.id,
        name: sourceCompany.name,
      },
      similar: similarCompanies,
      _meta: buildConfidenceMeta(
        { sourceCompany: sourceCompany.id, similarCount: similarCompanies.length, totalCompanies: companies.length },
        'Similarity Engine'
      ),
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[Similarity API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to compute similarity',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
