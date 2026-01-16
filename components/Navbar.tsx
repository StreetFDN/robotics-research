'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function Navbar() {
  const [activeLink, setActiveLink] = useState('dashboard');

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'companies', label: 'Companies' },
    { id: 'events', label: 'Events' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-black/40 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-[1920px] mx-auto h-full px-6 flex items-center justify-between">
        {/* Street Logo + Brand */}
        <div className="flex items-center gap-3">
          <Image
            src="/street-logo.png"
            alt="Street"
            width={100}
            height={24}
            className="h-6 w-auto object-contain brightness-0 invert opacity-90"
          />
          <div className="w-px h-4 bg-white/20" />
          <span className="text-[12px] font-medium text-white/60 tracking-wide">
            Robotics Intel
          </span>
          <span className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/50">
            v1.0.0
          </span>
        </div>

        {/* Navigation Links - Refined */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveLink(link.id)}
              className={`
                px-3 py-1.5 text-[11px] uppercase font-medium tracking-wide
                rounded transition-all duration-150
                ${activeLink === link.id
                  ? 'text-white bg-white/10'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Status Pill - Glass Style */}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-[#00C957] animate-pulse" />
          <span className="text-[10px] font-mono text-white/70">
            LIVE
          </span>
        </div>
      </div>
    </nav>
  );
}


