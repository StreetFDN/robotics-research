/**
 * USASpending.gov API Client
 * Free API for federal government contract data
 * Docs: https://api.usaspending.gov/
 */

const USASPENDING_BASE = 'https://api.usaspending.gov/api/v2';

// Cache configuration
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const contractCache = new Map<string, CacheEntry<ContractSummary>>();
const searchCache = new Map<string, CacheEntry<{ contracts: Contract[]; total: number }>>();

// Robotics-related keywords for contract search
const ROBOTICS_KEYWORDS = [
  'robotics', 'robot', 'autonomous', 'unmanned', 'drone', 'UAS', 'UAV',
  'humanoid', 'exoskeleton', 'legged locomotion', 'manipulation',
  'computer vision', 'machine learning', 'artificial intelligence',
  'Boston Dynamics', 'Figure AI', 'Agility Robotics', 'Anduril',
  'Shield AI', 'Sarcos', 'Ghost Robotics', 'Skydio'
];

export interface Contract {
  id: string;
  awardId: string;
  recipientName: string;
  recipientId: string;
  awardAmount: number;
  totalObligations: number;
  description: string;
  awardDate: string;
  startDate: string;
  endDate: string;
  agency: string;
  subAgency: string;
  contractType: string;
  naicsCode: string;
  naicsDescription: string;
  placeOfPerformance: {
    city: string;
    state: string;
    country: string;
  };
}

export interface ContractSummary {
  totalAwarded: number;
  contractCount: number;
  activeContracts: number;
  topAgency: string;
  topAgencyPercent: number;
  yearOverYearChange: number;
  contracts: Contract[];
  agencyBreakdown: Array<{ agency: string; amount: number; count: number }>;
  yearlyTrend: Array<{ year: number; amount: number; count: number }>;
}

export interface SearchParams {
  keyword?: string;
  recipientName?: string;
  agency?: string;
  minAmount?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Normalize company name by removing common suffixes
 */
function normalizeCompanyName(name: string): string[] {
  const base = name.toLowerCase().trim();
  const suffixes = [', inc.', ', inc', ' inc.', ' inc', ', llc', ' llc', ', corp.', ' corp.', ', corp', ' corp', ' corporation', ', ltd', ' ltd', ' limited', ' technologies', ' robotics', ' ai'];

  const variations: string[] = [base];

  // Remove suffixes to get base name
  let cleanName = base;
  for (const suffix of suffixes) {
    if (cleanName.endsWith(suffix)) {
      cleanName = cleanName.slice(0, -suffix.length).trim();
      variations.push(cleanName);
    }
  }

  // Add variations with common suffixes
  if (cleanName !== base) {
    variations.push(cleanName + ' inc');
    variations.push(cleanName + ' llc');
    variations.push(cleanName + ' corp');
  }

  return [...new Set(variations)];
}

/**
 * Search for contracts by keyword
 */
export async function searchContracts(params: SearchParams): Promise<{ contracts: Contract[]; total: number; error?: string }> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = JSON.stringify(params);
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[USASpending] Cache hit for search:', params.keyword || params.recipientName);
    return { contracts: cached.data.contracts, total: cached.data.total };
  }

  try {
    const filters: any = {
      award_type_codes: ['A', 'B', 'C', 'D'], // Contracts only (not grants)
    };

    // Add keyword filter
    if (params.keyword) {
      filters.keywords = [params.keyword];
    }

    // Add recipient name filter
    if (params.recipientName) {
      filters.recipient_search_text = [params.recipientName];
    }

    // Add agency filter
    if (params.agency) {
      filters.agencies = [{
        type: 'awarding',
        tier: 'toptier',
        name: params.agency
      }];
    }

    // Add amount filter
    if (params.minAmount) {
      filters.award_amounts = [{
        lower_bound: params.minAmount
      }];
    }

    // Add date range
    if (params.startDate || params.endDate) {
      filters.time_period = [{
        start_date: params.startDate || '2020-01-01',
        end_date: params.endDate || new Date().toISOString().split('T')[0]
      }];
    }

    const response = await fetch(`${USASPENDING_BASE}/search/spending_by_award/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters,
        fields: [
          'Award ID',
          'Recipient Name',
          'Award Amount',
          'Total Outlays',
          'Description',
          'Start Date',
          'End Date',
          'Awarding Agency',
          'Awarding Sub Agency',
          'Contract Award Type',
          'NAICS Code',
          'NAICS Description',
          'Place of Performance City',
          'Place of Performance State',
          'Place of Performance Country'
        ],
        page: 1,
        limit: params.limit || 100,
        sort: 'Award Amount',
        order: 'desc'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[USASpending] Request failed:', response.status, errorText);

      // Improved error messages
      if (response.status === 429) {
        return { contracts: [], total: 0, error: 'Rate limit exceeded. Please try again in a few minutes.' };
      }
      if (response.status === 503 || response.status === 502) {
        return { contracts: [], total: 0, error: 'USASpending.gov service temporarily unavailable. Try again later.' };
      }
      if (response.status >= 500) {
        return { contracts: [], total: 0, error: 'USASpending.gov server error. Please try again later.' };
      }
      return { contracts: [], total: 0, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    const contracts: Contract[] = (data.results || []).map((item: any) => ({
      id: item['Award ID'] || item['internal_id'],
      awardId: item['Award ID'],
      recipientName: item['Recipient Name'],
      recipientId: item['recipient_id'],
      awardAmount: item['Award Amount'] || 0,
      totalObligations: item['Total Outlays'] || item['Award Amount'] || 0,
      description: item['Description'] || '',
      awardDate: item['Start Date'],
      startDate: item['Start Date'],
      endDate: item['End Date'],
      agency: item['Awarding Agency'] || '',
      subAgency: item['Awarding Sub Agency'] || '',
      contractType: item['Contract Award Type'] || '',
      naicsCode: item['NAICS Code'] || '',
      naicsDescription: item['NAICS Description'] || '',
      placeOfPerformance: {
        city: item['Place of Performance City'] || '',
        state: item['Place of Performance State'] || '',
        country: item['Place of Performance Country'] || 'USA'
      }
    }));

    const result = {
      contracts,
      total: data.page_metadata?.total || contracts.length
    };

    // Cache the result
    searchCache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Log response time
    const elapsed = Date.now() - startTime;
    console.log(`[USASpending] Search completed in ${elapsed}ms, found ${contracts.length} contracts`);

    // Clean up old cache entries
    if (searchCache.size > 50) {
      const cutoff = Date.now() - CACHE_TTL_MS * 2;
      for (const [key, entry] of searchCache.entries()) {
        if (entry.timestamp < cutoff) {
          searchCache.delete(key);
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('[USASpending] Fetch error:', error);
    return { contracts: [], total: 0, error: error.message };
  }
}

// Map company names to known recipient names in USASpending
const COMPANY_RECIPIENT_MAP: Record<string, string[]> = {
  'boston dynamics': ['boston dynamics', 'hyundai', 'softbank'],
  'figure ai': ['figure ai', 'figure'],
  'agility robotics': ['agility robotics', 'agility'],
  'anduril': ['anduril', 'anduril industries'],
  'shield ai': ['shield ai'],
  'sarcos': ['sarcos', 'sarcos robotics', 'sarcos technology'],
  'ghost robotics': ['ghost robotics'],
  'skydio': ['skydio'],
  'intuitive surgical': ['intuitive surgical'],
  'irobot': ['irobot'],
  'northrop grumman': ['northrop grumman'],
  'lockheed martin': ['lockheed martin'],
  'general dynamics': ['general dynamics'],
  'raytheon': ['raytheon', 'rtx'],
  'boeing': ['boeing'],
  'tesla': ['tesla', 'spacex'],
  '1x technologies': ['1x', '1x technologies'],
  'sanctuary ai': ['sanctuary ai', 'sanctuary'],
  'apptronik': ['apptronik'],
  'unitree': ['unitree'],
};

/**
 * Search for contracts by company/recipient name
 * Uses multiple search strategies to find matches
 */
export async function getCompanyContracts(companyName: string): Promise<ContractSummary> {
  const startTime = Date.now();
  const normalizedName = companyName.toLowerCase().trim();

  // Check cache first
  const cacheKey = `company:${normalizedName}`;
  const cached = contractCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[USASpending] Cache hit for company: ${companyName}`);
    return cached.data;
  }

  // Get search terms for this company (known mappings + variations)
  const knownTerms = COMPANY_RECIPIENT_MAP[normalizedName] || [];
  const variations = normalizeCompanyName(companyName);
  const searchTerms = [...new Set([...knownTerms, ...variations])];

  console.log(`[USASpending] Searching contracts for "${companyName}" with terms:`, searchTerms.slice(0, 5));

  let allContracts: Contract[] = [];

  // Strategy 1: Try recipient name search with each term
  for (const term of searchTerms) {
    const { contracts } = await searchContracts({
      recipientName: term,
      startDate: '2015-01-01',
      limit: 100
    });
    if (contracts.length > 0) {
      allContracts = [...allContracts, ...contracts];
    }
  }

  // Strategy 2: Try keyword search in description
  if (allContracts.length === 0) {
    const { contracts } = await searchContracts({
      keyword: companyName,
      startDate: '2015-01-01',
      limit: 100
    });
    allContracts = contracts;
  }

  // Deduplicate by award ID
  const seenIds = new Set<string>();
  const contracts = allContracts.filter(c => {
    if (seenIds.has(c.awardId)) return false;
    seenIds.add(c.awardId);
    return true;
  });

  if (contracts.length === 0) {
    return {
      totalAwarded: 0,
      contractCount: 0,
      activeContracts: 0,
      topAgency: 'N/A',
      topAgencyPercent: 0,
      yearOverYearChange: 0,
      contracts: [],
      agencyBreakdown: [],
      yearlyTrend: []
    };
  }

  // Calculate summary stats
  const totalAwarded = contracts.reduce((sum, c) => sum + c.awardAmount, 0);
  const now = new Date();
  const activeContracts = contracts.filter(c => {
    if (!c.endDate) return true;
    return new Date(c.endDate) > now;
  }).length;

  // Agency breakdown
  const agencyMap = new Map<string, { amount: number; count: number }>();
  contracts.forEach(c => {
    const agency = c.agency || 'Unknown';
    const existing = agencyMap.get(agency) || { amount: 0, count: 0 };
    agencyMap.set(agency, {
      amount: existing.amount + c.awardAmount,
      count: existing.count + 1
    });
  });

  const agencyBreakdown = Array.from(agencyMap.entries())
    .map(([agency, data]) => ({ agency, ...data }))
    .sort((a, b) => b.amount - a.amount);

  const topAgency = agencyBreakdown[0]?.agency || 'N/A';
  const topAgencyPercent = totalAwarded > 0
    ? Math.round((agencyBreakdown[0]?.amount || 0) / totalAwarded * 100)
    : 0;

  // Yearly trend
  const yearMap = new Map<number, { amount: number; count: number }>();
  contracts.forEach(c => {
    const year = new Date(c.startDate || c.awardDate).getFullYear();
    if (year >= 2018 && year <= now.getFullYear()) {
      const existing = yearMap.get(year) || { amount: 0, count: 0 };
      yearMap.set(year, {
        amount: existing.amount + c.awardAmount,
        count: existing.count + 1
      });
    }
  });

  const yearlyTrend = Array.from(yearMap.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year - b.year);

  // Year over year change
  const currentYear = now.getFullYear();
  const lastYear = yearlyTrend.find(y => y.year === currentYear - 1)?.amount || 0;
  const thisYear = yearlyTrend.find(y => y.year === currentYear)?.amount || 0;
  const yearOverYearChange = lastYear > 0 ? Math.round((thisYear - lastYear) / lastYear * 100) : 0;

  const result: ContractSummary = {
    totalAwarded,
    contractCount: contracts.length,
    activeContracts,
    topAgency,
    topAgencyPercent,
    yearOverYearChange,
    contracts: contracts.slice(0, 10), // Return top 10
    agencyBreakdown: agencyBreakdown.slice(0, 5), // Top 5 agencies
    yearlyTrend
  };

  // Cache the result
  contractCache.set(cacheKey, { data: result, timestamp: Date.now() });

  // Log response time
  const elapsed = Date.now() - startTime;
  console.log(`[USASpending] Company contracts lookup completed in ${elapsed}ms for "${companyName}"`);

  // Clean up old cache entries
  if (contractCache.size > 30) {
    const cutoff = Date.now() - CACHE_TTL_MS * 2;
    for (const [key, entry] of contractCache.entries()) {
      if (entry.timestamp < cutoff) {
        contractCache.delete(key);
      }
    }
  }

  return result;
}

/**
 * Search for all robotics-related contracts
 */
export async function searchRoboticsContracts(options?: {
  minAmount?: number;
  days?: number;
  limit?: number;
}): Promise<{ contracts: Contract[]; total: number; error?: string }> {
  const { minAmount = 100000, days = 365, limit = 50 } = options || {};

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Search for robotics keyword
  return searchContracts({
    keyword: 'robotics OR autonomous OR unmanned systems OR robot',
    minAmount,
    startDate: startDate.toISOString().split('T')[0],
    limit
  });
}

/**
 * Get agency spending breakdown for robotics
 */
export async function getRoboticsAgencySpending(): Promise<Array<{ agency: string; amount: number; count: number }>> {
  const { contracts } = await searchRoboticsContracts({ limit: 200 });

  const agencyMap = new Map<string, { amount: number; count: number }>();
  contracts.forEach(c => {
    const agency = c.agency || 'Unknown';
    const existing = agencyMap.get(agency) || { amount: 0, count: 0 };
    agencyMap.set(agency, {
      amount: existing.amount + c.awardAmount,
      count: existing.count + 1
    });
  });

  return Array.from(agencyMap.entries())
    .map(([agency, data]) => ({ agency, ...data }))
    .sort((a, b) => b.amount - a.amount);
}
