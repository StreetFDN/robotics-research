'use client';

import { useState, useEffect, useMemo } from 'react';

interface FlowItem {
  /** Source organization/entity */
  from: string;
  /** Target organization/entity */
  to: string;
  /** Number of contributors/items flowing */
  count: number;
  /** Optional contributor names */
  contributors?: string[];
}

interface FlowDiagramProps {
  /** Flow data */
  flows: FlowItem[];
  /** Show as table instead of diagram */
  variant?: 'diagram' | 'table';
  /** Max flows to display */
  limit?: number;
  /** Flow line color */
  color?: string;
  /** Animate on mount */
  animate?: boolean;
  /** Click handler */
  onFlowClick?: (flow: FlowItem) => void;
  /** Optional className */
  className?: string;
}

/**
 * FlowDiagram - Visualize contributor/item movement between orgs
 *
 * Shows flows between organizations with counts.
 * Supports both visual diagram and table fallback.
 */
export default function FlowDiagram({
  flows,
  variant = 'diagram',
  limit,
  color = '#00FFE0',
  animate = true,
  onFlowClick,
  className = '',
}: FlowDiagramProps) {
  const [mounted, setMounted] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  // Get limited and sorted flows
  const displayFlows = useMemo(() => {
    const sorted = [...flows].sort((a, b) => b.count - a.count);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [flows, limit]);

  // Get unique orgs
  const { leftOrgs, rightOrgs, maxCount } = useMemo(() => {
    const left = new Set<string>();
    const right = new Set<string>();
    let max = 0;

    displayFlows.forEach((flow) => {
      left.add(flow.from);
      right.add(flow.to);
      if (flow.count > max) max = flow.count;
    });

    return {
      leftOrgs: Array.from(left),
      rightOrgs: Array.from(right),
      maxCount: max,
    };
  }, [displayFlows]);

  // Table variant
  if (variant === 'table') {
    return (
      <FlowTable
        flows={displayFlows}
        onFlowClick={onFlowClick}
        className={className}
      />
    );
  }

  // Diagram variant
  const orgHeight = 32;
  const padding = 16;
  const diagramHeight = Math.max(leftOrgs.length, rightOrgs.length) * orgHeight + padding * 2;
  const diagramWidth = 320;

  return (
    <div className={className}>
      <svg
        width="100%"
        height={diagramHeight}
        viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}
        className="overflow-visible"
      >
        {/* Left column (source orgs) */}
        {leftOrgs.map((org, index) => {
          const y = padding + index * orgHeight + orgHeight / 2;

          return (
            <g key={`left-${org}`}>
              <rect
                x={0}
                y={y - 10}
                width={100}
                height={20}
                rx={2}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
              <text
                x={50}
                y={y + 4}
                textAnchor="middle"
                className="text-[9px] font-mono fill-white/64"
              >
                {org.length > 12 ? `${org.slice(0, 10)}...` : org}
              </text>
            </g>
          );
        })}

        {/* Right column (target orgs) */}
        {rightOrgs.map((org, index) => {
          const y = padding + index * orgHeight + orgHeight / 2;

          return (
            <g key={`right-${org}`}>
              <rect
                x={diagramWidth - 100}
                y={y - 10}
                width={100}
                height={20}
                rx={2}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
              <text
                x={diagramWidth - 50}
                y={y + 4}
                textAnchor="middle"
                className="text-[9px] font-mono fill-white/64"
              >
                {org.length > 12 ? `${org.slice(0, 10)}...` : org}
              </text>
            </g>
          );
        })}

        {/* Flow lines */}
        {displayFlows.map((flow, index) => {
          const fromIndex = leftOrgs.indexOf(flow.from);
          const toIndex = rightOrgs.indexOf(flow.to);

          const y1 = padding + fromIndex * orgHeight + orgHeight / 2;
          const y2 = padding + toIndex * orgHeight + orgHeight / 2;

          const x1 = 100;
          const x2 = diagramWidth - 100;

          // Bezier control points
          const cx1 = (x1 + x2) / 2;
          const cx2 = (x1 + x2) / 2;

          // Line thickness based on count
          const strokeWidth = Math.max(1, Math.min(6, (flow.count / maxCount) * 6));

          // Path opacity
          const opacity = mounted ? 0.6 : 0;

          return (
            <g
              key={`flow-${flow.from}-${flow.to}`}
              className={`transition-opacity duration-500 ${onFlowClick ? 'cursor-pointer' : ''}`}
              style={{ transitionDelay: animate ? `${index * 100}ms` : '0ms' }}
              onClick={() => onFlowClick?.(flow)}
            >
              {/* Flow path */}
              <path
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={opacity}
                className="hover:opacity-100 transition-opacity"
              />

              {/* Count label */}
              <g
                transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}
                opacity={opacity}
              >
                <rect
                  x={-12}
                  y={-8}
                  width={24}
                  height={16}
                  rx={2}
                  fill="rgba(0,0,0,0.8)"
                  stroke={color}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  className="text-[8px] font-mono font-medium"
                  fill={color}
                >
                  {flow.count}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * FlowTable - Table fallback for flow visualization
 */
export function FlowTable({
  flows,
  onFlowClick,
  className = '',
}: {
  flows: FlowItem[];
  onFlowClick?: (flow: FlowItem) => void;
  className?: string;
}) {
  if (flows.length === 0) {
    return (
      <div
        className={`
          px-3 py-6 text-center
          border border-dashed border-white/[0.08] rounded-sm
          ${className}
        `}
      >
        <span className="text-[10px] font-mono text-white/32">
          No contributor flows detected
        </span>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="py-2 px-2 text-left">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/32">
                From
              </span>
            </th>
            <th className="py-2 px-2 text-center w-16">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/32">
                →
              </span>
            </th>
            <th className="py-2 px-2 text-left">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/32">
                To
              </span>
            </th>
            <th className="py-2 px-2 text-right">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/32">
                Count
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {flows.map((flow) => (
            <tr
              key={`${flow.from}-${flow.to}`}
              className={`
                border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors
                ${onFlowClick ? 'cursor-pointer' : ''}
              `}
              onClick={() => onFlowClick?.(flow)}
            >
              <td className="py-2.5 px-2">
                <span className="text-[10px] font-mono text-white/64">
                  {flow.from}
                </span>
              </td>
              <td className="py-2.5 px-2 text-center">
                <span className="text-[#00FFE0]">→</span>
              </td>
              <td className="py-2.5 px-2">
                <span className="text-[10px] font-mono text-white/64">
                  {flow.to}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-[11px] font-mono font-medium text-[#00FFE0]">
                  {flow.count}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * FlowSkeleton - Loading state
 */
export function FlowSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-6 w-24 bg-white/[0.04] rounded animate-pulse" />
          <div className="flex-1 h-1 bg-white/[0.02] rounded animate-pulse" />
          <div className="h-6 w-24 bg-white/[0.04] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * ContributorFlowCard - Card showing a single contributor's movement
 */
export function ContributorFlowCard({
  username,
  avatarUrl,
  contributions,
  className = '',
}: {
  username: string;
  avatarUrl?: string;
  contributions: Array<{ org: string; repo: string; commits: number }>;
  className?: string;
}) {
  // Group by org
  const orgGroups = contributions.reduce(
    (acc, c) => {
      if (!acc[c.org]) acc[c.org] = 0;
      acc[c.org] += c.commits;
      return acc;
    },
    {} as Record<string, number>
  );

  const orgs = Object.entries(orgGroups).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className={`
        bg-black/20 rounded-sm p-3 border border-white/[0.06]
        ${className}
      `}
    >
      {/* User header */}
      <div className="flex items-center gap-2 mb-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center">
            <span className="text-[10px] font-mono text-white/32">
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-[11px] font-mono font-medium text-white/80">
          {username}
        </span>
      </div>

      {/* Org contributions */}
      <div className="flex flex-wrap gap-1.5">
        {orgs.slice(0, 4).map(([org, commits]) => (
          <span
            key={org}
            className="text-[9px] font-mono px-1.5 py-0.5 bg-white/[0.04] text-white/48 rounded-sm"
          >
            {org}
            <span className="text-[#00FFE0] ml-1">{commits}</span>
          </span>
        ))}
        {orgs.length > 4 && (
          <span className="text-[8px] font-mono text-white/24">
            +{orgs.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}
