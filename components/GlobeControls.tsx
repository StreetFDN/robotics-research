'use client';

import { useGlobeStore } from '@/store/globeStore';

export default function GlobeControls() {
  const { showGrid, showArcs, showNodes, showPrivateCompanies, setShowGrid, setShowArcs, setShowNodes, setShowPrivateCompanies } = useGlobeStore();

  return (
    <div className="bg-surface/80 backdrop-blur-sm border border-gray-800 rounded p-3 text-xs">
      <div className="text-gray-300 font-semibold mb-2">Globe Controls</div>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-200">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-teal-500 focus:ring-teal-500 focus:ring-1"
          />
          <span>Grid</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-200">
          <input
            type="checkbox"
            checked={showArcs}
            onChange={(e) => setShowArcs(e.target.checked)}
            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-teal-500 focus:ring-teal-500 focus:ring-1"
          />
          <span>Arcs</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-200">
          <input
            type="checkbox"
            checked={showNodes}
            onChange={(e) => setShowNodes(e.target.checked)}
            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-teal-500 focus:ring-teal-500 focus:ring-1"
          />
          <span>Nodes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-200">
          <input
            type="checkbox"
            checked={showPrivateCompanies}
            onChange={(e) => setShowPrivateCompanies(e.target.checked)}
            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-teal-500 focus:ring-teal-500 focus:ring-1"
          />
          <span className="text-teal-300">Private Companies</span>
        </label>
      </div>
    </div>
  );
}

