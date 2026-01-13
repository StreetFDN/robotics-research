/**
 * Geocoding module for enriching company HQ locations
 * Supports: Mapbox, Google Geocoding API, Nominatim (OpenStreetMap)
 */

import * as fs from 'fs';
import * as path from 'path';

export type GeocoderProvider = 'mapbox' | 'google' | 'nominatim';

interface GeocodeCache {
  [key: string]: {
    lat: number;
    lon: number;
    confidence: 'high' | 'med' | 'low';
    source: string;
    resultType?: string;
    cachedAt: string;
  };
}

interface GeocodeResult {
  lat: number;
  lon: number;
  confidence: 'high' | 'med' | 'low';
  source: string;
  resultType?: string;
}

interface GeocodeInput {
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  existingLat?: number;
  existingLon?: number;
}

const CACHE_FILE = path.join(__dirname, 'geocode_cache.json');
const CACHE: GeocodeCache = loadCache();

// Rate limiting: requests per second
const RATE_LIMITS = {
  mapbox: 600, // 600 requests per minute (10/sec)
  google: 50, // 50 requests per second
  nominatim: 1, // 1 request per second (OSM rate limit)
};

let lastRequestTime: { [provider: string]: number } = {};
let requestCounts: { [provider: string]: number[] } = {};

/**
 * Load geocode cache from file
 */
function loadCache(): GeocodeCache {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to load geocode cache, starting fresh');
      return {};
    }
  }
  return {};
}

/**
 * Save geocode cache to file
 */
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save geocode cache:', error);
  }
}

/**
 * Normalize cache key from location fields
 */
function normalizeCacheKey(city?: string, region?: string, country?: string, address?: string): string {
  const parts: string[] = [];
  if (address) parts.push(address.trim().toLowerCase());
  if (city) parts.push(city.trim().toLowerCase());
  if (region) parts.push(region.trim().toLowerCase());
  if (country) parts.push(country.trim().toLowerCase());
  return parts.join(', ');
}

/**
 * Rate limiting: wait if needed
 */
async function rateLimit(provider: GeocoderProvider): Promise<void> {
  const limit = RATE_LIMITS[provider];
  const now = Date.now();
  
  if (!requestCounts[provider]) {
    requestCounts[provider] = [];
  }

  // Clean old requests (older than 1 second)
  requestCounts[provider] = requestCounts[provider].filter(t => now - t < 1000);

  // If at limit, wait
  if (requestCounts[provider].length >= limit) {
    const waitTime = 1000 - (now - requestCounts[provider][0]);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return rateLimit(provider); // Retry after waiting
    }
  }

  requestCounts[provider].push(Date.now());
  
  // Also add a minimum delay for Nominatim (1 request per second)
  if (provider === 'nominatim') {
    const lastRequest = lastRequestTime[provider] || 0;
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
    lastRequestTime[provider] = Date.now();
  }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Geocode using Mapbox
 */
async function geocodeMapbox(query: string, apiKey: string): Promise<GeocodeResult> {
  await rateLimit('mapbox');
  
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${apiKey}&limit=1`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    throw new Error('No results from Mapbox');
  }
  
  const feature = data.features[0];
  const [lon, lat] = feature.center;
  const resultType = feature.place_type?.[0] || '';
  
  let confidence: 'high' | 'med' | 'low' = 'low';
  if (resultType === 'address' || resultType === 'poi') {
    confidence = 'high';
  } else if (resultType === 'place' || resultType === 'postcode') {
    confidence = 'med';
  }
  
  return {
    lat,
    lon,
    confidence,
    source: 'geocoder_mapbox',
    resultType,
  };
}

/**
 * Geocode using Google Geocoding API
 */
async function geocodeGoogle(query: string, apiKey: string): Promise<GeocodeResult> {
  await rateLimit('google');
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
    throw new Error('No results from Google');
  }
  
  if (data.status !== 'OK') {
    throw new Error(`Google API error: ${data.status}`);
  }
  
  const result = data.results[0];
  const location = result.geometry.location;
  const resultType = result.types[0] || '';
  
  let confidence: 'high' | 'med' | 'low' = 'low';
  if (resultType === 'street_address' || resultType === 'premise' || resultType === 'point_of_interest') {
    confidence = 'high';
  } else if (resultType === 'locality' || resultType === 'administrative_area_level_1') {
    confidence = 'med';
  }
  
  return {
    lat: location.lat,
    lon: location.lng,
    confidence,
    source: 'geocoder_google',
    resultType,
  };
}

/**
 * Geocode using Nominatim (OpenStreetMap)
 */
async function geocodeNominatim(query: string): Promise<GeocodeResult> {
  await rateLimit('nominatim');
  
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&email=${encodeURIComponent('noreply@example.com')}`;
  
  const headers = {
    'User-Agent': 'RoboticsGlobe/1.0',
  };
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error('No results from Nominatim');
  }
  
  const result = data[0];
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);
  const resultType = result.type || result.class || '';
  
  let confidence: 'high' | 'med' | 'low' = 'low';
  if (resultType === 'house' || resultType === 'building' || resultType === 'place') {
    confidence = 'high';
  } else if (resultType === 'administrative' || resultType === 'boundary') {
    confidence = 'med';
  }
  
  return {
    lat,
    lon,
    confidence,
    source: 'geocoder_nominatim',
    resultType,
  };
}

/**
 * Geocode a location using the configured provider
 */
async function geocodeLocation(
  query: string,
  provider: GeocoderProvider,
  apiKey?: string
): Promise<GeocodeResult> {
  return retryWithBackoff(async () => {
    switch (provider) {
      case 'mapbox':
        if (!apiKey) throw new Error('Mapbox API key required');
        return geocodeMapbox(query, apiKey);
      case 'google':
        if (!apiKey) throw new Error('Google API key required');
        return geocodeGoogle(query, apiKey);
      case 'nominatim':
        return geocodeNominatim(query);
      default:
        throw new Error(`Unknown geocoder provider: ${provider}`);
    }
  });
}

/**
 * Geocode company location with caching and priority logic
 */
export async function geocodeCompany(input: GeocodeInput, provider: GeocoderProvider, apiKey?: string): Promise<GeocodeResult | null> {
  // Priority 1: If CSV already has lat/lon -> use directly
  if (input.existingLat !== undefined && input.existingLon !== undefined) {
    const lat = input.existingLat;
    const lon = input.existingLon;
    // Only use if not 0,0 (already handled in QA cleanup)
    if (lat !== 0 || lon !== 0) {
      return {
        lat,
        lon,
        confidence: 'high',
        source: 'csv',
      };
    }
  }

  // Build cache key and check cache
  const cacheKey = normalizeCacheKey(input.city, input.region, input.country, input.address);
  if (CACHE[cacheKey]) {
    const cached = CACHE[cacheKey];
    return {
      lat: cached.lat,
      lon: cached.lon,
      confidence: cached.confidence,
      source: cached.source,
      resultType: cached.resultType,
    };
  }

  // Build geocode query based on priority
  let query: string | null = null;
  let priority = 'none';
  
  // Priority 2: Full HQ address
  if (input.address) {
    query = input.address;
    priority = 'address';
  }
  // Priority 3: City + country
  else if (input.city && input.country) {
    query = `${input.city}, ${input.country}`;
    priority = 'city';
  }
  // Priority 4: Country only
  else if (input.country) {
    query = input.country;
    priority = 'country';
  }

  if (!query) {
    return null; // No coords
  }

  try {
    // Geocode the location
    const result = await geocodeLocation(query, provider, apiKey);
    
    // Adjust confidence based on priority
    if (priority === 'country') {
      result.confidence = 'low';
    } else if (priority === 'city' && result.confidence === 'high') {
      result.confidence = 'med'; // City centroid shouldn't be high
    } else if (priority === 'address' && result.confidence === 'low') {
      result.confidence = 'med'; // Address should be at least med
    }
    
    // Cache the result
    CACHE[cacheKey] = {
      lat: result.lat,
      lon: result.lon,
      confidence: result.confidence,
      source: result.source,
      resultType: result.resultType,
      cachedAt: new Date().toISOString(),
    };
    
    return result;
  } catch (error) {
    console.warn(`Geocoding failed for "${query}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Save cache and cleanup
 */
export function finalizeGeocoding() {
  saveCache();
}

