'use client';

export default function Navbar() {
  return (
    <nav className="glass-strong fixed top-0 left-0 right-0 z-50 border-b border-white/10">
      <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-teal-400 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/90" />
          </div>
          <div>
            <div className="text-headline text-white font-semibold">Robotics Intelligence</div>
            <div className="text-caption text-gray-500">Live Event Library</div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <a href="#" className="text-body text-gray-400 hover:text-white transition-colors">
            Dashboard
          </a>
          <a href="#" className="text-body text-gray-400 hover:text-white transition-colors">
            Companies
          </a>
          <a href="#" className="text-body text-gray-400 hover:text-white transition-colors">
            Events
          </a>
          <a href="#" className="text-body text-gray-400 hover:text-white transition-colors">
            Analytics
          </a>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-caption text-gray-400 font-mono">SYSTEM ACTIVE</span>
        </div>
      </div>
    </nav>
  );
}

