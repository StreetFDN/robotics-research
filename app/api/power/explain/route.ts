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

// Power factor weights
const FACTOR_WEIGHTS = {
  funding: 0.30,
  technology: 0.25,
  talent: 0.20,
  marketPosition: 0.15,
  strategicBacking: 0.10,
};

// Tag-based technology scores
const TECH_SCORES: Record<string, number> = {
  humanoid: 95,
  bipedal: 90,
  dexterous: 88,
  autonomous: 85,
  mobile: 80,
  industrial: 75,
  warehouse: 70,
  drone: 65,
  agricultural: 60,
  household: 55,
  consumer: 50,
};

// Market position indicators
const MARKET_INDICATORS: Record<string, number> = {
  logistics: 85,
  warehouse: 80,
  manufacturing: 75,
  healthcare: 85,
  defense: 90,
  space: 88,
  consumer: 70,
  enterprise: 75,
};

// Strategic backer keywords in description
const STRATEGIC_KEYWORDS = [
  { keyword: 'openai', score: 95 },
  { keyword: 'google', score: 90 },
  { keyword: 'amazon', score: 90 },
  { keyword: 'nvidia', score: 88 },
  { keyword: 'hyundai', score: 85 },
  { keyword: 'microsoft', score: 85 },
  { keyword: 'samsung', score: 80 },
  { keyword: 'toyota', score: 80 },
  { keyword: 'softbank', score: 78 },
  { keyword: 'sequoia', score: 75 },
  { keyword: 'a16z', score: 75 },
  { keyword: 'khosla', score: 72 },
];

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

function computeFundingScore(company: PrivateCompany): { score: number; explanation: string } {
  if (!company.fundingRounds || company.fundingRounds.length === 0) {
    return { score: 30, explanation: 'No disclosed funding data' };
  }

  // Get highest valuation
  const valuations = company.fundingRounds
    .filter(r => r.valuationUsd && r.valuationUsd > 0)
    .map(r => r.valuationUsd as number);

  if (valuations.length === 0) {
    const roundCount = company.fundingRounds.length;
    return { score: 40, explanation: roundCount + ' funding round(s), valuation undisclosed' };
  }

  const maxValuation = Math.max(...valuations);
  const roundCount = company.fundingRounds.length;

  // Score based on valuation tier
  let score: number;
  let tier: string;
  if (maxValuation >= 10_000_000_000) {
    score = 98;
    tier = '$' + (maxValuation / 1_000_000_000).toFixed(1) + 'B valuation';
  } else if (maxValuation >= 1_000_000_000) {
    score = 90 + (maxValuation / 10_000_000_000) * 8;
    tier = '$' + (maxValuation / 1_000_000_000).toFixed(2) + 'B valuation';
  } else if (maxValuation >= 500_000_000) {
    score = 80 + ((maxValuation - 500_000_000) / 500_000_000) * 10;
    tier = '$' + (maxValuation / 1_000_000).toFixed(0) + 'M valuation';
  } else if (maxValuation >= 100_000_000) {
    score = 60 + ((maxValuation - 100_000_000) / 400_000_000) * 20;
    tier = '$' + (maxValuation / 1_000_000).toFixed(0) + 'M valuation';
  } else {
    score = 30 + (maxValuation / 100_000_000) * 30;
    tier = '$' + (maxValuation / 1_000_000).toFixed(1) + 'M valuation';
  }

  return {
    score: Math.min(100, Math.round(score)),
    explanation: tier + ' across ' + roundCount + ' round' + (roundCount > 1 ? 's' : ''),
  };
}

function computeTechnologyScore(company: PrivateCompany): { score: number; explanation: string } {
  const tags = company.tags || [];
  if (tags.length === 0) {
    return { score: 50, explanation: 'Technology focus unclear' };
  }

  // Get highest tech score from tags
  let maxScore = 0;
  let topTech = '';
  for (const tag of tags) {
    const score = TECH_SCORES[tag.toLowerCase()] || 0;
    if (score > maxScore) {
      maxScore = score;
      topTech = tag;
    }
  }

  // Boost for multiple advanced tags
  const advancedTags = tags.filter(t => (TECH_SCORES[t.toLowerCase()] || 0) >= 80);
  if (advancedTags.length > 1) {
    maxScore = Math.min(100, maxScore + advancedTags.length * 3);
  }

  if (maxScore === 0) {
    return { score: 50, explanation: 'Robotics technology (' + tags.join(', ') + ')' };
  }

  return {
    score: maxScore,
    explanation: topTech ? topTech.charAt(0).toUpperCase() + topTech.slice(1) + ' robotics specialist' : 'Technology: ' + tags.slice(0, 3).join(', '),
  };
}

function computeTalentScore(company: PrivateCompany): { score: number; explanation: string } {
  const desc = (company.description || '').toLowerCase();

  // Look for team size indicators
  const teamMatch = desc.match(/(\d+)\+?\s*(engineers?|employees?|team|people|staff)/i);
  const teamSize = teamMatch ? parseInt(teamMatch[1]) : 0;

  // Look for talent source indicators
  const eliteSources = ['mit', 'stanford', 'cmu', 'carnegie mellon', 'caltech', 'berkeley'];
  const hasEliteTalent = eliteSources.some(src => desc.includes(src));

  let score = 50; // baseline
  let explanation = 'Team composition unknown';

  if (teamSize > 0) {
    if (teamSize >= 500) {
      score = 90;
      explanation = teamSize + '+ team members';
    } else if (teamSize >= 200) {
      score = 80;
      explanation = teamSize + '+ team members';
    } else if (teamSize >= 50) {
      score = 65;
      explanation = teamSize + '+ team members';
    } else {
      score = 50;
      explanation = teamSize + '+ team members';
    }
  }

  if (hasEliteTalent) {
    score = Math.min(100, score + 10);
    explanation += ', elite university pipeline';
  }

  return { score, explanation };
}

function computeMarketPositionScore(company: PrivateCompany): { score: number; explanation: string } {
  const tags = company.tags || [];
  const desc = (company.description || '').toLowerCase();

  let maxScore = 50;
  const markets: string[] = [];

  for (const tag of tags) {
    const score = MARKET_INDICATORS[tag.toLowerCase()];
    if (score) {
      if (score > maxScore) {
        maxScore = score;
      }
      markets.push(tag);
    }
  }

  // Check for deployment indicators
  const deploymentIndicators = ['deployed', 'operational', 'commercial', 'production', 'customers'];
  const hasDeployment = deploymentIndicators.some(ind => desc.includes(ind));
  if (hasDeployment) {
    maxScore = Math.min(100, maxScore + 10);
  }

  if (markets.length === 0) {
    return { score: 50, explanation: 'Market position emerging' };
  }

  return {
    score: maxScore,
    explanation: 'Active in ' + markets.slice(0, 2).join(', ') + ' markets' + (hasDeployment ? ', deployed' : ''),
  };
}

function computeStrategicBackingScore(company: PrivateCompany): { score: number; explanation: string } {
  const desc = (company.description || '').toLowerCase();
  const name = (company.name || '').toLowerCase();
  const combined = desc + ' ' + name;

  let maxScore = 30;
  const backers: string[] = [];

  for (const { keyword, score } of STRATEGIC_KEYWORDS) {
    if (combined.includes(keyword)) {
      if (score > maxScore) {
        maxScore = score;
      }
      backers.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
    }
  }

  if (backers.length === 0) {
    return { score: 30, explanation: 'No major strategic backers identified' };
  }

  return {
    score: maxScore,
    explanation: 'Strategic backing: ' + backers.slice(0, 2).join(', '),
  };
}

function identifyTopContributors(company: PrivateCompany): string[] {
  const contributors: string[] = [];
  const desc = (company.description || '').toLowerCase();

  // Check for acquisitions
  if (desc.includes('acquisition') || desc.includes('acquired')) {
    contributors.push('Strategic acquisition/backing');
  }

  // Check for commercial success
  if (desc.includes('commercial') || desc.includes('customer') || desc.includes('deployed')) {
    contributors.push('Commercial deployments');
  }

  // Check for technology leadership
  if (desc.includes('leading') || desc.includes('first') || desc.includes('pioneer')) {
    contributors.push('Technology leadership');
  }

  // Check for manufacturing capability
  if (desc.includes('manufactur') || desc.includes('production') || desc.includes('facility')) {
    contributors.push('Manufacturing capability');
  }

  // Check for funding
  if (company.fundingRounds && company.fundingRounds.length > 0) {
    const maxVal = Math.max(...company.fundingRounds.filter(r => r.valuationUsd).map(r => r.valuationUsd || 0));
    if (maxVal >= 1_000_000_000) {
      contributors.push('Unicorn valuation');
    } else if (maxVal >= 100_000_000) {
      contributors.push('Strong funding base');
    }
  }

  return contributors.slice(0, 4);
}

function identifyVulnerabilities(company: PrivateCompany): string[] {
  const vulnerabilities: string[] = [];
  const desc = (company.description || '').toLowerCase();

  // Check funding confidence
  if (company.fundingRounds) {
    const lowConfidence = company.fundingRounds.filter(r => r.confidence === 'low');
    if (lowConfidence.length > company.fundingRounds.length / 2) {
      vulnerabilities.push('Funding data has low confidence');
    }
  }

  // Check for dependency indicators
  if (desc.includes('dependent') || desc.includes('reliance') || desc.includes('relies on')) {
    vulnerabilities.push('Strategic dependency risk');
  }

  // Check for early stage
  const earlyTags = ['seed', 'early', 'prototype', 'development'];
  if (earlyTags.some(tag => desc.includes(tag))) {
    vulnerabilities.push('Early stage, unproven at scale');
  }

  // Check for no commercial deployment
  if (!desc.includes('commercial') && !desc.includes('customer') && !desc.includes('deployed')) {
    vulnerabilities.push('No commercial deployments disclosed');
  }

  // Check HQ confidence
  if (company.hq?.confidence === 'low') {
    vulnerabilities.push('Location data uncertain');
  }

  return vulnerabilities.slice(0, 3);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const type = searchParams.get('type') || 'company';

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing id parameter' },
      { status: 400 }
    );
  }

  if (type !== 'company' && type !== 'region') {
    return NextResponse.json(
      { ok: false, error: 'Invalid type parameter. Must be "company" or "region"' },
      { status: 400 }
    );
  }

  try {
    const companies = await loadCompanies();

    if (type === 'company') {
      // Find company by ID or name
      const company = companies.find(
        c => c.id === id || c.name.toLowerCase() === id.toLowerCase()
      );

      if (!company) {
        return NextResponse.json(
          { ok: false, error: 'Company not found', id },
          { status: 404 }
        );
      }

      // Compute power factors
      const funding = computeFundingScore(company);
      const technology = computeTechnologyScore(company);
      const talent = computeTalentScore(company);
      const marketPosition = computeMarketPositionScore(company);
      const strategicBacking = computeStrategicBackingScore(company);

      // Compute overall power score (weighted average)
      const overallPower = Math.round(
        funding.score * FACTOR_WEIGHTS.funding +
        technology.score * FACTOR_WEIGHTS.technology +
        talent.score * FACTOR_WEIGHTS.talent +
        marketPosition.score * FACTOR_WEIGHTS.marketPosition +
        strategicBacking.score * FACTOR_WEIGHTS.strategicBacking
      );

      const result = {
        entityId: company.id,
        entityName: company.name,
        entityType: 'company',
        overallPower,
        factors: [
          { name: 'FUNDING STRENGTH', score: funding.score, explanation: funding.explanation, weight: FACTOR_WEIGHTS.funding },
          { name: 'TECHNOLOGY MOAT', score: technology.score, explanation: technology.explanation, weight: FACTOR_WEIGHTS.technology },
          { name: 'TALENT DENSITY', score: talent.score, explanation: talent.explanation, weight: FACTOR_WEIGHTS.talent },
          { name: 'MARKET POSITION', score: marketPosition.score, explanation: marketPosition.explanation, weight: FACTOR_WEIGHTS.marketPosition },
          { name: 'STRATEGIC BACKING', score: strategicBacking.score, explanation: strategicBacking.explanation, weight: FACTOR_WEIGHTS.strategicBacking },
        ],
        topContributors: identifyTopContributors(company),
        vulnerabilities: identifyVulnerabilities(company),
        _meta: buildConfidenceMeta(
          { entityId: company.id, factors: 5, funding, technology, talent, marketPosition, strategicBacking },
          'Power Analysis Engine'
        ),
      };

      return NextResponse.json({ ok: true, data: result });
    }

    // Region power analysis
    if (type === 'region') {
      const regionCompanies = companies.filter(
        c => c.region?.toLowerCase() === id.toLowerCase() ||
             c.country?.toLowerCase() === id.toLowerCase() ||
             c.city?.toLowerCase() === id.toLowerCase()
      );

      if (regionCompanies.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No companies found in region', id },
          { status: 404 }
        );
      }

      // Aggregate power scores for region
      const allFunding = regionCompanies.map(c => computeFundingScore(c).score);
      const allTech = regionCompanies.map(c => computeTechnologyScore(c).score);
      const allTalent = regionCompanies.map(c => computeTalentScore(c).score);
      const allMarket = regionCompanies.map(c => computeMarketPositionScore(c).score);
      const allStrategic = regionCompanies.map(c => computeStrategicBackingScore(c).score);

      const avgScore = (scores: number[]) => Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      const funding = { score: avgScore(allFunding), explanation: regionCompanies.length + ' companies analyzed' };
      const technology = { score: avgScore(allTech), explanation: 'Regional technology average' };
      const talent = { score: avgScore(allTalent), explanation: 'Regional talent pool' };
      const marketPosition = { score: avgScore(allMarket), explanation: 'Regional market presence' };
      const strategicBacking = { score: avgScore(allStrategic), explanation: 'Regional strategic investment' };

      const overallPower = Math.round(
        funding.score * FACTOR_WEIGHTS.funding +
        technology.score * FACTOR_WEIGHTS.technology +
        talent.score * FACTOR_WEIGHTS.talent +
        marketPosition.score * FACTOR_WEIGHTS.marketPosition +
        strategicBacking.score * FACTOR_WEIGHTS.strategicBacking
      );

      // Top companies in region
      const topCompanies = regionCompanies
        .map(c => ({ name: c.name, score: computeFundingScore(c).score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => c.name);

      const result = {
        entityId: id,
        entityName: id.charAt(0).toUpperCase() + id.slice(1),
        entityType: 'region',
        companyCount: regionCompanies.length,
        overallPower,
        factors: [
          { name: 'FUNDING STRENGTH', score: funding.score, explanation: funding.explanation, weight: FACTOR_WEIGHTS.funding },
          { name: 'TECHNOLOGY MOAT', score: technology.score, explanation: technology.explanation, weight: FACTOR_WEIGHTS.technology },
          { name: 'TALENT DENSITY', score: talent.score, explanation: talent.explanation, weight: FACTOR_WEIGHTS.talent },
          { name: 'MARKET POSITION', score: marketPosition.score, explanation: marketPosition.explanation, weight: FACTOR_WEIGHTS.marketPosition },
          { name: 'STRATEGIC BACKING', score: strategicBacking.score, explanation: strategicBacking.explanation, weight: FACTOR_WEIGHTS.strategicBacking },
        ],
        topContributors: topCompanies,
        vulnerabilities: [],
        _meta: buildConfidenceMeta(
          { entityId: id, companyCount: regionCompanies.length, factors: 5 },
          'Power Analysis Engine'
        ),
      };

      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json(
      { ok: false, error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Power Explain API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to compute power analysis',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
