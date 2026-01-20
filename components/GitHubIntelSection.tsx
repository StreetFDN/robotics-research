'use client';

import { useState } from 'react';
import GitHubLeaderboard from './GitHubLeaderboard';
import TrendingRepos from './TrendingRepos';
import TechStackAnalysis from './TechStackAnalysis';
import ReleaseRadar from './ReleaseRadar';
import ContributorFlow from './ContributorFlow';

const TABS = [
  { id: 'leaderboard', label: 'LEADERBOARD', icon: '🏆' },
  { id: 'trending', label: 'TRENDING', icon: '📈' },
  { id: 'techstack', label: 'TECH STACK', icon: '⚙️' },
  { id: 'releases', label: 'RELEASES', icon: '🚀' },
  { id: 'contributors', label: 'FLOW', icon: '👥' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * GitHubIntelSection - Sprint 5
 * Tabbed container for all GitHub Intelligence panels
 */
export default function GitHubIntelSection() {
  const [activeTab, setActiveTab] = useState<TabId>('leaderboard');

  return (
    <section className="py-8 px-4 bg-[#05060A]">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-sm bg-white/[0.04] flex items-center justify-center border border-white/[0.08]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/60">
              <path
                d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-[14px] font-medium uppercase tracking-[0.1em] text-white/80">
              GitHub Intelligence
            </h2>
            <p className="text-[11px] font-mono text-white/32">
              Open source activity across the robotics ecosystem
            </p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mt-4 border-b border-white/[0.06] pb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-colors relative ${
                activeTab === tab.id
                  ? 'text-[#00FFE0]'
                  : 'text-white/32 hover:text-white/48'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {/* Active indicator */}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Main Panel */}
          <div className="lg:col-span-1">
            {activeTab === 'leaderboard' && <GitHubLeaderboard />}
            {activeTab === 'trending' && <TrendingRepos />}
            {activeTab === 'techstack' && <TechStackAnalysis />}
            {activeTab === 'releases' && <ReleaseRadar />}
            {activeTab === 'contributors' && <ContributorFlow />}
          </div>

          {/* Secondary Panel - show complementary view */}
          <div className="lg:col-span-1">
            {activeTab === 'leaderboard' && <TrendingRepos />}
            {activeTab === 'trending' && <TechStackAnalysis />}
            {activeTab === 'techstack' && <GitHubLeaderboard />}
            {activeTab === 'releases' && <ContributorFlow />}
            {activeTab === 'contributors' && <ReleaseRadar />}
          </div>
        </div>
      </div>

      {/* Section Footer */}
      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[9px] font-mono text-white/24">
          <div className="flex items-center gap-4">
            <span>Data source: GitHub REST API</span>
            <span>•</span>
            <span>Tracked organizations: 15+</span>
            <span>•</span>
            <span>Cache: 1-24 hours</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
            <span>Auto-refresh enabled</span>
          </div>
        </div>
      </div>
    </section>
  );
}
