/**
 * Government contract types for the Robotics Intelligence Globe
 *
 * Used to display federal contract data from USASpending.gov API.
 * Tracks defense, research, and commercial contracts awarded to
 * robotics and autonomous systems companies.
 */

/**
 * Place of performance details for a contract
 */
export interface ContractPlaceOfPerformance {
  /** City name */
  city: string;
  /** State code (e.g., "CA", "MA") */
  state: string;
  /** Country code (e.g., "USA") */
  country: string;
}

/**
 * A federal government contract award
 */
export interface Contract {
  /** Internal unique identifier */
  id: string;
  /** USASpending award ID (e.g., "CONT_AWD_...") */
  awardId: string;
  /** Name of the company/organization receiving the contract */
  recipientName: string;
  /** USASpending recipient identifier */
  recipientId: string;
  /** Total award amount in USD */
  awardAmount: number;
  /** Total obligations (actual spending) in USD */
  totalObligations: number;
  /** Contract description/scope of work */
  description: string;
  /** Date the contract was awarded (ISO format) */
  awardDate: string;
  /** Contract start date (ISO format) */
  startDate: string;
  /** Contract end date (ISO format) */
  endDate: string;
  /** Top-tier awarding agency (e.g., "Department of Defense") */
  agency: string;
  /** Sub-agency (e.g., "Army", "DARPA") */
  subAgency: string;
  /** Contract type code (e.g., "Firm Fixed Price") */
  contractType: string;
  /** NAICS industry code */
  naicsCode: string;
  /** NAICS industry description */
  naicsDescription: string;
  /** Where the work will be performed */
  placeOfPerformance: ContractPlaceOfPerformance;
}

/**
 * Agency breakdown entry for contract summary
 */
export interface AgencyContractBreakdown {
  /** Agency name */
  agency: string;
  /** Total amount awarded by this agency */
  amount: number;
  /** Number of contracts from this agency */
  count: number;
}

/**
 * Yearly trend entry for contract summary
 */
export interface YearlyContractTrend {
  /** Fiscal year */
  year: number;
  /** Total amount awarded that year */
  amount: number;
  /** Number of contracts that year */
  count: number;
}

/**
 * Summary of all contracts for a company
 */
export interface ContractSummary {
  /** Total value of all contracts in USD */
  totalAwarded: number;
  /** Total number of contracts */
  contractCount: number;
  /** Number of currently active contracts */
  activeContracts: number;
  /** Agency with the most contract value */
  topAgency: string;
  /** Percentage of total value from top agency */
  topAgencyPercent: number;
  /** Year-over-year change in contract value (percentage) */
  yearOverYearChange: number;
  /** List of individual contracts (top 10) */
  contracts: Contract[];
  /** Breakdown by awarding agency (top 5) */
  agencyBreakdown: AgencyContractBreakdown[];
  /** Yearly trend data */
  yearlyTrend: YearlyContractTrend[];
}

/**
 * Search parameters for contract queries
 */
export interface ContractSearchParams {
  /** Keyword to search in contract descriptions */
  keyword?: string;
  /** Recipient/company name filter */
  recipientName?: string;
  /** Awarding agency filter */
  agency?: string;
  /** Minimum award amount in USD */
  minAmount?: number;
  /** Start date for search range (ISO format) */
  startDate?: string;
  /** End date for search range (ISO format) */
  endDate?: string;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Result from a contract search
 */
export interface ContractSearchResult {
  /** Array of matching contracts */
  contracts: Contract[];
  /** Total number of matching contracts (may exceed returned results) */
  total: number;
  /** Error message if search failed */
  error?: string;
}

/**
 * Contract value tiers for categorization
 */
export type ContractTier = 'mega' | 'large' | 'medium' | 'small';

/**
 * Thresholds for contract tier classification (in USD)
 */
export const CONTRACT_TIER_THRESHOLDS: Record<ContractTier, number> = {
  mega: 100_000_000,    // $100M+
  large: 10_000_000,    // $10M+
  medium: 1_000_000,    // $1M+
  small: 0,             // <$1M
};

/**
 * Get contract tier from award amount
 */
export function getContractTier(amount: number): ContractTier {
  if (amount >= CONTRACT_TIER_THRESHOLDS.mega) return 'mega';
  if (amount >= CONTRACT_TIER_THRESHOLDS.large) return 'large';
  if (amount >= CONTRACT_TIER_THRESHOLDS.medium) return 'medium';
  return 'small';
}

/**
 * Format contract amount for display
 */
export function formatContractAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Major government agencies relevant to robotics contracts
 */
export const MAJOR_AGENCIES = [
  'Department of Defense',
  'Department of the Army',
  'Department of the Navy',
  'Department of the Air Force',
  'Defense Advanced Research Projects Agency',
  'National Aeronautics and Space Administration',
  'Department of Homeland Security',
  'Department of Energy',
] as const;

export type MajorAgency = typeof MAJOR_AGENCIES[number];
