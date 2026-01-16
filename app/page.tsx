'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGlobeStore } from '@/store/globeStore';
import { mockCompanies, mockEvents } from '@/data/mockData';

// Dynamic import with SSR disabled to prevent hydration errors
// Three.js Canvas cannot be server-rendered
const GlobeScene = dynamic(() => import('@/components/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#05060A]/80">
      <div className="text-gray-500 text-sm">Loading globe...</div>
    </div>
  )
});
import CompanyList from '@/components/CompanyList';
import EventStream from '@/components/EventStream';
import HeatmapMap from '@/components/HeatmapMap';
import StrategicPowerStats from '@/components/StrategicPowerStats';
import PolymarketSignal from '@/components/PolymarketSignal';
import RoboticsCryptoIndex from '@/components/RoboticsCryptoIndex';
import ETFComparisonChart from '@/components/ETFComparisonChart';
import SingleStocksSection from '@/components/SingleStocksSection';
import StartupsSection from '@/components/StartupsSection';
import GlobeControls from '@/components/GlobeControls';
import PrivateCompaniesBootstrap from '@/components/PrivateCompaniesBootstrap';
import CompanyDetailsPanel from '@/components/CompanyDetailsPanel';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Home() {
  const { setCompanies, setEvents, privateCompanies, clearSelection, selectedPrivateCompany, hoveredPrivateCompany } = useGlobeStore();

  // Determine if we have a selected company for glow effect
  const hasSelection = !!selectedPrivateCompany;
  // Get hovered company coordinates for overlay
  const hoveredCoords = hoveredPrivateCompany?.hq;

  useEffect(() => {
    setCompanies(mockCompanies);
    setEvents(mockEvents);
  }, [setCompanies, setEvents]);

  // ESC key clears pinned selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  return (
    <div className="w-screen bg-[#05060A] overflow-y-auto" style={{ height: '100vh' }}>
      {/* Bootstrap private companies data */}
      <PrivateCompaniesBootstrap />
      {/* Navbar */}
      <Navbar />
      {/* Main dashboard area - fixed viewport height (navbar h-12 = 48px) */}
      <main className="h-screen w-screen flex overflow-hidden pt-12 pb-12">
        {/* Left sidebar - Company list + Polymarket Signal */}
        <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CompanyList />
          </div>
          <div className="flex-shrink-0">
            <PolymarketSignal />
          </div>
        </div>

        {/* Center column - Globe and Heatmap */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Globe section */}
          <div className="flex-1 relative min-h-0">
            <div
              className={`absolute inset-0 rounded-none border bg-[#08090C] transition-all duration-300 ${
                hasSelection
                  ? 'border-[#00FFE0]/30'
                  : 'border-white/[0.08]'
              }`}
              style={hasSelection ? { boxShadow: '0 0 20px rgba(0,255,224,0.15)' } : undefined}
            >
              <GlobeScene />
              {/* Coordinate overlay - shows lat/lng of hovered point */}
              {hoveredCoords && (
                <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/[0.24] pointer-events-none z-10">
                  {hoveredCoords.lat.toFixed(2)}° {hoveredCoords.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoveredCoords.lon).toFixed(2)}° {hoveredCoords.lon >= 0 ? 'E' : 'W'}
                </div>
              )}
            </div>
            {/* HUD overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
              <div className="glass rounded p-3 pointer-events-auto">
                <h1 className="text-headline text-white mb-1">Robotics Intelligence</h1>
                <div className="text-caption text-gray-500">Live Event Library</div>
              </div>
              <div className="glass rounded p-3 text-body text-gray-400 pointer-events-auto space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-label text-gray-500">Companies:</span>
                  <span className="text-body text-white font-mono">{mockCompanies.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label text-gray-500">Events:</span>
                  <span className="text-body text-white font-mono">{mockEvents.length}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-caption text-accent font-mono">SYSTEM ACTIVE</span>
                </div>
                {/* Debug: Private companies count */}
                <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2">
                  <span className="text-label text-gray-500">Private:</span>
                  <span className="text-body text-teal-400 font-mono">{privateCompanies.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap section - clearly separated */}
          <div className="h-80 flex-shrink-0 border-t border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] glass-subtle flex-shrink-0">
              <h2 className="text-subheadline font-semibold text-white">
                Global Robotics Power Concentration
              </h2>
              <div className="text-caption text-gray-500 mt-1">Strategic Intelligence Heatmap</div>
            </div>
            <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
              {/* Left column: Strategic Power Stats - shrinks on narrow viewports */}
              <div className="w-[400px] min-w-0 flex-shrink overflow-hidden">
                <StrategicPowerStats />
              </div>
              {/* Right column: Heatmap */}
              <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
                <HeatmapMap />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Company Details + Indices - fills height */}
        <div className="w-96 flex-shrink-0 flex flex-col h-full min-h-0">
          {/* Full-height flex container */}
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Company Details Panel - fixed height based on content */}
            <div className="flex-shrink-0">
              <CompanyDetailsPanel />
            </div>
            {/* Robotics Crypto Index - grows to fill available space */}
            <div className="flex-1 min-h-[200px]">
              <RoboticsCryptoIndex />
            </div>
            {/* ETF Comparison Chart - fixed height */}
            <div className="flex-shrink-0">
              <ETFComparisonChart />
            </div>
          </div>
        </div>
      </main>

      {/* Startups Section - appears below main dashboard when scrolling */}
      <StartupsSection />
      {/* Single Stocks Section - appears below main dashboard when scrolling */}
      <SingleStocksSection />
      {/* Footer */}
      <Footer />
    </div>
  );
}
