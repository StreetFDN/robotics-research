'use client';

/**
 * Footer - Street Foundation Styling
 * Premium intel terminal aesthetic
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/60 backdrop-blur-xl fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Copyright */}
          <div className="text-[9px] text-white/30 font-mono">
            © {new Date().getFullYear()} Robotics Intelligence
          </div>

          {/* Center: Links with separator dots */}
          <div className="flex items-center">
            <a href="#" className="text-[11px] text-white/50 hover:text-white transition-colors">
              Documentation
            </a>
            <span className="text-white/20 mx-2">•</span>
            <a href="#" className="text-[11px] text-white/50 hover:text-white transition-colors">
              API
            </a>
            <span className="text-white/20 mx-2">•</span>
            <a href="#" className="text-[11px] text-white/50 hover:text-white transition-colors">
              Support
            </a>
          </div>

          {/* Right: Version */}
          <div className="text-[9px] text-white/30 font-mono">
            v1.0.0
          </div>
        </div>
      </div>
    </footer>
  );
}
