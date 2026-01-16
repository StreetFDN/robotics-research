import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ===========================================
      // DESIGN TOKENS - OBSIDIAN PALETTE (Palantir/CIA)
      // Owner: W2 | Updated: 2026-01-16 | BATCH 1
      // ===========================================
      colors: {
        // OBSIDIAN SURFACE SCALE - ultra-dark layered depth
        "void": "#05060A",        // Deepest black - true void
        "base": "#08090C",        // App background
        "raised": "#0C0E12",      // Slightly elevated surfaces
        "elevated": "#101318",    // Cards, panels
        "overlay": "#14171D",     // Modals, dropdowns
        "highlight": "#1A1E26",   // Hover states, selection

        // Legacy aliases (for backwards compat during migration)
        "background": "#08090C",  // -> base
        "surface": "#101318",     // -> elevated

        // ACCENT COLORS - high-contrast signals
        "accent": "#00FFE0",          // Primary accent (cyan)
        "accent-cyan": "#00FFE0",     // Primary accent
        "accent-green": "#00FF88",    // Success, positive
        "accent-amber": "#FFB800",    // Warning, caution
        "accent-red": "#FF3B3B",      // Danger, alert

        // Legacy accent aliases
        "teal": "#00FFE0",
        "amber": "#FFB800",
        "alert": "#FF3B3B",

        // TEXT SCALE - precise opacity hierarchy
        "text-primary": "#FFFFFF",
        "text-secondary": "rgba(255, 255, 255, 0.72)",
        "text-tertiary": "rgba(255, 255, 255, 0.48)",
        "text-muted": "rgba(255, 255, 255, 0.32)",
        "text-accent": "#00FFE0",
        "text-success": "#00FF88",
        "text-warning": "#FFB800",
        "text-danger": "#FF3B3B",

        // BORDER TOKENS - subtle separation
        "border-subtle": "rgba(255, 255, 255, 0.06)",
        "border-default": "rgba(255, 255, 255, 0.10)",
        "border-strong": "rgba(255, 255, 255, 0.16)",
        "border-accent": "rgba(0, 255, 224, 0.3)",
        "border-success": "rgba(0, 255, 136, 0.4)",
        "border-warning": "rgba(255, 184, 0, 0.4)",
        "border-danger": "rgba(255, 59, 59, 0.4)",

        // PANEL TOKENS
        "panel-primary": "#101318",
        "panel-secondary": "#0C0E12",
        "panel-accent": "rgba(0, 255, 224, 0.06)",
        "panel-muted": "rgba(16, 19, 24, 0.8)",

        // STATUS COLORS
        "status-live": "#00FF88",
        "status-pending": "#FFB800",
        "status-offline": "#FF3B3B",
        "status-neutral": "#4A5568",
      },

      // SHARP CORNERS - no rounded edges > 4px
      borderRadius: {
        "none": "0px",
        "sm": "2px",
        "md": "3px",
        "lg": "4px",
        "panel": "3px",
        "card": "2px",
        "button": "2px",
        "chip": "2px",
      },

      // Box shadow tokens - updated for Obsidian palette
      boxShadow: {
        "panel": "0 4px 24px rgba(0, 0, 0, 0.6)",
        "card": "0 2px 12px rgba(0, 0, 0, 0.5)",
        "elevated": "0 8px 32px rgba(0, 0, 0, 0.7)",
        "glow-accent": "0 0 20px rgba(0, 255, 224, 0.12)",
        "glow-success": "0 0 20px rgba(0, 255, 136, 0.12)",
        "glow-warning": "0 0 20px rgba(255, 184, 0, 0.12)",
        "glow-danger": "0 0 20px rgba(255, 59, 59, 0.12)",
        "inner-subtle": "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        "void": "0 0 0 1px rgba(255, 255, 255, 0.04)",
      },

      // Backdrop blur tokens
      backdropBlur: {
        "panel": "12px",
        "overlay": "16px",
        "subtle": "8px",
      },

      // Font family tokens - using CSS variables from next/font
      fontFamily: {
        "ui": ["var(--font-ui)", "Inter", "system-ui", "sans-serif"],
        "mono": ["var(--font-mono)", "JetBrains Mono", "Menlo", "Monaco", "monospace"],
        "lcd": ["var(--font-lcd)", "VT323", "monospace"],
        "sans": ["var(--font-ui)", "Inter", "system-ui", "sans-serif"],
      },

      // Font size tokens (matching globals.css scale)
      fontSize: {
        "headline": ["18px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        "subheadline": ["14px", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "-0.005em" }],
        "body": ["12px", { lineHeight: "1.5", fontWeight: "400" }],
        "caption": ["10px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.02em" }],
        "label": ["9px", { lineHeight: "1.2", fontWeight: "500", letterSpacing: "0.08em" }],
        "data": ["11px", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.01em" }],
      },

      // Spacing tokens for consistent panel/card gaps
      spacing: {
        "panel-gap": "12px",
        "card-gap": "8px",
        "section-gap": "16px",
      },

      // Animation tokens
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite",
      },

      keyframes: {
        glow: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },

      // Transition tokens
      transitionDuration: {
        "fast": "100ms",
        "normal": "200ms",
        "slow": "300ms",
      },
    },
  },
  plugins: [],
};
export default config;


