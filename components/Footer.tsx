'use client';

export default function Footer() {
  return (
    <footer className="glass-strong fixed bottom-0 left-0 right-0 z-50 border-t border-white/10">
      <div className="max-w-[1920px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Copyright */}
          <div className="text-caption text-gray-500">
            © {new Date().getFullYear()} Robotics Intelligence. All rights reserved.
          </div>

          {/* Center: Links */}
          <div className="flex items-center gap-6">
            <a href="#" className="text-caption text-gray-500 hover:text-white transition-colors">
              Documentation
            </a>
            <a href="#" className="text-caption text-gray-500 hover:text-white transition-colors">
              API
            </a>
            <a href="#" className="text-caption text-gray-500 hover:text-white transition-colors">
              Support
            </a>
          </div>

          {/* Right: Version */}
          <div className="text-caption text-gray-600 font-mono">
            v1.0.0
          </div>
        </div>
      </div>
    </footer>
  );
}

