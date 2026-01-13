'use client';

import { useEffect, useRef } from 'react';

export default function StarsBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const numStars = 150;
    const numComets = 1; // Much fewer comets

    // Create stars
    for (let i = 0; i < numStars; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      container.appendChild(star);
    }

    // Create comets - shoot diagonally from corners
    const directions = [
      { startX: -2, startY: -2, animation: 'comet-tl-br' }, // Top-left to bottom-right
      { startX: 102, startY: -2, animation: 'comet-tr-bl' }, // Top-right to bottom-left
      { startX: -2, startY: 102, animation: 'comet-bl-tr' }, // Bottom-left to top-right
      { startX: 102, startY: 102, animation: 'comet-br-tl' }, // Bottom-right to top-left
    ];

    for (let i = 0; i < numComets; i++) {
      const comet = document.createElement('div');
      comet.className = 'comet';
      
      // Randomly pick a direction
      const dir = directions[Math.floor(Math.random() * directions.length)];
      
      comet.style.left = `${dir.startX}%`;
      comet.style.top = `${dir.startY}%`;
      comet.style.animationDelay = `${Math.random() * 25 + 15}s`; // Very random: 15-40 seconds
      comet.style.animationName = dir.animation;
      
      container.appendChild(comet);
    }

    return () => {
      // Cleanup
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    />
  );
}

