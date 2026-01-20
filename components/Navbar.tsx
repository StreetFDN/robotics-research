'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import CommandBar from './ui/CommandBar';
import { useGlobeStore } from '@/store/globeStore';

interface ParsedCommand {
  originalQuery: string;
  action: 'filter' | 'select' | 'compare' | 'search';
  params: Record<string, unknown>;
  confidence: number;
}

interface CommandParseResponse {
  ok: boolean;
  data?: ParsedCommand;
  error?: string;
}

export default function Navbar() {
  const [activeLink, setActiveLink] = useState('dashboard');
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  const { privateCompanies, setSelectedPrivateCompany, setSearchQuery, setCompanyFilter } = useGlobeStore();

  // Handle keyboard shortcuts for CommandBar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open on `/` key (when not in an input field)
      if (e.key === '/' && !isCommandBarOpen) {
        const target = e.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInputField) {
          e.preventDefault();
          setIsCommandBarOpen(true);
        }
      }
      // Close on `Escape` key
      if (e.key === 'Escape' && isCommandBarOpen) {
        e.preventDefault();
        handleCloseCommandBar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandBarOpen]);

  // Reset state when command bar closes
  const handleCloseCommandBar = useCallback(() => {
    setIsCommandBarOpen(false);
    setIsParsing(false);
    setParseError(null);
    setParsedCommand(null);
    setPendingQuery(null);
  }, []);

  // Execute the parsed command
  const executeCommand = useCallback((command: ParsedCommand) => {
    console.log('[CommandBar] Executing command:', command);

    switch (command.action) {
      case 'select': {
        const params = command.params as { companyName?: string };
        if (params.companyName) {
          const company = privateCompanies.find(
            (c) => c.name.toLowerCase().includes(params.companyName!.toLowerCase())
          );
          if (company) {
            setSelectedPrivateCompany(company);
          }
        }
        break;
      }
      case 'filter': {
        const params = command.params as { tags?: string[]; field?: string; operator?: string; value?: unknown };
        if (params.tags) {
          setCompanyFilter?.({ tags: params.tags });
        } else if (params.field) {
          setCompanyFilter?.({ field: params.field, operator: params.operator, value: params.value });
        }
        break;
      }
      case 'search': {
        const params = command.params as { query?: string };
        if (params.query) {
          setSearchQuery?.(params.query);
        }
        break;
      }
      case 'compare': {
        // Stub for comparison - can be implemented later
        console.log('[CommandBar] Compare action not yet implemented:', command.params);
        break;
      }
    }

    handleCloseCommandBar();
  }, [privateCompanies, setSelectedPrivateCompany, setCompanyFilter, setSearchQuery, handleCloseCommandBar]);

  // Parse and execute command
  const handleCommandSubmit = useCallback(async (query: string) => {
    if (!query.trim()) {
      handleCloseCommandBar();
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParsedCommand(null);
    setPendingQuery(query);

    try {
      const response = await fetch('/api/command/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const result: CommandParseResponse = await response.json();

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Could not interpret command');
      }

      // Store parsed command for preview
      setParsedCommand(result.data);
      setIsParsing(false);

      // Auto-execute after short delay if confidence is high
      if (result.data.confidence >= 0.8) {
        setTimeout(() => {
          executeCommand(result.data!);
        }, 800);
      }
    } catch (err: any) {
      console.error('[CommandBar] Parse error:', err);
      setIsParsing(false);
      setParseError(err.message || 'Command not recognized');
    }
  }, [executeCommand, handleCloseCommandBar]);

  // Confirm execution of parsed command
  const handleConfirmCommand = useCallback(() => {
    if (parsedCommand) {
      executeCommand(parsedCommand);
    }
  }, [parsedCommand, executeCommand]);

  // Get action description for preview
  const getActionDescription = (command: ParsedCommand): string => {
    switch (command.action) {
      case 'select':
        return `Select company: ${(command.params as any).companyName}`;
      case 'filter':
        const filterParams = command.params as any;
        if (filterParams.tags) {
          return `Filter by tags: ${filterParams.tags.join(', ')}`;
        }
        return `Filter: ${filterParams.field} ${filterParams.operator} ${filterParams.value}`;
      case 'search':
        return `Search for: ${(command.params as any).query}`;
      case 'compare':
        return `Compare: ${((command.params as any).companies || []).join(' vs ')}`;
      default:
        return command.originalQuery;
    }
  };

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

        {/* Command Bar Trigger + Status */}
        <div className="flex items-center gap-3">
          {/* Command Bar Trigger */}
          <button
            onClick={() => setIsCommandBarOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-sm transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white/40">
              <path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM14.5 14.5l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] text-white/40 font-mono">/</span>
          </button>

          {/* Status Pill - Glass Style */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#00C957] animate-pulse" />
            <span className="text-[10px] font-mono text-white/70">
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Command Bar Modal */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={handleCloseCommandBar}
        onSubmit={handleCommandSubmit}
        isParsing={isParsing}
        parseError={parseError}
        parsedCommand={parsedCommand ? getActionDescription(parsedCommand) : null}
        onConfirm={handleConfirmCommand}
      />
    </nav>
  );
}


