/**
 * Robotics Narrative Index Engine
 *
 * Computes a single "Narrative Odds %" score (0-100) that aggregates:
 * - GitHub Activity: 20%
 * - Government Contracts: 25%
 * - News Sentiment: 20%
 * - Funding Flow: 20%
 * - Technical Momentum: 15%
 */

import { getOrgLeaderboard, getRecentReleases } from './github';
import { searchRoboticsContracts } from './usaspending';
import { fetchRoboticsFundingNews, FundingRound } from './newsapi';
import fs from 'fs';
import path from 'path';

// Weights for each component
// Index Alpha is HEAVILY weighted as it represents real market conviction
const WEIGHTS = {
  indexAlpha: 0.30,   // HEAVY: Real market alpha vs MSCI World benchmark
  polymarket: 0.15,   // Prediction market sentiment
  contracts: 0.15,    // Government contracts
  github: 0.10,       // Developer activity
  news: 0.10,         // News sentiment
  funding: 0.10,      // VC funding
  technical: 0.10,    // SDK releases
};

export interface NarrativeSignal {
  id: string;
  type: 'github' | 'contract' | 'news' | 'funding' | 'technical';
  title: string;
  description: string;
  impact: number; // -10 to +10
  timestamp: string;
  source: string;
  url?: string;
}

export interface NarrativeScore {
  id: string;
  timestamp: string;
  overall: number; // 0-100
  components: {
    indexAlpha: number;   // Market alpha vs benchmark (30% weight)
    polymarket: number;   // Prediction market sentiment (15%)
    contracts: number;    // Government contracts (15%)
    github: number;       // Developer activity (10%)
    news: number;         // News sentiment (10%)
    funding: number;      // VC funding (10%)
    technical: number;    // SDK releases (10%)
  };
  trend: 'up' | 'down' | 'stable';
  confidence: number; // 0-1
  signals: NarrativeSignal[];
}

export interface NarrativeLevel {
  label: string;
  color: string;
  action: string;
  emoji: string;
}

// History file path
const HISTORY_FILE = path.join(process.cwd(), 'data', 'narrative-history.json');
// Sticky signals file - signals that decay over time
const STICKY_SIGNALS_FILE = path.join(process.cwd(), 'data', 'sticky-signals.json');

/**
 * SIGNAL DECAY SYSTEM
 * Big news stays relevant but decays over time:
 * - Day 0: 100% impact
 * - Day 1: 85% impact
 * - Day 3: 60% impact
 * - Day 7: 30% impact
 * - Day 14: 10% impact
 * - Day 30+: 0% (removed)
 */
function calculateDecayMultiplier(daysAgo: number): number {
  if (daysAgo <= 0) return 1.0;
  if (daysAgo <= 1) return 0.85;
  if (daysAgo <= 3) return 0.60;
  if (daysAgo <= 7) return 0.30;
  if (daysAgo <= 14) return 0.10;
  if (daysAgo <= 30) return 0.05;
  return 0; // Expired
}

interface StickySignal {
  id: string;
  type: 'contract' | 'funding' | 'news' | 'technical' | 'github';
  title: string;
  description: string;
  baseImpact: number;      // Original impact before decay
  amount?: number;         // Dollar amount for funding/contracts
  timestamp: string;       // When the event occurred
  addedAt: string;         // When we added it to sticky signals
}

/**
 * Load sticky signals from file
 */
function loadStickySignals(): StickySignal[] {
  try {
    if (fs.existsSync(STICKY_SIGNALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STICKY_SIGNALS_FILE, 'utf-8'));
      return data.signals || [];
    }
  } catch (error) {
    console.error('[NarrativeIndex] Error loading sticky signals:', error);
  }
  return [];
}

/**
 * Save sticky signals to file
 */
function saveStickySignals(signals: StickySignal[]): void {
  try {
    const dataDir = path.dirname(STICKY_SIGNALS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(STICKY_SIGNALS_FILE, JSON.stringify({ signals, updatedAt: new Date().toISOString() }, null, 2));
  } catch (error) {
    console.error('[NarrativeIndex] Error saving sticky signals:', error);
  }
}

/**
 * Add a new sticky signal (if not already exists)
 */
function addStickySignal(signal: StickySignal): void {
  const signals = loadStickySignals();
  // Check if signal already exists
  if (!signals.find(s => s.id === signal.id)) {
    signals.push(signal);
    saveStickySignals(signals);
    console.log(`[NarrativeIndex] Added sticky signal: ${signal.title}`);
  }
}

/**
 * Get all active sticky signals with their decayed impact
 */
function getActiveStickySIgnals(): Array<StickySignal & { decayedImpact: number; daysAgo: number }> {
  const signals = loadStickySignals();
  const now = new Date();

  return signals
    .map(signal => {
      const eventDate = new Date(signal.timestamp);
      const daysAgo = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      const decay = calculateDecayMultiplier(daysAgo);
      const decayedImpact = signal.baseImpact * decay;

      return { ...signal, decayedImpact, daysAgo };
    })
    .filter(s => s.decayedImpact > 0); // Remove fully decayed signals
}

/**
 * Clean up expired sticky signals (older than 30 days)
 */
function cleanupExpiredSignals(): void {
  const signals = loadStickySignals();
  const now = new Date();

  const active = signals.filter(signal => {
    const eventDate = new Date(signal.timestamp);
    const daysAgo = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo < 30;
  });

  if (active.length !== signals.length) {
    saveStickySignals(active);
    console.log(`[NarrativeIndex] Cleaned up ${signals.length - active.length} expired signals`);
  }
}

/**
 * Calculate funding impact based on amount
 * $30M = base impact of 1
 * $100M = base impact of 2
 * $300M = base impact of 4
 * $500M+ = base impact of 5 (capped)
 */
function calculateFundingImpact(amount: number): number {
  if (amount >= 500_000_000) return 5;
  if (amount >= 300_000_000) return 4;
  if (amount >= 200_000_000) return 3;
  if (amount >= 100_000_000) return 2;
  if (amount >= 50_000_000) return 1.5;
  if (amount >= 30_000_000) return 1;
  return 0.5;
}

/**
 * Calculate contract impact based on amount
 * $10M = base impact of 1
 * $50M = base impact of 2
 * $100M = base impact of 3
 * $500M+ = base impact of 5 (capped)
 */
function calculateContractImpact(amount: number): number {
  if (amount >= 500_000_000) return 5;
  if (amount >= 100_000_000) return 3;
  if (amount >= 50_000_000) return 2;
  if (amount >= 10_000_000) return 1;
  return 0.5;
}

/**
 * Compute the current Narrative Index score
 */
export async function computeNarrativeIndex(): Promise<NarrativeScore> {
  const startTime = Date.now();
  const signals: NarrativeSignal[] = [];

  // Compute each component score (in parallel for speed)
  const [
    [indexAlphaScore, indexAlphaSignals],
    [polymarketScore, polymarketSignals],
    [contractsScore, contractSignals],
    [githubScore, githubSignals],
    [newsScore, newsSignals],
    [fundingScore, fundingSignals],
    [technicalScore, technicalSignals],
  ] = await Promise.all([
    computeIndexAlphaScore(),      // 30% weight - HEAVY
    computePolymarketScore(),      // 15% weight
    computeContractsScore(),       // 15% weight
    computeGitHubScore(),          // 10% weight
    computeNewsScore(),            // 10% weight
    computeFundingScore(),         // 10% weight
    computeTechnicalScore(),       // 10% weight
  ]);

  // Collect all signals
  signals.push(
    ...indexAlphaSignals,    // Index signals first (most important)
    ...polymarketSignals,
    ...contractSignals,
    ...githubSignals,
    ...newsSignals,
    ...fundingSignals,
    ...technicalSignals
  );

  // Sort signals by impact magnitude
  signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  // Compute weighted overall score
  // Index Alpha has 30% weight (HEAVY) as it represents real market conviction
  const overall = Math.round(
    indexAlphaScore * WEIGHTS.indexAlpha +
    polymarketScore * WEIGHTS.polymarket +
    contractsScore * WEIGHTS.contracts +
    githubScore * WEIGHTS.github +
    newsScore * WEIGHTS.news +
    fundingScore * WEIGHTS.funding +
    technicalScore * WEIGHTS.technical
  );

  // Get previous score to determine trend
  const previousScores = await getHistoricalScores(1);
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousScores.length > 0) {
    const diff = overall - previousScores[0].overall;
    if (diff > 2) trend = 'up';
    else if (diff < -2) trend = 'down';
  }

  // Calculate confidence based on data availability
  // Weight index alpha higher in confidence calculation
  const dataPoints = [
    indexAlphaScore > 0 ? 2 : 0,   // Double weight for index data
    polymarketScore > 0 ? 1 : 0,
    contractsScore > 0 ? 1 : 0,
    githubScore > 0 ? 1 : 0,
    newsScore > 0 ? 1 : 0,
    fundingScore > 0 ? 1 : 0,
    technicalScore > 0 ? 1 : 0,
  ];
  const confidence = dataPoints.reduce((a, b) => a + b, 0) / 8;

  const score: NarrativeScore = {
    id: `rni-${Date.now()}`,
    timestamp: new Date().toISOString(),
    overall,
    components: {
      indexAlpha: indexAlphaScore,
      polymarket: polymarketScore,
      contracts: contractsScore,
      github: githubScore,
      news: newsScore,
      funding: fundingScore,
      technical: technicalScore,
    },
    trend,
    confidence,
    signals: signals.slice(0, 10), // Top 10 signals
  };

  console.log(`[NarrativeIndex] Computed in ${Date.now() - startTime}ms: ${overall}%`);

  return score;
}

/**
 * Compute GitHub activity score (0-100)
 *
 * QUANT FORMULA:
 * Score = min(100, CommitVelocity + TrendMomentum + ContributorBreadth)
 *
 * Where:
 * - CommitVelocity = 20 * ln(1 + commits/50)  [logarithmic scaling, max ~60]
 * - TrendMomentum = 20 * (upTrend - downTrend) / totalOrgs  [range: -20 to +20]
 * - ContributorBreadth = 20 * (activeOrgs / totalOrgs)  [range: 0-20]
 *
 * This gives a data-driven score that:
 * - Uses log scaling to handle high commit counts gracefully
 * - Rewards positive momentum across the ecosystem
 * - Values breadth of activity (many orgs active > one org dominant)
 */
async function computeGitHubScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];

  try {
    const leaderboard = await getOrgLeaderboard();

    // NO DATA = 0 (honest about missing data)
    if (leaderboard.length === 0) {
      signals.push({
        id: `gh-nodata-${Date.now()}`,
        type: 'github',
        title: 'No GitHub Data Available',
        description: 'Could not fetch activity from tracked orgs',
        impact: 0,
        timestamp: new Date().toISOString(),
        source: 'GitHub API',
      });
      return [0, signals];
    }

    // Calculate metrics
    const totalCommitsWeek = leaderboard.reduce((sum, org) => sum + org.commitsWeek, 0);
    const totalOrgs = leaderboard.length;
    const activeOrgs = leaderboard.filter(org => org.commitsWeek > 0).length;
    const upTrendCount = leaderboard.filter(org => org.trend === 'up').length;
    const downTrendCount = leaderboard.filter(org => org.trend === 'down').length;

    // QUANT FORMULA COMPONENTS:
    // 1. Commit Velocity: logarithmic scaling (handles exponential growth gracefully)
    //    20 * ln(1 + commits/50) gives: 0 commits=0, 50=14, 100=22, 200=28, 500=35, 1000=40
    const commitVelocity = 20 * Math.log(1 + totalCommitsWeek / 50);

    // 2. Trend Momentum: net positive trend across ecosystem
    //    Normalized to [-20, +20] range
    const trendMomentum = 20 * (upTrendCount - downTrendCount) / Math.max(1, totalOrgs);

    // 3. Contributor Breadth: how many orgs are actively contributing
    //    Full 20 points if all orgs active, proportionally less otherwise
    const contributorBreadth = 20 * (activeOrgs / totalOrgs);

    // Combined score (capped at 100)
    let score = Math.round(commitVelocity + trendMomentum + contributorBreadth);
    score = Math.max(0, Math.min(100, score));

    // Generate signal with formula breakdown
    signals.push({
      id: `gh-quant-${Date.now()}`,
      type: 'github',
      title: `GitHub Score: ${score}`,
      description: `V=${commitVelocity.toFixed(1)} + M=${trendMomentum.toFixed(1)} + B=${contributorBreadth.toFixed(1)} | ${totalCommitsWeek} commits, ${activeOrgs}/${totalOrgs} active`,
      impact: 0,
      timestamp: new Date().toISOString(),
      source: 'GitHub API',
    });

    console.log(`[NarrativeIndex] GitHub: commits=${totalCommitsWeek}, V=${commitVelocity.toFixed(1)}, M=${trendMomentum.toFixed(1)}, B=${contributorBreadth.toFixed(1)} → score=${score}`);

    return [score, signals];
  } catch (error) {
    console.error('[NarrativeIndex] GitHub score error:', error);
    return [0, signals]; // Error = no data = 0
  }
}

/**
 * Compute government contracts score (0-100)
 * Uses sticky signals for large contracts that decay over time
 * Amount-weighted: $500M contract has 5x impact of $10M contract
 *
 * Data sources:
 * 1. Breaking contracts (data/breaking-contracts.json) - real-time manual entries
 * 2. Sticky signals - decaying impact from past large contracts
 * 3. USASpending.gov - official federal contract database (30-90 day lag)
 */
async function computeContractsScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];
  const now = new Date();

  try {
    // ============ 1. BREAKING CONTRACTS (real-time) ============
    // These are manually added when news breaks, before USASpending catches up
    let breakingTotal = 0;
    try {
      const breakingPath = path.join(process.cwd(), 'data', 'breaking-contracts.json');
      if (fs.existsSync(breakingPath)) {
        const breakingData = JSON.parse(fs.readFileSync(breakingPath, 'utf-8'));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30); // Last 30 days

        for (const contract of breakingData.contracts || []) {
          const announcedDate = new Date(contract.announcedDate);
          if (announcedDate >= cutoff) {
            breakingTotal += contract.amount;
            const daysAgo = Math.floor((now.getTime() - announcedDate.getTime()) / (1000 * 60 * 60 * 24));
            const impact = calculateContractImpact(contract.amount);

            signals.push({
              id: contract.id,
              type: 'contract',
              title: `🔴 BREAKING: ${contract.company} $${formatAmount(contract.amount)}`,
              description: `${contract.agency}: ${contract.description.slice(0, 60)}...`,
              impact: impact,
              timestamp: contract.announcedDate,
              source: 'Breaking News',
              url: contract.url,
            });

            // Auto-add to sticky signals for decay tracking
            addStickySignal({
              id: contract.id,
              type: 'contract',
              title: `${contract.company} $${formatAmount(contract.amount)}`,
              description: contract.description.slice(0, 100),
              baseImpact: impact,
              amount: contract.amount,
              timestamp: contract.announcedDate,
              addedAt: now.toISOString(),
            });

            console.log(`[NarrativeIndex] Breaking contract: ${contract.company} $${formatAmount(contract.amount)} (${daysAgo}d ago)`);
          }
        }
      }
    } catch (err) {
      console.error('[NarrativeIndex] Error loading breaking contracts:', err);
    }

    // ============ 2. STICKY SIGNALS (decaying past contracts) ============
    const stickySignals = getActiveStickySIgnals().filter(s => s.type === 'contract');
    let stickyBonus = 0;

    for (const sticky of stickySignals) {
      // Don't double-count breaking contracts that are also sticky
      if (signals.find(s => s.id === sticky.id)) continue;

      stickyBonus += sticky.decayedImpact * 2; // Each point of impact = 2 score points
      signals.push({
        id: sticky.id,
        type: 'contract',
        title: `${sticky.title} (${sticky.daysAgo}d ago)`,
        description: `${sticky.description} [Impact: ${sticky.decayedImpact.toFixed(1)} decayed from ${sticky.baseImpact}]`,
        impact: sticky.decayedImpact,
        timestamp: sticky.timestamp,
        source: 'Sticky Signal',
      });
    }

    // ============ 3. USASPENDING.GOV (official, lagged data) ============
    const { contracts, total } = await searchRoboticsContracts({
      minAmount: 100000,
      days: 30,
      limit: 50,
    });

    // Calculate total awarded in last 30 days (breaking + USASpending)
    const usaspendingTotal = contracts.length > 0
      ? contracts.reduce((sum, c) => sum + c.awardAmount, 0)
      : 0;
    const totalAwarded = breakingTotal + usaspendingTotal;
    const totalContracts = contracts.length + (breakingTotal > 0 ? 1 : 0);

    // ============ QUANT FORMULA ============
    // Score = DollarVolume + ContractCount + StickyMomentum
    //
    // DollarVolume = 30 * ln(1 + totalAwarded / $10M)
    //   - Logarithmic scaling: $10M=21, $50M=36, $100M=42, $250M=50, $500M=55
    //   - Max contribution ~60 points
    //
    // ContractCount = 20 * (contracts / 10)
    //   - Linear up to 10 contracts = 20 points
    //   - More contracts = broader government interest
    //
    // StickyMomentum = decayed impact from recent large contracts
    //   - Keeps big wins relevant as they decay

    // 1. Dollar Volume (log-scaled)
    const dollarVolume = 30 * Math.log(1 + totalAwarded / 10_000_000);

    // 2. Contract Count (linear, capped at 20)
    const countScore = Math.min(20, 20 * (totalContracts / 10));

    // 3. Sticky momentum from past contracts
    const stickyMomentum = Math.min(20, stickyBonus);

    // Combined score
    let score = Math.round(dollarVolume + countScore + stickyMomentum);
    score = Math.max(0, Math.min(100, score));

    // Generate signal with formula breakdown
    signals.push({
      id: `contracts-quant-${Date.now()}`,
      type: 'contract',
      title: `Contracts Score: ${score}`,
      description: `$Vol=${dollarVolume.toFixed(1)} + Count=${countScore.toFixed(1)} + Sticky=${stickyMomentum.toFixed(1)} | $${formatAmount(totalAwarded)} across ${totalContracts} contracts`,
      impact: 0,
      timestamp: new Date().toISOString(),
      source: 'USASpending.gov + Breaking',
    });

    console.log(`[NarrativeIndex] Contracts: $${formatAmount(totalAwarded)} (${totalContracts} contracts), $Vol=${dollarVolume.toFixed(1)}, Count=${countScore.toFixed(1)}, Sticky=${stickyMomentum.toFixed(1)} → score=${score}`);

    // Find large contracts and add to sticky signals
    const largeContracts = contracts.filter(c => c.awardAmount > 10_000_000);
    for (const contract of largeContracts.slice(0, 3)) {
      const impact = calculateContractImpact(contract.awardAmount);

      // Add to sticky signals for future decay
      addStickySignal({
        id: `contract-${contract.awardId}`,
        type: 'contract',
        title: `$${formatAmount(contract.awardAmount)} Contract`,
        description: `${contract.recipientName}: ${contract.description.slice(0, 60)}`,
        baseImpact: impact,
        amount: contract.awardAmount,
        timestamp: contract.awardDate,
        addedAt: new Date().toISOString(),
      });

      signals.push({
        id: `contract-${contract.awardId}`,
        type: 'contract',
        title: `$${formatAmount(contract.awardAmount)} Contract Awarded`,
        description: `${contract.recipientName}: ${contract.description.slice(0, 80)}...`,
        impact: impact,
        timestamp: contract.awardDate,
        source: 'USASpending.gov',
      });
    }

    // Signal for high contract count
    if (contracts.length > 20) {
      signals.push({
        id: `contracts-volume-${Date.now()}`,
        type: 'contract',
        title: 'High Contract Volume',
        description: `${contracts.length} robotics contracts in last 30 days`,
        impact: 1.5,
        timestamp: new Date().toISOString(),
        source: 'USASpending.gov',
      });
    }

    // Clean up expired sticky signals periodically
    cleanupExpiredSignals();

    return [score, signals];
  } catch (error) {
    console.error('[NarrativeIndex] Contracts score error:', error);
    // Error = bad, not neutral
    return [25, signals];
  }
}

/**
 * Compute news sentiment score (0-100)
 *
 * TODO: Currently returns a baseline score.
 * Should integrate with NewsAPI to get actual sentiment.
 * Until then, this is marked as "estimated" with lower confidence.
 */
async function computeNewsScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];

  // TODO: Integrate with actual NewsAPI
  // For now, return baseline that acknowledges we don't have real data
  // This should be marked as an ESTIMATE, not treated as real data
  const baseScore = 45; // Below neutral since we don't have actual data

  signals.push({
    id: `news-estimate-${Date.now()}`,
    type: 'news',
    title: 'News Data Estimated',
    description: 'Using baseline estimate - NewsAPI integration pending',
    impact: 0,
    timestamp: new Date().toISOString(),
    source: 'Estimate',
  });

  return [baseScore, signals];
}

/**
 * Compute funding score (0-100)
 *
 * QUANT FORMULA - Momentum-based, relative to AI industry
 *
 * Score = VelocityScore + MomentumBonus + RecencyBonus
 *
 * Where:
 * - VelocityScore: Monthly funding velocity vs $300M/month baseline (robotics-specific)
 *   - $100M/mo = 15, $300M/mo = 35, $500M/mo = 45, $1B/mo = 50 (capped)
 *   - Uses sqrt scaling to prevent mega-rounds from dominating
 *
 * - MomentumBonus: Compares last 30 days vs previous 60 days (-20 to +20)
 *   - Accelerating funding = positive bonus
 *   - Decelerating funding = negative penalty
 *
 * - RecencyBonus: Rewards recent activity (0-20)
 *   - 5+ rounds in last 30 days = full 20 points
 *
 * AI Industry Context:
 * - Total AI funding ~$50B/year = ~$4.2B/month
 * - Robotics is ~7-10% of AI = ~$300-400M/month baseline
 * - Score of 50 = healthy baseline activity
 * - Score of 70+ = exceptional momentum
 * - Score of 30- = cooling market
 *
 * Data Source: Curated database + NewsAPI
 */
async function computeFundingScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];
  const now = new Date();

  // ============ LOAD FUNDING DATA ============
  let allFunding: Array<{ company: string; amount: number; date: string; source?: string; url?: string; title?: string; round?: string }> = [];

  // 1. Load curated funding database (full history for momentum calculation)
  try {
    const fundingDbPath = path.join(process.cwd(), 'data', 'robotics-funding-2025.json');
    if (fs.existsSync(fundingDbPath)) {
      const fundingDb = JSON.parse(fs.readFileSync(fundingDbPath, 'utf-8'));
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - 180); // 6 months for momentum calc

      for (const round of fundingDb.rounds || []) {
        const roundDate = new Date(round.date);
        if (roundDate >= cutoffDate) {
          allFunding.push({
            company: round.company,
            amount: round.amount,
            date: round.date,
            source: 'Curated Database',
            title: `${round.round}: ${round.description || ''}`,
            round: round.round,
          });
        }
      }
      console.log(`[NarrativeIndex] Loaded ${allFunding.length} funding rounds (last 180 days)`);
    }
  } catch (err) {
    console.error('[NarrativeIndex] Error loading funding database:', err);
  }

  // 2. Supplement with NewsAPI for breaking news
  try {
    const { rounds, error } = await fetchRoboticsFundingNews(30);
    if (!error && rounds.length > 0) {
      const existingCompanies = new Set(allFunding.map(r => r.company.toLowerCase()));
      for (const round of rounds) {
        if (!existingCompanies.has(round.company.toLowerCase())) {
          allFunding.push({
            company: round.company,
            amount: round.amount,
            date: round.date,
            source: round.source,
            url: round.url,
            title: round.title,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[NarrativeIndex] NewsAPI funding fetch skipped:', err);
  }

  // ============ SEGMENT BY TIME PERIOD ============
  const last30Days = allFunding.filter(r => {
    const daysAgo = Math.floor((now.getTime() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 30;
  });

  const last60To90Days = allFunding.filter(r => {
    const daysAgo = Math.floor((now.getTime() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo > 30 && daysAgo <= 90;
  });

  const last90Days = allFunding.filter(r => {
    const daysAgo = Math.floor((now.getTime() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 90;
  });

  // ============ QUANT FORMULA COMPONENTS ============

  // 1. VELOCITY SCORE (0-45)
  // Monthly velocity vs AI industry robotics baseline
  // Cap individual rounds at $500M to prevent mega-rounds from dominating
  const ROUND_CAP = 500_000_000; // Cap any single round at $500M for scoring
  const cappedLast90Days = last90Days.reduce((sum, r) => sum + Math.min(r.amount, ROUND_CAP), 0);
  const monthlyVelocity = cappedLast90Days / 3; // 3 months

  // Baseline: ~$400M/month is healthy for robotics (5% of ~$8B/mo AI industry)
  // Score 50 = at baseline, score 70 = 2x baseline, score 30 = 0.5x baseline
  const BASELINE_MONTHLY = 400_000_000;

  // Use log scaling for better normalization
  // log2(velocity/baseline) * 10 + 40
  // $200M/mo = 30, $400M/mo = 40, $800M/mo = 50, $1.6B/mo = 60
  const velocityRatio = Math.max(0.1, monthlyVelocity / BASELINE_MONTHLY);
  const velocityScore = Math.min(45, Math.max(10, 40 + 15 * Math.log2(velocityRatio)));

  // 2. MOMENTUM BONUS (-15 to +15)
  // Compare last 30 days to previous 60 days (normalized to monthly, capped)
  const fundingLast30 = last30Days.reduce((sum, r) => sum + Math.min(r.amount, ROUND_CAP), 0);
  const fundingPrev60 = last60To90Days.reduce((sum, r) => sum + Math.min(r.amount, ROUND_CAP), 0);
  const monthlyLast30 = fundingLast30; // Already 1 month
  const monthlyPrev60 = fundingPrev60 / 2; // 2 months

  let momentumBonus = 0;
  if (monthlyPrev60 > 50_000_000) { // Need meaningful previous data
    const momentumRatio = monthlyLast30 / monthlyPrev60;
    // >1.5x = acceleration (+15), 1.0x = neutral (0), <0.5x = deceleration (-15)
    if (momentumRatio >= 2.0) momentumBonus = 15;
    else if (momentumRatio >= 1.5) momentumBonus = 10;
    else if (momentumRatio >= 1.2) momentumBonus = 5;
    else if (momentumRatio >= 0.8) momentumBonus = 0;
    else if (momentumRatio >= 0.5) momentumBonus = -5;
    else momentumBonus = -15;
  } else if (fundingLast30 > 100_000_000) {
    // No previous data but strong recent activity = slight positive
    momentumBonus = 5;
  }

  // 3. RECENCY BONUS (0-15)
  // Rewards recent deal flow - 4+ rounds in last 30 days = full bonus
  const recentRoundCount = last30Days.length;
  const recencyBonus = Math.min(15, 4 * recentRoundCount); // 4 points per round, max 15

  // ============ COMBINED SCORE ============
  let score = Math.round(velocityScore + momentumBonus + recencyBonus);
  score = Math.max(0, Math.min(100, score));

  // ============ SIGNALS ============
  // Get sticky signals for display
  const stickySignals = getActiveStickySIgnals().filter(s => s.type === 'funding');
  for (const sticky of stickySignals) {
    const decayPct = Math.round((sticky.decayedImpact / sticky.baseImpact) * 100);
    signals.push({
      id: sticky.id,
      type: 'funding',
      title: `${sticky.title} (${sticky.daysAgo}d ago, ${decayPct}% decay)`,
      description: sticky.description,
      impact: sticky.decayedImpact,
      timestamp: sticky.timestamp,
      source: 'Sticky Signal',
    });
  }

  // Use last90Days for display (more relevant than full 180 days)
  const recentFunding = last90Days;

  // Add sticky signals to processed list
  for (const sticky of stickySignals) {
    const decayPct = Math.round((sticky.decayedImpact / sticky.baseImpact) * 100);
    signals.push({
      id: sticky.id,
      type: 'funding',
      title: `${sticky.title} (${sticky.daysAgo}d ago, ${decayPct}% decay)`,
      description: sticky.description,
      impact: sticky.decayedImpact,
      timestamp: sticky.timestamp,
      source: 'Sticky Signal',
    });
  }

  // Process recent funding rounds
  for (const round of recentFunding) {
    const daysAgo = Math.floor((now.getTime() - new Date(round.date).getTime()) / (1000 * 60 * 60 * 24));

    // Add to sticky signals for mega rounds ($100M+)
    if (round.amount >= 100_000_000) {
      addStickySignal({
        id: `funding-${round.company.toLowerCase().replace(/\s/g, '-')}`,
        type: 'funding',
        title: `${round.company} $${formatAmount(round.amount)}`,
        description: round.title || 'Series funding round',
        baseImpact: calculateFundingImpact(round.amount),
        amount: round.amount,
        timestamp: round.date,
        addedAt: now.toISOString(),
      });
    }

    signals.push({
      id: `funding-${round.company.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      type: 'funding',
      title: `${round.company}: $${formatAmount(round.amount)}`,
      description: round.source ? `${daysAgo}d ago via ${round.source}` : `${daysAgo} days ago`,
      impact: round.amount >= 100_000_000 ? 2 : round.amount >= 50_000_000 ? 1 : 0,
      timestamp: round.date,
      source: round.source || 'NewsAPI',
      url: round.url,
    });
  }

  // Generate summary signal
  const momentumLabel = momentumBonus > 10 ? '🚀 Accelerating' : momentumBonus > 0 ? '📈 Growing' : momentumBonus === 0 ? '➡️ Stable' : '📉 Cooling';
  signals.push({
    id: `funding-quant-${Date.now()}`,
    type: 'funding',
    title: `Funding Score: ${score} ${momentumLabel}`,
    description: `Velocity=${velocityScore.toFixed(0)} + Momentum=${momentumBonus > 0 ? '+' : ''}${momentumBonus} + Recency=${recencyBonus} | $${formatAmount(monthlyVelocity)}/mo vs $300M baseline`,
    impact: momentumBonus > 0 ? 1 : momentumBonus < 0 ? -1 : 0,
    timestamp: now.toISOString(),
    source: 'Quant Formula',
  });

  console.log(`[NarrativeIndex] Funding: $${formatAmount(monthlyVelocity)}/mo, Velocity=${velocityScore.toFixed(1)}, Momentum=${momentumBonus}, Recency=${recencyBonus} → score=${score}`);

  return [score, signals];
}

/**
 * Compute technical momentum score (0-100)
 *
 * QUANT FORMULA:
 * Score = ReleaseVelocity + MajorReleaseBonus + OrgBreadth
 *
 * Where:
 * - ReleaseVelocity = 30 * ln(1 + releases/5)  [log scale for count]
 * - MajorReleaseBonus = 10 * majorReleases  [capped at 30]
 * - OrgBreadth = 20 * (uniqueOrgs / totalOrgs)  [diversity of releases]
 *
 * A healthy ecosystem has:
 * - Regular releases (velocity)
 * - Major version bumps (significance)
 * - Activity across many orgs (breadth)
 */
async function computeTechnicalScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];

  try {
    const releases = await getRecentReleases(30);

    // NO releases = 0 (honest about missing data)
    if (releases.length === 0) {
      signals.push({
        id: `tech-nodata-${Date.now()}`,
        type: 'technical',
        title: 'No Release Data',
        description: 'No releases from tracked robotics SDKs in 30 days',
        impact: 0,
        timestamp: new Date().toISOString(),
        source: 'GitHub Releases',
      });
      return [0, signals];
    }

    // Calculate metrics
    const majorReleases = releases.filter(r => r.isMajor);
    const uniqueOrgs = new Set(releases.map(r => r.org)).size;
    const totalTrackedOrgs = 11; // Number of orgs we track

    // ============ QUANT FORMULA COMPONENTS ============

    // 1. Release Velocity (logarithmic)
    const releaseVelocity = 30 * Math.log(1 + releases.length / 5);

    // 2. Major Release Bonus (linear, capped at 30)
    const majorBonus = Math.min(30, 10 * majorReleases.length);

    // 3. Org Breadth (diversity)
    const orgBreadth = 20 * (uniqueOrgs / totalTrackedOrgs);

    // Combined score
    let score = Math.round(releaseVelocity + majorBonus + orgBreadth);
    score = Math.max(0, Math.min(100, score));

    // Log major releases
    for (const release of majorReleases.slice(0, 3)) {
      signals.push({
        id: `release-${release.org}-${release.version}`,
        type: 'technical',
        title: `Major: ${release.org}/${release.repo} ${release.version}`,
        description: release.notes?.slice(0, 50) || 'New major version',
        impact: 0,
        timestamp: release.date,
        source: 'GitHub Releases',
        url: release.url,
      });
    }

    // Generate summary signal
    signals.push({
      id: `tech-quant-${Date.now()}`,
      type: 'technical',
      title: `Technical Score: ${score}`,
      description: `Velocity=${releaseVelocity.toFixed(1)} + Major=${majorBonus.toFixed(1)} + Breadth=${orgBreadth.toFixed(1)} | ${releases.length} releases, ${majorReleases.length} major, ${uniqueOrgs} orgs`,
      impact: 0,
      timestamp: new Date().toISOString(),
      source: 'GitHub Releases',
    });

    console.log(`[NarrativeIndex] Technical: ${releases.length} releases, Velocity=${releaseVelocity.toFixed(1)}, Major=${majorBonus.toFixed(1)}, Breadth=${orgBreadth.toFixed(1)} → score=${score}`);

    return [score, signals];
  } catch (error) {
    console.error('[NarrativeIndex] Technical score error:', error);
    return [0, signals]; // Error = no data = 0
  }
}

/**
 * Compute Polymarket prediction market score (0-100)
 *
 * QUANT FORMULA: Score = Raw Probability * 100
 *
 * The score IS the probability. If markets say 6.4% chance of Tesla
 * releasing Optimus, the score is 6.4 (rounded to 6).
 *
 * This is the purest signal - no transformation, no interpretation.
 * The market's probability IS our score.
 */
async function computePolymarketScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];

  // Robotics-related markets to track (can add more with weights)
  const ROBOTICS_MARKETS = [
    {
      name: 'Tesla Optimus Release',
      tokenId: '81398621498976727589490119481788053159677593582770707348620729114209951230437',
      weight: 1.0,
    },
  ];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    let totalWeightedProb = 0;
    let totalWeight = 0;

    for (const market of ROBOTICS_MARKETS) {
      try {
        const response = await fetch(`${baseUrl}/api/polymarket/clob/price?token_id=${market.tokenId}&side=buy`);

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.data?.price !== undefined) {
            const price = parseFloat(data.data.price);
            if (!isNaN(price)) {
              totalWeightedProb += price * market.weight;
              totalWeight += market.weight;

              signals.push({
                id: `polymarket-${market.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
                type: 'funding',
                title: `${market.name}: ${(price * 100).toFixed(1)}%`,
                description: `Polymarket probability = score`,
                impact: 0, // No additional impact - the score IS the probability
                timestamp: new Date().toISOString(),
                source: 'Polymarket CLOB',
              });
            }
          }
        }
      } catch (err) {
        console.error(`[NarrativeIndex] Error fetching Polymarket ${market.name}:`, err);
      }
    }

    // If no markets fetched successfully
    if (totalWeight === 0) {
      signals.push({
        id: `polymarket-unavailable-${Date.now()}`,
        type: 'funding',
        title: 'Polymarket Data Unavailable',
        description: 'Could not fetch prediction market data',
        impact: 0,
        timestamp: new Date().toISOString(),
        source: 'Polymarket',
      });
      return [0, signals]; // No data = 0 score (not arbitrary fallback)
    }

    // QUANT FORMULA: Score = Probability * 100
    // 6.4% probability = 6.4 score (rounded to 6)
    const avgProb = totalWeightedProb / totalWeight;
    const score = Math.round(avgProb * 100);

    console.log(`[NarrativeIndex] Polymarket: P(YES)=${(avgProb * 100).toFixed(1)}% → score=${score}`);

    return [score, signals];
  } catch (error) {
    console.error('[NarrativeIndex] Polymarket score error:', error);
    signals.push({
      id: `polymarket-error-${Date.now()}`,
      type: 'funding',
      title: 'Polymarket Error',
      description: 'Error fetching prediction market data',
      impact: 0,
      timestamp: new Date().toISOString(),
      source: 'Polymarket',
    });
    return [0, signals]; // Error = no data = 0 score
  }
}

/**
 * Compute Index Alpha score (0-100)
 *
 * QUANT FORMULA - Multi-timeframe rolling alpha vs MSCI World (URTH ETF)
 *
 * Alpha = Robotics_Return - Benchmark_Return
 *
 * Timeframe weights:
 * - 1-day alpha:  40% (most recent signal)
 * - 5-day alpha:  35% (short-term trend)
 * - 20-day alpha: 25% (medium-term conviction)
 *
 * Score mapping:
 * - Alpha < -3% = 0-20 (strong underperformance)
 * - Alpha -3% to -1% = 20-40 (underperforming)
 * - Alpha -1% to +1% = 40-60 (tracking benchmark)
 * - Alpha +1% to +3% = 60-80 (outperforming)
 * - Alpha > +3% = 80-100 (strong outperformance)
 *
 * Momentum bonus: +5 if all timeframes positive, -5 if all negative
 * Trend alignment: +3 if improving across timeframes
 */
async function computeIndexAlphaScore(): Promise<[number, NarrativeSignal[]]> {
  const signals: NarrativeSignal[] = [];

  try {
    // Fetch robotics index with historical data AND benchmark (MSCI World ETF = URTH)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

    const [roboticsRes, benchmarkRes] = await Promise.all([
      fetch(`${baseUrl}/api/indices/robotics`),
      fetch(`${baseUrl}/api/stock/historical?symbol=URTH&days=25`), // MSCI World ETF
    ]);

    const roboticsData = roboticsRes.ok ? await roboticsRes.json() : null;
    const benchmarkData = benchmarkRes.ok ? await benchmarkRes.json() : null;

    // ============ ROBOTICS INDEX RETURNS ============
    // Use actual index levels for accurate historical returns
    let robotics1D = 0;
    let robotics5D = 0;
    let robotics20D = 0;
    let hasRoboticsHistory = false;

    if (roboticsData?.ok && roboticsData?.data?.indexLevels?.length > 0) {
      const levels = roboticsData.data.indexLevels;
      // Filter to daily values (those at 00:00:00)
      const dailyLevels = levels.filter((l: any) => l.date.includes('T00:00:00'));

      if (dailyLevels.length >= 2) {
        hasRoboticsHistory = true;
        const latest = dailyLevels[dailyLevels.length - 1].value;
        const prev1D = dailyLevels[dailyLevels.length - 2]?.value || latest;
        robotics1D = ((latest - prev1D) / prev1D) * 100;

        if (dailyLevels.length >= 6) {
          const prev5D = dailyLevels[dailyLevels.length - 6]?.value || latest;
          robotics5D = ((latest - prev5D) / prev5D) * 100;
        }

        if (dailyLevels.length >= 21) {
          const prev20D = dailyLevels[dailyLevels.length - 21]?.value || latest;
          robotics20D = ((latest - prev20D) / prev20D) * 100;
        } else if (dailyLevels.length > 6) {
          // Use available data for 20D approximation
          const oldest = dailyLevels[0]?.value || latest;
          const daysAvailable = dailyLevels.length;
          const totalReturn = ((latest - oldest) / oldest) * 100;
          robotics20D = (totalReturn / daysAvailable) * 20; // Extrapolate to 20D
        }
      }
    }

    // Fallback: use stock daily changes if no index history
    if (!hasRoboticsHistory) {
      const stockChanges: number[] = [];
      if (roboticsData?.ok && roboticsData?.data?.stocks) {
        for (const stock of roboticsData.data.stocks) {
          if (typeof stock.changePercent === 'number') {
            stockChanges.push(stock.changePercent);
          }
        }
      }

      if (stockChanges.length === 0) {
        signals.push({
          id: `alpha-nodata-${Date.now()}`,
          type: 'technical',
          title: 'Index Data Unavailable',
          description: 'Cannot calculate alpha - no robotics stock data',
          impact: -2,
          timestamp: new Date().toISOString(),
          source: 'Index Alpha',
        });
        return [35, signals];
      }

      // Calculate median of daily changes
      stockChanges.sort((a, b) => a - b);
      const mid = Math.floor(stockChanges.length / 2);
      robotics1D = stockChanges.length % 2 !== 0
        ? stockChanges[mid]
        : (stockChanges[mid - 1] + stockChanges[mid]) / 2;

      // Approximate 5D and 20D from 1D (momentum factor)
      robotics5D = robotics1D * 3.5;
      robotics20D = robotics1D * 10;

      signals.push({
        id: `alpha-approx-${Date.now()}`,
        type: 'technical',
        title: 'Using Approximated Returns',
        description: 'No index history - using single-day extrapolation',
        impact: 0,
        timestamp: new Date().toISOString(),
        source: 'Index Alpha',
      });
    }

    // ============ BENCHMARK RETURNS (MSCI World) ============
    let benchmark1D = 0;
    let benchmark5D = 0;
    let benchmark20D = 0;
    let hasBenchmarkData = false;

    if (benchmarkData?.ok && benchmarkData?.data?.history?.length > 0) {
      const history = benchmarkData.data.history;
      hasBenchmarkData = true;

      // Calculate returns over different periods
      if (history.length >= 2) {
        benchmark1D = ((history[0].close - history[1].close) / history[1].close) * 100;
      }
      if (history.length >= 6) {
        benchmark5D = ((history[0].close - history[5].close) / history[5].close) * 100;
      }
      if (history.length >= 21) {
        benchmark20D = ((history[0].close - history[20].close) / history[20].close) * 100;
      }
    }

    // If no benchmark data, use historical average (MSCI World ~10% annually = 0.04% daily)
    if (!hasBenchmarkData) {
      benchmark1D = 0.04;
      benchmark5D = 0.2;  // ~5 days
      benchmark20D = 0.8; // ~20 days
      signals.push({
        id: `alpha-nobenchmark-${Date.now()}`,
        type: 'technical',
        title: 'Using Historical Benchmark',
        description: 'MSCI World data unavailable, using 10% annual avg',
        impact: 0,
        timestamp: new Date().toISOString(),
        source: 'Index Alpha',
      });
    }

    // ============ CALCULATE MULTI-TIMEFRAME ALPHA ============
    const alpha1D = robotics1D - benchmark1D;
    const alpha5D = robotics5D - benchmark5D;
    const alpha20D = robotics20D - benchmark20D;

    // ============ WEIGHTED ALPHA SCORE ============
    // Weights: 1D=40%, 5D=35%, 20D=25%
    const weightedAlpha = (alpha1D * 0.40) + (alpha5D * 0.35) + (alpha20D * 0.25);

    // ============ CONVERT ALPHA TO SCORE ============
    // Scoring curve: sigmoid-like mapping
    // -5% alpha = ~10 score
    // -3% alpha = ~25 score
    // -1% alpha = ~40 score
    //  0% alpha = ~50 score
    // +1% alpha = ~60 score
    // +3% alpha = ~75 score
    // +5% alpha = ~90 score
    let score: number;
    if (weightedAlpha <= -5) {
      score = 5;
    } else if (weightedAlpha <= -3) {
      score = 5 + ((weightedAlpha + 5) / 2) * 20; // 5-25
    } else if (weightedAlpha <= -1) {
      score = 25 + ((weightedAlpha + 3) / 2) * 15; // 25-40
    } else if (weightedAlpha <= 0) {
      score = 40 + ((weightedAlpha + 1) / 1) * 10; // 40-50
    } else if (weightedAlpha <= 1) {
      score = 50 + (weightedAlpha / 1) * 10; // 50-60
    } else if (weightedAlpha <= 3) {
      score = 60 + ((weightedAlpha - 1) / 2) * 15; // 60-75
    } else if (weightedAlpha <= 5) {
      score = 75 + ((weightedAlpha - 3) / 2) * 15; // 75-90
    } else {
      score = 90 + Math.min(10, (weightedAlpha - 5) * 2); // 90-100
    }

    // ============ MOMENTUM BONUS/PENALTY ============
    // All timeframes aligned = conviction bonus
    const allPositive = alpha1D > 0 && alpha5D > 0 && alpha20D > 0;
    const allNegative = alpha1D < 0 && alpha5D < 0 && alpha20D < 0;
    const improving = alpha1D > alpha5D && alpha5D > alpha20D; // Accelerating
    const deteriorating = alpha1D < alpha5D && alpha5D < alpha20D; // Decelerating

    if (allPositive) {
      score += 5;
      signals.push({
        id: `alpha-momentum-up-${Date.now()}`,
        type: 'technical',
        title: 'Positive Momentum Alignment',
        description: 'Robotics outperforming across all timeframes',
        impact: 2,
        timestamp: new Date().toISOString(),
        source: 'Index Alpha',
      });
    } else if (allNegative) {
      score -= 5;
      signals.push({
        id: `alpha-momentum-down-${Date.now()}`,
        type: 'technical',
        title: 'Negative Momentum Alignment',
        description: 'Robotics underperforming across all timeframes',
        impact: -2,
        timestamp: new Date().toISOString(),
        source: 'Index Alpha',
      });
    }

    if (improving && alpha1D > 0) {
      score += 3;
      signals.push({
        id: `alpha-accelerating-${Date.now()}`,
        type: 'technical',
        title: 'Alpha Accelerating',
        description: `Outperformance increasing: 1D=${alpha1D.toFixed(2)}% > 5D=${(alpha5D/5).toFixed(2)}%/day`,
        impact: 1.5,
        timestamp: new Date().toISOString(),
        source: 'Index Alpha',
      });
    } else if (deteriorating && alpha1D < 0) {
      score -= 3;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    // ============ GENERATE SUMMARY SIGNAL ============
    const alphaDesc = weightedAlpha > 0 ? `+${weightedAlpha.toFixed(2)}%` : `${weightedAlpha.toFixed(2)}%`;
    const benchmarkDesc = hasBenchmarkData ? 'URTH' : 'historical avg';

    signals.push({
      id: `alpha-summary-${Date.now()}`,
      type: 'technical',
      title: `Weighted Alpha: ${alphaDesc} vs ${benchmarkDesc}`,
      description: `1D: ${alpha1D > 0 ? '+' : ''}${alpha1D.toFixed(2)}% | 5D: ${alpha5D > 0 ? '+' : ''}${alpha5D.toFixed(2)}% | 20D: ${alpha20D > 0 ? '+' : ''}${alpha20D.toFixed(2)}%`,
      impact: weightedAlpha > 1 ? 2 : weightedAlpha < -1 ? -2 : 0,
      timestamp: new Date().toISOString(),
      source: 'Index Alpha',
    });

    console.log(`[NarrativeIndex] Index Alpha: robotics1D=${robotics1D.toFixed(2)}%, benchmark1D=${benchmark1D.toFixed(2)}%, weightedAlpha=${weightedAlpha.toFixed(2)}%, score=${score}`);

    return [score, signals];
  } catch (error) {
    console.error('[NarrativeIndex] Index Alpha score error:', error);
    signals.push({
      id: `alpha-error-${Date.now()}`,
      type: 'technical',
      title: 'Index Alpha Error',
      description: 'Error calculating market alpha vs benchmark',
      impact: -2,
      timestamp: new Date().toISOString(),
      source: 'Index Alpha',
    });
    return [35, signals];
  }
}

/**
 * Interpret a score into human-readable label
 */
export function interpretScore(score: number): NarrativeLevel {
  if (score >= 80) {
    return {
      label: 'STRONG NARRATIVE',
      color: '#00FF88',
      action: 'Major momentum, accumulate',
      emoji: '🟢',
    };
  } else if (score >= 60) {
    return {
      label: 'BUILDING',
      color: '#FFB800',
      action: 'Positive signals, watch closely',
      emoji: '🟡',
    };
  } else if (score >= 40) {
    return {
      label: 'NEUTRAL',
      color: '#888888',
      action: 'Mixed signals',
      emoji: '⚪',
    };
  } else if (score >= 20) {
    return {
      label: 'WEAKENING',
      color: '#FF8800',
      action: 'Negative drift',
      emoji: '🟠',
    };
  } else {
    return {
      label: 'COLD',
      color: '#FF3B3B',
      action: 'Narrative dead',
      emoji: '🔴',
    };
  }
}

/**
 * Get historical scores for charting
 */
export async function getHistoricalScores(days: number = 30): Promise<NarrativeScore[]> {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    const scores: NarrativeScore[] = data.scores || [];

    // Filter to requested time range
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return scores.filter(s => new Date(s.timestamp) >= cutoff);
  } catch (error) {
    console.error('[NarrativeIndex] Error reading history:', error);
    return [];
  }
}

/**
 * Append a score to history
 */
export async function appendScoreToHistory(score: NarrativeScore): Promise<void> {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let data = { scores: [] as NarrativeScore[] };

    if (fs.existsSync(HISTORY_FILE)) {
      data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }

    // Add new score
    data.scores.push(score);

    // Keep only last 365 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    data.scores = data.scores.filter(s => new Date(s.timestamp) >= cutoff);

    // Write back
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));

    console.log(`[NarrativeIndex] Appended score to history: ${score.overall}%`);
  } catch (error) {
    console.error('[NarrativeIndex] Error writing history:', error);
  }
}

/**
 * Get the latest score from history
 */
export async function getLatestScore(): Promise<NarrativeScore | null> {
  const scores = await getHistoricalScores(1);
  return scores.length > 0 ? scores[scores.length - 1] : null;
}

/**
 * Format amount as human-readable
 */
function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(0)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toString();
}
