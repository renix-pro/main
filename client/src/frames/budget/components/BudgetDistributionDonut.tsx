/**
 * RENIX vNext — Budget Distribution Donut
 * 
 * Canon v1.4 Compliant — Single Ring
 * 
 * Single-ring donut visualization:
 * - Each segment corresponds to one allocated scope
 * - Segment size proportional to allocated amount
 * - Contingency reserved shown as a distinct hatched segment
 * - Uses RENIX palette colors for scope identity only
 * - Center text shows "Allocated: €X" (total), or scope name + amount on hover
 * - Interactive: hover/click segments to reveal details
 * 
 * Responsive sizing: Fills available container space
 */

import { useMemo, useState, useCallback } from 'react';
import { useFormatters } from '@/context/ProjectContext';
import type { BudgetAllocation } from '../useBudgetData';

interface Scope {
  id: string;
  name: string;
}

interface BudgetDistributionDonutProps {
  totalBudget: number | null;
  scopes: Scope[];
  allocations: BudgetAllocation[];
  contingencyAmount?: number;
  onScrollToScope?: (scopeId: string) => void;
  maxHeight?: number;
  resolveRootScopeId?: (scopeId: string) => string | null;
}

interface DonutSegment {
  scopeId: string;
  scopeName: string;
  amount: number;
  startAngle: number;
  endAngle: number;
  color: string;
  midAngle: number;
  isContingency?: boolean;
}

const SCOPE_COLORS = [
  'var(--renix-copper)',
  'var(--renix-emerald)',
  'var(--renix-amber)',
  'var(--renix-steel)',
  'var(--renix-coral)',
  'var(--renix-sage)',
  'var(--renix-clay)',
  'var(--renix-slate)',
];

const CONTINGENCY_COLOR = 'var(--muted-foreground)';

const VIEWBOX_SIZE = 200;
const CENTER = VIEWBOX_SIZE / 2;
const RING_RADIUS = 70;
const RING_THICKNESS = 20;
const GAP_ANGLE = 2;

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArcSegment(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  
  return [
    'M', outerStart.x, outerStart.y,
    'A', outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    'L', innerStart.x, innerStart.y,
    'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    'Z',
  ].join(' ');
}

export function BudgetDistributionDonut({
  scopes,
  allocations,
  contingencyAmount = 0,
  onScrollToScope,
  resolveRootScopeId,
}: BudgetDistributionDonutProps) {
  const { formatCurrency } = useFormatters();
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  const totalAllocatedAmount = useMemo(() => {
    return allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  }, [allocations]);
  
  const segments = useMemo(() => {
    const scopeAllocMap = new Map<string, number>();
    const colorMap = new Map<string, string>();
    
    scopes.forEach((scope, idx) => {
      scopeAllocMap.set(scope.id, 0);
      colorMap.set(scope.id, SCOPE_COLORS[idx % SCOPE_COLORS.length]);
    });
    
    const unmappedAllocations: Array<{ label: string; amount: number }> = [];
    
    allocations.forEach(alloc => {
      if (alloc.target.type === 'scope' && alloc.target.scopeId) {
        let targetId = alloc.target.scopeId;
        if (!scopeAllocMap.has(targetId) && resolveRootScopeId) {
          const rootId = resolveRootScopeId(targetId);
          if (rootId && scopeAllocMap.has(rootId)) {
            targetId = rootId;
          }
        }
        if (scopeAllocMap.has(targetId)) {
          const current = scopeAllocMap.get(targetId) || 0;
          scopeAllocMap.set(targetId, current + alloc.amount);
        } else {
          unmappedAllocations.push({ label: alloc.label, amount: alloc.amount });
        }
      } else if (alloc.target.type === 'scope' && !alloc.target.scopeId) {
        unmappedAllocations.push({ label: alloc.label, amount: alloc.amount });
      } else {
        unmappedAllocations.push({ label: alloc.label, amount: alloc.amount });
      }
    });
    
    const entries: Array<{ scopeId: string; scopeName: string; amount: number; isContingency?: boolean }> = [];
    let total = 0;
    
    scopes.forEach(scope => {
      const amount = scopeAllocMap.get(scope.id) || 0;
      if (amount > 0) {
        entries.push({ scopeId: scope.id, scopeName: scope.name, amount });
        total += amount;
      }
    });
    
    const unmappedTotal = unmappedAllocations.reduce((s, a) => s + a.amount, 0);
    if (unmappedTotal > 0) {
      const unmappedLabel = unmappedAllocations.length === 1
        ? unmappedAllocations[0].label
        : 'Unassigned';
      entries.push({ scopeId: '__unassigned__', scopeName: unmappedLabel, amount: unmappedTotal });
      colorMap.set('__unassigned__', 'var(--muted-foreground)');
      total += unmappedTotal;
    }
    
    if (contingencyAmount > 0) {
      entries.push({ scopeId: '__contingency__', scopeName: 'Contingency', amount: contingencyAmount, isContingency: true });
      colorMap.set('__contingency__', CONTINGENCY_COLOR);
      total += contingencyAmount;
    }
    
    if (entries.length === 0) {
      return [];
    }
    
    const gapTotal = entries.length * GAP_ANGLE;
    const availableAngle = 360 - gapTotal;
    
    const segmentList: DonutSegment[] = [];
    let currentAngle = 0;
    
    entries.forEach((entry) => {
      const proportion = entry.amount / total;
      const segmentAngle = proportion * availableAngle;
      const midAngle = currentAngle + segmentAngle / 2;
      
      segmentList.push({
        scopeId: entry.scopeId,
        scopeName: entry.scopeName,
        amount: entry.amount,
        startAngle: currentAngle,
        endAngle: currentAngle + segmentAngle,
        color: colorMap.get(entry.scopeId) || SCOPE_COLORS[0],
        midAngle,
        isContingency: entry.isContingency,
      });
      
      currentAngle += segmentAngle + GAP_ANGLE;
    });
    
    return segmentList;
  }, [scopes, allocations, resolveRootScopeId, contingencyAmount]);
  
  const handleSegmentClick = useCallback((scopeId: string) => {
    if (scopeId !== '__contingency__' && scopeId !== '__unassigned__') {
      onScrollToScope?.(scopeId);
    }
  }, [onScrollToScope]);
  
  const handleMouseEnter = useCallback((segment: DonutSegment) => {
    setHoveredSegment(segment.scopeId);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);
  
  const activeData = segments.find(s => s.scopeId === hoveredSegment);
  
  const innerR = RING_RADIUS - RING_THICKNESS / 2;
  const outerR = RING_RADIUS + RING_THICKNESS / 2;
  
  const centerTotal = totalAllocatedAmount + contingencyAmount;
  
  if (segments.length === 0) {
    return (
      <div 
        className="aspect-square max-w-full max-h-full flex items-center justify-center"
        data-testid="budget-distribution-donut"
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          data-testid="donut-svg"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_THICKNESS}
            opacity={0.1}
            strokeDasharray="4 4"
            data-testid="donut-empty-ring"
          />
          <text
            x={CENTER}
            y={CENTER}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={10}
            opacity={0.4}
          >
            No allocations yet
          </text>
        </svg>
      </div>
    );
  }
  
  return (
    <div 
      className="aspect-square max-w-full max-h-full flex items-center justify-center"
      data-testid="budget-distribution-donut"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full text-black dark:text-white overflow-visible"
        style={{ overflow: 'visible' }}
        data-testid="donut-svg"
      >
        <defs>
          <pattern id="contingency-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.25" />
          </pattern>
        </defs>
        
        {segments.map((segment) => {
          const isActive = hoveredSegment === segment.scopeId;
          const spanAngle = segment.endAngle - segment.startAngle;
          
          if (spanAngle >= 359.9) {
            return (
              <circle
                key={segment.scopeId}
                cx={CENTER}
                cy={CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={RING_THICKNESS}
                opacity={isActive ? 1 : 0.75}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => handleMouseEnter(segment)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleSegmentClick(segment.scopeId)}
                data-testid={`donut-segment-${segment.scopeId}`}
              />
            );
          }
          
          const path = describeArcSegment(
            CENTER,
            CENTER,
            innerR,
            outerR,
            segment.startAngle,
            segment.endAngle
          );
          
          if (segment.isContingency) {
            return (
              <g key={segment.scopeId}>
                <path
                  d={path}
                  fill={segment.color}
                  stroke="none"
                  opacity={isActive ? 0.5 : 0.2}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => handleMouseEnter(segment)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleSegmentClick(segment.scopeId)}
                  data-testid={`donut-segment-${segment.scopeId}`}
                />
                <path
                  d={path}
                  fill="url(#contingency-hatch)"
                  stroke="none"
                  className="cursor-pointer pointer-events-none"
                />
              </g>
            );
          }
          
          return (
            <path
              key={segment.scopeId}
              d={path}
              fill={segment.color}
              stroke="none"
              opacity={isActive ? 1 : 0.75}
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => handleMouseEnter(segment)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleSegmentClick(segment.scopeId)}
              data-testid={`donut-segment-${segment.scopeId}`}
            />
          );
        })}
        
        {activeData ? (
          <>
            <text
              x={CENTER}
              y={CENTER - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={activeData.isContingency ? 'currentColor' : activeData.color}
              fontSize={9}
              className="font-medium"
              opacity={activeData.isContingency ? 0.6 : 1}
            >
              {activeData.scopeName.length > 14 
                ? activeData.scopeName.slice(0, 13) + '\u2026' 
                : activeData.scopeName}
            </text>
            <text
              x={CENTER}
              y={CENTER + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={activeData.isContingency ? 'currentColor' : activeData.color}
              fontSize={11}
              className="font-semibold tabular-nums"
              opacity={activeData.isContingency ? 0.6 : 1}
            >
              {formatCurrency(activeData.amount)}
            </text>
          </>
        ) : (
          <>
            <text
              x={CENTER}
              y={CENTER - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={8}
              opacity={0.5}
            >
              Allocated
            </text>
            <text
              x={CENTER}
              y={CENTER + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={11}
              className="font-semibold tabular-nums"
            >
              {formatCurrency(centerTotal)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
