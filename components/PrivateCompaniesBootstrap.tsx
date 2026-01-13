'use client';

import { useEffect, useState } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import type { PrivateCompany } from '@/types/companies';

/**
 * Client-only component to bootstrap private companies data.
 * Handles fetch and store population on mount.
 */
export default function PrivateCompaniesBootstrap() {
  const { setPrivateCompanies, privateCompanies } = useGlobeStore();
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Skip if already loaded
    if (privateCompanies.length > 0 || loadState !== 'idle') {
      return;
    }

    setLoadState('loading');
    console.log('[PrivateCompaniesBootstrap] Starting fetch for v2.json...');

    fetch('/data/private_companies.v2.json', { cache: 'no-store' })
      .then((res) => {
        console.log('[PrivateCompaniesBootstrap] Fetch status:', res.status, res.statusText);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        // Validate response is an array
        if (!Array.isArray(data)) {
          const type = typeof data;
          console.error('[PrivateCompaniesBootstrap] Invalid dataset format, expected array, got:', type);
          throw new Error(`Invalid dataset format: expected array, got ${type}`);
        }

        console.log('[PrivateCompaniesBootstrap] Fetch success - array length:', data.length);
        if (data.length > 0) {
          console.log('[PrivateCompaniesBootstrap] First 3 companies:');
          (data as PrivateCompany[]).slice(0, 3).forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.name} - lat: ${c.hq?.lat}, lon: ${c.hq?.lon}, fundingRounds: ${c.fundingRounds?.length || 0}`);
          });
        }

        setPrivateCompanies(data as PrivateCompany[]);
        setLoadState('success');
        console.log('[PrivateCompaniesBootstrap] Private companies set in store, length:', data.length);
      })
      .catch((err) => {
        console.error('[PrivateCompaniesBootstrap] Failed to load private companies:', err);
        setLoadState('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });
  }, [setPrivateCompanies, privateCompanies.length]);

  // This component doesn't render anything
  return null;
}

