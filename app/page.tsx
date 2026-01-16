'use client';

import { useEffect } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { mockCompanies, mockEvents } from '@/data/mockData';
import GlobeScene from '@/components/GlobeScene';
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
  const { setCompanies, setEvents, privateCompanies } = useGlobeStore();

  useEffect(() => {
    setCompanies(mockCompanies);
    setEvents(mockEvents);
  }, [setCompanies, setEvents]);

  return (
    <div className="w-screen bg-background overflow-y-auto" style={{ height: '100vh' }}>
      {/* Bootstrap private companies data */}
      <PrivateCompaniesBootstrap />
      {/* Navbar */}
      <Navbar />
      {/* Main dashboard area - fixed viewport height */}
      <main className="h-screen w-screen flex overflow-hidden pt-14 pb-14">
        {/* Left sidebar - Company list + Polymarket Signal */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <CompanyList />
          </div>
          <PolymarketSignal />
        </div>

        {/* Center column - Globe and Heatmap */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Globe section */}
          <div className="flex-1 relative min-h-0">
            <div className="absolute inset-0">
              <GlobeScene />
            </div>
            {/* HUD overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
              <div className="glass rounded-lg p-4 pointer-events-auto">
                <h1 className="text-headline text-white mb-1">Robotics Intelligence</h1>
                <div className="text-caption text-gray-500">Live Event Library</div>
              </div>
              <div className="glass rounded-lg p-4 text-body text-gray-400 pointer-events-auto space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-label text-gray-500">Companies:</span>
                  <span className="text-body text-white font-mono">{mockCompanies.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label text-gray-500">Events:</span>
                  <span className="text-body text-white font-mono">{mockEvents.length}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-caption text-accent font-mono">SYSTEM ACTIVE</span>
                </div>
                {/* Debug: Private companies count */}
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                  <span className="text-label text-gray-500">Private:</span>
                  <span className="text-body text-teal-400 font-mono">{privateCompanies.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap section - clearly separated */}
          <div className="h-80 flex-shrink-0 border-t-2 border-white/10 flex flex-col">
            <div className="px-6 py-4 border-b border-white/10 glass-subtle flex-shrink-0">
              <h2 className="text-subheadline font-semibold text-white">
                Global Robotics Power Concentration
              </h2>
              <div className="text-caption text-gray-500 mt-1">Strategic Intelligence Heatmap</div>
            </div>
            <div className="flex-1 flex min-h-0">
              {/* Left column: Strategic Power Stats */}
              <div className="w-[400px] flex-shrink-0">
                <StrategicPowerStats />
              </div>
              {/* Right column: Heatmap */}
              <div className="flex-1 relative min-w-0" style={{ minHeight: 0 }}>
                <HeatmapMap />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Company Details + Indices + Event stream */}
        <div className="w-96 flex-shrink-0 flex flex-col">
          {/* Company Details Panel - appears when hovering over a company */}
          <CompanyDetailsPanel />
          {/* Both sections should total 320px (h-80) to match heatmap - ETF Index on top, Crypto below */}
          <div className="flex flex-col" style={{ height: '320px' }}>
            <ETFComparisonChart />
            <RoboticsCryptoIndex />
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
