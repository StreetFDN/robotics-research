// Mapping of company IDs to Polymarket market slugs
// Users can add mappings via the UI, which will be stored in localStorage
export const POLYMARKET_MAPPINGS: Record<string, string> = {
  // Example mappings (can be extended)
  // '1': 'will-boston-dynamics-release-new-atlas-robot-2024',
  // '2': 'will-tesla-optimus-be-commercially-available-2024',
};

// Get market slug for a company
export function getMarketSlug(companyId: string): string | null {
  // Check localStorage first (user-added mappings)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`polymarket_${companyId}`);
      if (stored) return stored;
    } catch {
      // Ignore localStorage errors
    }
  }
  
  // Fall back to hardcoded mappings
  return POLYMARKET_MAPPINGS[companyId] || null;
}

// Set market slug for a company (stores in localStorage)
export function setMarketSlug(companyId: string, slug: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`polymarket_${companyId}`, slug);
    } catch {
      // Ignore localStorage errors
    }
  }
}

// Extract slug from Polymarket URL
export function extractSlugFromUrl(url: string): string | null {
  try {
    // Handle formats like:
    // https://polymarket.com/event/will-tesla-optimus-be-commercially-available-2024
    // https://polymarket.com/market/will-tesla-optimus-be-commercially-available-2024
    const match = url.match(/polymarket\.com\/(?:event|market)\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

