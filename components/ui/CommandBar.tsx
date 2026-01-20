'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';

interface CommandBarProps {
  /** Whether the command bar is visible */
  isOpen: boolean;
  /** Callback when command bar should close */
  onClose: () => void;
  /** Callback when user submits a query */
  onSubmit: (query: string) => void;
  /** Optional placeholder text (A6 provides copy) */
  placeholder?: string;
  /** Optional helper text shown below input */
  helperText?: string;
  /** Whether a command is being parsed */
  isParsing?: boolean;
  /** Error message from parsing */
  parseError?: string | null;
  /** Parsed command preview */
  parsedCommand?: string | null;
  /** Callback to confirm the parsed command */
  onConfirm?: () => void;
}

// Default copy (A6 integration point)
const DEFAULT_PLACEHOLDER = 'Search companies, filter by region, or type a command...';
const DEFAULT_HELPER = "Try: 'show funding > $10M' or 'compare Figure vs Boston Dynamics'";

/**
 * CommandBar - Power-user command interface
 *
 * Glassmorphism modal for quick search and command execution.
 * Opens with `/` key, closes with `Escape`.
 */
export default function CommandBar({
  isOpen,
  onClose,
  onSubmit,
  placeholder = DEFAULT_PLACEHOLDER,
  helperText = DEFAULT_HELPER,
  isParsing = false,
  parseError = null,
  parsedCommand = null,
  onConfirm,
}: CommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Clear query when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        onSubmit(query.trim());
        setQuery('');
        onClose();
      }
    },
    [query, onClose, onSubmit]
  );

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Command bar container */}
      <div
        className="relative w-full max-w-xl mx-4
                   bg-black/60 backdrop-blur-xl
                   border border-white/[0.08] rounded-sm
                   shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]
                   overflow-hidden"
      >
        {/* Input row */}
        <div className="flex items-center px-4 py-3 border-b border-white/[0.06]">
          {/* Search icon */}
          <svg
            className="w-4 h-4 text-white/32 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 ml-3 bg-transparent text-sm font-mono text-white/90
                       placeholder:text-white/24 outline-none"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {/* Keyboard hint */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-white/32
                           bg-white/[0.04] border border-white/[0.08] rounded-sm">
              ESC
            </kbd>
          </div>
        </div>

        {/* Status / Helper area */}
        <div className="px-4 py-2 bg-white/[0.02]">
          {isParsing ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-[#00FFE0]/50 border-t-[#00FFE0] rounded-full animate-spin" />
              <p className="text-[10px] font-mono text-white/40">Interpreting command...</p>
            </div>
          ) : parseError ? (
            <p className="text-[10px] font-mono text-[#FF3B3B]">{parseError}</p>
          ) : parsedCommand ? (
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-[#00FFE0]">Will apply: {parsedCommand}</p>
              {onConfirm && (
                <button
                  onClick={onConfirm}
                  className="px-2 py-0.5 text-[9px] font-mono text-black bg-[#00FFE0] rounded-sm hover:bg-[#00FFE0]/90"
                >
                  CONFIRM
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] font-mono text-white/24">
              {helperText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage CommandBar open/close state with keyboard shortcuts
 */
export function useCommandBar() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Open on `/` key (unless in an input field)
      if (
        e.key === '/' &&
        !isOpen &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    open,
    close,
    setIsOpen,
  };
}
