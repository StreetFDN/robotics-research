import { Company, Event } from '@/types';

/**
 * Validate company data before adding
 */
export function validateCompany(company: Partial<Company>): string[] {
  const errors: string[] = [];

  if (!company.name) errors.push('Company name is required');
  if (!company.id) errors.push('Company ID is required');
  if (company.hq_lat === undefined || company.hq_lat === null) {
    errors.push('Headquarters latitude is required');
  } else if (company.hq_lat < -90 || company.hq_lat > 90) {
    errors.push('Latitude must be between -90 and 90');
  }
  if (company.hq_lon === undefined || company.hq_lon === null) {
    errors.push('Headquarters longitude is required');
  } else if (company.hq_lon < -180 || company.hq_lon > 180) {
    errors.push('Longitude must be between -180 and 180');
  }

  return errors;
}

/**
 * Create a new company with defaults
 */
export function createCompany(data: Partial<Company>): Company {
  return {
    id: data.id || `company-${Date.now()}`,
    name: data.name || 'Unknown Company',
    tags: data.tags || [],
    hq_lat: data.hq_lat ?? 0,
    hq_lon: data.hq_lon ?? 0,
    locations: data.locations || [],
    website: data.website,
    socials: data.socials,
    description: data.description,
    latestActivity: data.latestActivity || new Date(),
    activityScore: data.activityScore || 0,
  };
}

/**
 * Calculate activity score based on recent events
 */
export function calculateActivityScore(
  company: Company,
  events: Event[],
  days: number = 30
): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentEvents = events.filter(
    (e) => e.company_id === company.id && e.timestamp >= cutoffDate
  );

  const severityScores = { high: 10, medium: 5, low: 2 };
  const typeScores = {
    funding: 15,
    product: 12,
    partnership: 8,
    hiring: 5,
    research: 6,
    patent: 4,
    other: 2,
  };

  let score = 0;
  recentEvents.forEach((event) => {
    score += typeScores[event.type] || 2;
    if (event.severity) {
      score += severityScores[event.severity];
    }
  });

  // Normalize to 0-100
  return Math.min(100, score);
}

/**
 * Get companies in a geographic region
 */
export function getCompaniesInRegion(
  companies: Company[],
  centerLat: number,
  centerLon: number,
  radiusKm: number = 100
): Company[] {
  // Simple distance calculation (Haversine formula approximation)
  return companies.filter((company) => {
    const latDiff = (company.hq_lat - centerLat) * 111; // ~111 km per degree latitude
    const lonDiff =
      (company.hq_lon - centerLon) * 111 * Math.cos((centerLat * Math.PI) / 180);
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    return distance <= radiusKm;
  });
}

