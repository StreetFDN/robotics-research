/**
 * Utilities for mapping PrivateCompany to Company type
 */

import type { Company } from '@/types';
import type { PrivateCompany } from '@/types/companies';

/**
 * Convert PrivateCompany to Company type for use in CompanyList
 */
export function privateCompanyToCompany(privateCompany: PrivateCompany): Company {
  return {
    id: privateCompany.id,
    name: privateCompany.name,
    tags: privateCompany.tags || [],
    hq_lat: privateCompany.hq.lat,
    hq_lon: privateCompany.hq.lon,
    description: privateCompany.description,
    website: privateCompany.website,
    // Optional fields
    latestActivity: privateCompany.lastUpdated ? new Date(privateCompany.lastUpdated) : undefined,
    activityScore: undefined, // Private companies don't have activity scores
  };
}

/**
 * Merge private companies into the companies array for filtering/display
 */
export function mergePrivateCompanies(
  publicCompanies: Company[],
  privateCompanies: PrivateCompany[]
): Company[] {
  const mappedPrivate = privateCompanies.map(privateCompanyToCompany);
  return [...publicCompanies, ...mappedPrivate];
}


