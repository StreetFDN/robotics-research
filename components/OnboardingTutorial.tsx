'use client';

import { useState, useEffect, useCallback } from 'react';

interface TutorialStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'globe',
    target: '[data-tutorial="globe"]',
    title: 'Interactive Globe',
    description: 'Explore robotics companies worldwide. Click on markers to see company details, hover to preview. The globe shows real-time power scores.',
    position: 'right',
  },
  {
    id: 'narrative-index',
    target: '[data-tutorial="narrative-index"]',
    title: 'Robotics Narrative Index',
    description: 'Our proprietary score (0-100) measuring industry momentum. Combines market alpha, prediction markets, contracts, GitHub activity, funding, and more.',
    position: 'left',
  },
  {
    id: 'funding',
    target: '[data-tutorial="funding"]',
    title: 'Funding Tracker',
    description: 'Real-time robotics funding rounds. We track $12B+ across 30 companies including Figure AI, Physical Intelligence, and Anduril.',
    position: 'left',
  },
  {
    id: 'heatmap',
    target: '[data-tutorial="heatmap"]',
    title: 'Power Heatmap',
    description: 'Geographic concentration of robotics power. See which regions dominate in funding, talent, and government contracts.',
    position: 'top',
  },
  {
    id: 'terminal',
    target: '[data-tutorial="terminal"]',
    title: 'AI Terminal',
    description: 'Ask questions about the robotics industry. Powered by GPT-4 with full access to our dashboard data.',
    position: 'top',
  },
];

const STORAGE_KEY = 'robotics-onboarding-completed';

export default function OnboardingTutorial() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check if tutorial should show
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay start to let page render
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update target position
  useEffect(() => {
    if (!isActive) return;

    const updatePosition = () => {
      const step = TUTORIAL_STEPS[currentStep];
      const target = document.querySelector(step.target);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete tutorial
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsActive(false);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsActive(false);
  }, []);

  if (!isActive) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const padding = 8;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { opacity: 0 };

    const tooltipWidth = 320;
    const tooltipHeight = 160;
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + gap;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - gap;
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
    }

    // Keep on screen
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    return { top, left, width: tooltipWidth };
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop with cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.8)"
          mask="url(#tutorial-mask)"
          style={{ backdropFilter: 'blur(4px)' }}
        />
      </svg>

      {/* Highlight border */}
      {targetRect && (
        <div
          className="absolute border-2 border-[#00FFE0] rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 20px rgba(0, 255, 224, 0.3)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute bg-[#0A0B0F] border border-white/20 rounded-lg p-4 shadow-2xl transition-all duration-300"
        style={getTooltipStyle()}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {TUTORIAL_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === currentStep
                  ? 'w-6 bg-[#00FFE0]'
                  : i < currentStep
                  ? 'w-2 bg-[#00FFE0]/50'
                  : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="text-white font-semibold text-sm mb-2">{step.title}</h3>
        <p className="text-white/60 text-xs leading-relaxed mb-4">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-white/40 text-xs hover:text-white/60 transition-colors"
          >
            Skip tutorial
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 bg-[#00FFE0] text-black text-xs font-medium rounded hover:bg-[#00FFE0]/90 transition-colors"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
