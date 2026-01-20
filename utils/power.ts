/**
 * Power scoring utilities for the Robotics Intelligence Globe
 *
 * Computes power scores for companies based on funding, technology,
 * talent, market position, and strategic backing.
 */

import {
  PowerFactor,
  PowerExplanation,
  POWER_FACTOR_NAMES,
  POWER_FACTOR_WEIGHTS,
  PowerFactorName,
} from '@/types/power';
import type { PrivateCompany } from '@/types/companies';
import type { FundingRoundData, FundingRound } from '@/types/funding';

/**
 * Funding stage order for comparison (higher = later stage)
 */
const FUNDING_STAGE_ORDER: Record<FundingRound, number> = {
  'pre-seed': 1,
  'seed': 2,
  'series-a': 3,
  'series-a1': 3.5,
  'series-a2': 3.7,
  'series-b': 4,
  'series-b1': 4.5,
  'series-b2': 4.7,
  'series-c': 5,
  'series-c1': 5.5,
  'series-c2': 5.7,
  'series-d': 6,
  'series-e': 7,
  'unknown': 0,
};

/**
 * High-value technology tags that indicate technology moat
 */
const HIGH_VALUE_TECH_TAGS = [
  'humanoid',
  'autonomous',
  'ai',
  'machine-learning',
  'computer-vision',
  'manipulation',
  'locomotion',
  'navigation',
  'sensor-fusion',
];

/**
 * Tags indicating strong market position
 */
const MARKET_POSITION_TAGS = [
  'commercial',
  'enterprise',
  'deployed',
  'production',
  'revenue',
];

/**
 * Get total funding raised from funding rounds
 */
function getTotalFunding(rounds?: FundingRoundData[]): number {
  if (!rounds || rounds.length === 0) return 0;
  return rounds.reduce((sum, r) => sum + (r.moneyRaisedUsd || 0), 0);
}

/**
 * Get latest funding valuation
 */
function getLatestValuation(rounds?: FundingRoundData[]): number {
  if (!rounds || rounds.length === 0) return 0;
  const sorted = [...rounds].sort((a, b) =>
    (FUNDING_STAGE_ORDER[b.round] || 0) - (FUNDING_STAGE_ORDER[a.round] || 0)
  );
  return sorted[0]?.valuationUsd || 0;
}

/**
 * Get latest funding stage
 */
function getLatestStage(rounds?: FundingRoundData[]): FundingRound {
  if (!rounds || rounds.length === 0) return 'unknown';
  const sorted = [...rounds].sort((a, b) =>
    (FUNDING_STAGE_ORDER[b.round] || 0) - (FUNDING_STAGE_ORDER[a.round] || 0)
  );
  return sorted[0]?.round || 'unknown';
}

/**
 * Compute funding strength score (0-100)
 */
function computeFundingScore(company: PrivateCompany): { score: number; explanation: string } {
  const totalFunding = getTotalFunding(company.fundingRounds);
  const valuation = getLatestValuation(company.fundingRounds);
  const stage = getLatestStage(company.fundingRounds);
  const stageValue = FUNDING_STAGE_ORDER[stage] || 0;

  // Score components
  let score = 0;
  const explanationParts: string[] = [];

  // Funding amount score (0-40 points)
  if (totalFunding > 0) {
    const fundingScore = Math.min(40, Math.log10(totalFunding / 1_000_000) * 10);
    score += Math.max(0, fundingScore);
    explanationParts.push(`$${formatAmount(totalFunding)} raised`);
  }

  // Valuation score (0-30 points)
  if (valuation > 0) {
    const valuationScore = Math.min(30, Math.log10(valuation / 10_000_000) * 10);
    score += Math.max(0, valuationScore);
    explanationParts.push(`$${formatAmount(valuation)} valuation`);
  }

  // Stage score (0-30 points)
  score += Math.min(30, stageValue * 4);
  if (stage !== 'unknown') {
    explanationParts.push(`${stage.replace('-', ' ').toUpperCase()} stage`);
  }

  return {
    score: Math.round(Math.min(100, score)),
    explanation: explanationParts.length > 0
      ? explanationParts.join(', ')
      : 'Limited funding data available',
  };
}

/**
 * Compute technology moat score (0-100)
 */
function computeTechnologyScore(company: PrivateCompany): { score: number; explanation: string } {
  const tags = company.tags || [];
  const description = company.description || '';

  let score = 0;
  const explanationParts: string[] = [];

  // High-value tech tags (0-50 points)
  const techTags = tags.filter(t =>
    HIGH_VALUE_TECH_TAGS.some(ht => t.toLowerCase().includes(ht))
  );
  score += Math.min(50, techTags.length * 15);

  if (techTags.length > 0) {
    explanationParts.push(techTags.slice(0, 2).join(', ') + ' technology');
  }

  // Description depth (0-30 points) - longer descriptions suggest more developed tech
  if (description.length > 200) {
    score += 30;
    explanationParts.push('comprehensive technology stack');
  } else if (description.length > 100) {
    score += 20;
  } else if (description.length > 50) {
    score += 10;
  }

  // Tag diversity (0-20 points) - more tags suggest broader capabilities
  score += Math.min(20, tags.length * 3);

  return {
    score: Math.round(Math.min(100, score)),
    explanation: explanationParts.length > 0
      ? explanationParts.join(', ')
      : 'Technology profile under assessment',
  };
}

/**
 * Compute talent density score (0-100)
 * Note: Without team size data, we infer from funding and stage
 */
function computeTalentScore(company: PrivateCompany): { score: number; explanation: string } {
  const stage = getLatestStage(company.fundingRounds);
  const stageValue = FUNDING_STAGE_ORDER[stage] || 0;
  const totalFunding = getTotalFunding(company.fundingRounds);

  // Infer team size from funding stage
  let estimatedTeam = 0;
  let score = 0;

  if (stageValue >= 6) {
    estimatedTeam = 200;
    score = 85;
  } else if (stageValue >= 5) {
    estimatedTeam = 100;
    score = 70;
  } else if (stageValue >= 4) {
    estimatedTeam = 50;
    score = 55;
  } else if (stageValue >= 3) {
    estimatedTeam = 25;
    score = 40;
  } else if (stageValue >= 2) {
    estimatedTeam = 10;
    score = 25;
  } else {
    estimatedTeam = 5;
    score = 15;
  }

  // Boost for high funding per stage (indicates competitive hiring)
  if (totalFunding > 100_000_000 && stageValue < 5) {
    score = Math.min(100, score + 15);
  }

  return {
    score: Math.round(score),
    explanation: estimatedTeam > 0
      ? `~${estimatedTeam}+ estimated team size`
      : 'Team data unavailable',
  };
}

/**
 * Compute market position score (0-100)
 */
function computeMarketScore(company: PrivateCompany): { score: number; explanation: string } {
  const tags = company.tags || [];
  const description = (company.description || '').toLowerCase();

  let score = 30; // Base score
  const explanationParts: string[] = [];

  // Market position tags
  const marketTags = tags.filter(t =>
    MARKET_POSITION_TAGS.some(mt => t.toLowerCase().includes(mt))
  );
  score += Math.min(30, marketTags.length * 15);

  // Description signals
  if (description.includes('deployed') || description.includes('production')) {
    score += 20;
    explanationParts.push('products in production');
  }
  if (description.includes('customer') || description.includes('client')) {
    score += 10;
    explanationParts.push('active customer base');
  }
  if (description.includes('partner')) {
    score += 10;
    explanationParts.push('strategic partnerships');
  }

  return {
    score: Math.round(Math.min(100, score)),
    explanation: explanationParts.length > 0
      ? explanationParts.join(', ')
      : 'Market position developing',
  };
}

/**
 * Compute strategic backing score (0-100)
 */
function computeStrategicScore(company: PrivateCompany): { score: number; explanation: string } {
  const description = (company.description || '').toLowerCase();
  const tags = company.tags || [];
  const stage = getLatestStage(company.fundingRounds);

  let score = 20; // Base score
  const explanationParts: string[] = [];

  // Strategic keywords in description
  const strategicKeywords = ['acquired', 'acquisition', 'backed by', 'strategic', 'corporate'];
  for (const keyword of strategicKeywords) {
    if (description.includes(keyword)) {
      score += 15;
      explanationParts.push('strategic backing identified');
      break;
    }
  }

  // Late stage typically means strategic investors
  if (FUNDING_STAGE_ORDER[stage] >= 5) {
    score += 25;
    explanationParts.push('late-stage investor base');
  }

  // Defense/government related
  if (tags.some(t => ['defense', 'government', 'military'].includes(t.toLowerCase()))) {
    score += 20;
    explanationParts.push('government/defense sector');
  }

  return {
    score: Math.round(Math.min(100, score)),
    explanation: explanationParts.length > 0
      ? explanationParts.join(', ')
      : 'Strategic position under assessment',
  };
}

/**
 * Format large numbers for display
 */
function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toString();
}

/**
 * Compute overall power score for a company
 *
 * @param company - The company to analyze
 * @returns Power score from 0 to 100
 */
export function computePowerScore(company: PrivateCompany): number {
  const factors = explainPowerFactors(company);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    const weight = factor.weight || POWER_FACTOR_WEIGHTS[factor.name as PowerFactorName] || 0.2;
    weightedSum += factor.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Break down power into individual factors with explanations
 *
 * @param company - The company to analyze
 * @returns Array of power factors with scores and explanations
 */
export function explainPowerFactors(company: PrivateCompany): PowerFactor[] {
  const funding = computeFundingScore(company);
  const technology = computeTechnologyScore(company);
  const talent = computeTalentScore(company);
  const market = computeMarketScore(company);
  const strategic = computeStrategicScore(company);

  return [
    {
      name: POWER_FACTOR_NAMES.FUNDING,
      score: funding.score,
      explanation: funding.explanation,
      weight: POWER_FACTOR_WEIGHTS[POWER_FACTOR_NAMES.FUNDING],
    },
    {
      name: POWER_FACTOR_NAMES.TECHNOLOGY,
      score: technology.score,
      explanation: technology.explanation,
      weight: POWER_FACTOR_WEIGHTS[POWER_FACTOR_NAMES.TECHNOLOGY],
    },
    {
      name: POWER_FACTOR_NAMES.TALENT,
      score: talent.score,
      explanation: talent.explanation,
      weight: POWER_FACTOR_WEIGHTS[POWER_FACTOR_NAMES.TALENT],
    },
    {
      name: POWER_FACTOR_NAMES.MARKET,
      score: market.score,
      explanation: market.explanation,
      weight: POWER_FACTOR_WEIGHTS[POWER_FACTOR_NAMES.MARKET],
    },
    {
      name: POWER_FACTOR_NAMES.STRATEGIC,
      score: strategic.score,
      explanation: strategic.explanation,
      weight: POWER_FACTOR_WEIGHTS[POWER_FACTOR_NAMES.STRATEGIC],
    },
  ];
}

/**
 * Identify vulnerabilities based on low-scoring factors
 *
 * @param company - The company to analyze
 * @returns Array of vulnerability descriptions
 */
export function identifyVulnerabilities(company: PrivateCompany): string[] {
  const factors = explainPowerFactors(company);
  const vulnerabilities: string[] = [];

  for (const factor of factors) {
    if (factor.score < 30) {
      switch (factor.name) {
        case POWER_FACTOR_NAMES.FUNDING:
          vulnerabilities.push('Limited funding runway');
          break;
        case POWER_FACTOR_NAMES.TECHNOLOGY:
          vulnerabilities.push('Technology differentiation unclear');
          break;
        case POWER_FACTOR_NAMES.TALENT:
          vulnerabilities.push('Team scaling challenges');
          break;
        case POWER_FACTOR_NAMES.MARKET:
          vulnerabilities.push('Market traction unproven');
          break;
        case POWER_FACTOR_NAMES.STRATEGIC:
          vulnerabilities.push('Strategic positioning undefined');
          break;
      }
    }
  }

  // Add stage-specific vulnerabilities
  const stage = getLatestStage(company.fundingRounds);
  if (FUNDING_STAGE_ORDER[stage] <= 2) {
    vulnerabilities.push('Early-stage execution risk');
  }

  // Concentration risk
  if (company.tags?.length === 1) {
    vulnerabilities.push('Single market focus concentration');
  }

  return vulnerabilities.slice(0, 4); // Limit to 4 vulnerabilities
}

/**
 * Identify top contributors to power score
 *
 * @param company - The company to analyze
 * @returns Array of contributor descriptions
 */
export function identifyTopContributors(company: PrivateCompany): string[] {
  const factors = explainPowerFactors(company);
  const contributors: string[] = [];

  // Sort by score and take top factors
  const topFactors = [...factors].sort((a, b) => b.score - a.score).slice(0, 3);

  for (const factor of topFactors) {
    if (factor.score >= 60) {
      contributors.push(factor.explanation);
    }
  }

  // Add specific highlights
  const totalFunding = getTotalFunding(company.fundingRounds);
  if (totalFunding > 100_000_000) {
    contributors.push(`$${formatAmount(totalFunding)} total funding`);
  }

  const valuation = getLatestValuation(company.fundingRounds);
  if (valuation > 1_000_000_000) {
    contributors.push('Unicorn valuation');
  }

  return [...new Set(contributors)].slice(0, 5); // Dedupe and limit to 5
}

/**
 * Build complete power explanation for a company
 *
 * @param company - The company to analyze
 * @returns Complete PowerExplanation object
 */
export function buildPowerExplanation(company: PrivateCompany): PowerExplanation {
  return {
    entityId: company.id,
    entityName: company.name,
    overallPower: computePowerScore(company),
    factors: explainPowerFactors(company),
    topContributors: identifyTopContributors(company),
    vulnerabilities: identifyVulnerabilities(company),
  };
}
