/**
 * RENIX vNext — Budget Sankey
 * 
 * Canon v1.4 Compliant
 * Explanatory flow visualization. Never authoritative, never editable.
 * 
 * Node Layers:
 * - Layer 0: Total Budget
 * - Layer 1: Scopes (ALL scopes, always)
 * - Layer 2: Allocations, Contingency, Unallocated
 * 
 * SVG Rules:
 * - Stroke: black only
 * - Fill: none
 * - No gradients, no opacity
 * - Cubic bezier curves for edges
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useFormatters } from '@/context/ProjectContext';
import type { BudgetAllocation } from '../useBudgetData';

const MOBILE_BREAKPOINT = 768;

interface Scope {
  id: string;
  name: string;
}

interface BudgetSankeyProps {
  totalBudget: number | null;
  scopes: Scope[];
  allocations: BudgetAllocation[];
  contingencyValue: number;
  isExpanded?: boolean;
  onScrollToScope?: (scopeId: string) => void;
  onScrollToAllocation?: (allocationId: string) => void;
  onScrollToUnallocated?: () => void;
}

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  layer: 0 | 1;
  y: number;
  height: number;
  nodeType?: 'scope' | 'contingency' | 'unallocated';
}

interface SankeyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  value: number;
  sourceY: number;
  targetY: number;
  strokeWidth: number;
  flowType: 'allocated' | 'contingency' | 'unallocated' | 'unassigned' | 'needs-attention';
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 180;
const NODE_STROKE_WIDTH = 4;
const LABEL_FONT_SIZE = 10;
const VALUE_FONT_SIZE = 9;
const MIN_NODE_HEIGHT = 8;
const LAYER_POSITIONS = [0.0, 0.70];
const NODE_PADDING = 4;
const MIN_STROKE_WIDTH = 2;
const MAX_STROKE_WIDTH = 40;

const FLOW_COLORS: Record<string, string> = {
  allocated: 'var(--renix-steel)',
  contingency: 'var(--renix-amber)',
  unallocated: 'var(--renix-copper)',
  unassigned: 'var(--renix-emerald)',
  'needs-attention': 'var(--renix-coral)',
};

const FLOW_OPACITY = {
  default: 0.6,
  hover: 0.85,
} as const;

export function BudgetSankey({
  totalBudget,
  scopes,
  allocations,
  contingencyValue,
  isExpanded: controlledExpanded,
  onScrollToScope,
  onScrollToAllocation,
  onScrollToUnallocated,
}: BudgetSankeyProps) {
  const { formatCurrency } = useFormatters();
  const [isMobile, setIsMobile] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'summary' | 'flow'>('summary');
  
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      const wasMobile = isMobile;
      setIsMobile(mobile);
      if (mobile && !wasMobile) {
        setMobileView('summary');
      }
      if (mobile && internalExpanded) {
        setInternalExpanded(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);
  
  const isExpanded = controlledExpanded ?? internalExpanded;
  
  const hasBudget = totalBudget !== null && totalBudget > 0;
  
  const { nodes, edges } = useMemo(() => {
    if (!hasBudget) {
      return { nodes: [], edges: [] };
    }
    
    const total = totalBudget || 0;
    const nodeList: SankeyNode[] = [];
    const edgeList: SankeyEdge[] = [];
    
    nodeList.push({
      id: 'total',
      label: 'Total Budget',
      value: total,
      layer: 0,
      y: 0,
      height: 0,
    });
    
    const scopeAllocMap = new Map<string, number>();
    scopes.forEach(s => scopeAllocMap.set(s.id, 0));
    
    allocations.forEach(alloc => {
      if (alloc.target.type === 'scope' && alloc.target.scopeId) {
        const current = scopeAllocMap.get(alloc.target.scopeId) || 0;
        scopeAllocMap.set(alloc.target.scopeId, current + alloc.amount);
      }
    });
    
    const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0) + contingencyValue;
    const unallocatedAmount = Math.max(0, total - allocatedTotal);
    
    scopes.forEach(scope => {
      const scopeValue = scopeAllocMap.get(scope.id) || 0;
      nodeList.push({
        id: `scope-${scope.id}`,
        label: scope.name,
        value: scopeValue,
        layer: 1,
        y: 0,
        height: 0,
        nodeType: 'scope',
      });
    });
    
    if (contingencyValue > 0) {
      nodeList.push({
        id: 'contingency',
        label: 'Contingency',
        value: contingencyValue,
        layer: 1,
        y: 0,
        height: 0,
        nodeType: 'contingency',
      });
    }
    
    if (unallocatedAmount > 0) {
      nodeList.push({
        id: 'unallocated',
        label: 'Unallocated',
        value: unallocatedAmount,
        layer: 1,
        y: 0,
        height: 0,
        nodeType: 'unallocated',
      });
    }
    
    const layerNodes: SankeyNode[][] = [[], []];
    nodeList.forEach(node => {
      layerNodes[node.layer].push(node);
    });
    
    layerNodes.forEach((layer) => {
      const totalValue = layer.reduce((sum, n) => sum + Math.max(n.value, 1), 0);
      const gapCount = Math.max(0, layer.length - 1);
      const availableHeight = SVG_HEIGHT - gapCount * NODE_PADDING;
      
      let currentY = 0;
      layer.forEach((node, idx) => {
        const proportion = Math.max(node.value, 1) / totalValue;
        const height = Math.max(MIN_NODE_HEIGHT, proportion * availableHeight);
        node.height = height;
        node.y = currentY;
        currentY += height;
        if (idx < layer.length - 1) {
          currentY += NODE_PADDING;
        }
      });
    });
    
    const totalNode = nodeList.find(n => n.id === 'total');
    
    if (totalNode) {
      const totalTargetHeightWithPadding = layerNodes[1].reduce((sum, n) => sum + n.height, 0) 
        + (layerNodes[1].length - 1) * NODE_PADDING;
      
      let sourceOffset = totalNode.y;
      
      layerNodes[1].forEach((node, idx) => {
        const sourceFlowHeight = (node.height / totalTargetHeightWithPadding) * totalNode.height;
        
        let flowType: 'allocated' | 'contingency' | 'unallocated' | 'unassigned' | 'needs-attention' = 'allocated';
        if (node.nodeType === 'scope' && node.value === 0) flowType = 'needs-attention';
        else if (node.nodeType === 'contingency') flowType = 'contingency';
        else if (node.nodeType === 'unallocated') flowType = 'unallocated';
        
        edgeList.push({
          id: `edge-total-${node.id}`,
          sourceId: 'total',
          targetId: node.id,
          value: node.value,
          sourceY: sourceOffset + sourceFlowHeight / 2,
          targetY: node.y + node.height / 2,
          strokeWidth: node.height,
          flowType,
        });
        
        sourceOffset += sourceFlowHeight;
        if (idx < layerNodes[1].length - 1) {
          const gapHeight = (NODE_PADDING / totalTargetHeightWithPadding) * totalNode.height;
          sourceOffset += gapHeight;
        }
      });
    }
    
    return { nodes: nodeList, edges: edgeList };
  }, [hasBudget, totalBudget, scopes, allocations, contingencyValue]);
  
  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId.startsWith('scope-')) {
      const scopeId = nodeId.replace('scope-', '');
      onScrollToScope?.(scopeId);
    } else if (nodeId.startsWith('alloc-')) {
      const allocId = nodeId.replace('alloc-', '');
      onScrollToAllocation?.(allocId);
    } else if (nodeId === 'unallocated' || nodeId === 'unassigned') {
      onScrollToUnallocated?.();
    }
  }, [onScrollToScope, onScrollToAllocation, onScrollToUnallocated]);
  
  const getNodeX = (layer: number) => LAYER_POSITIONS[layer] * SVG_WIDTH;
  
  const renderEdge = (edge: SankeyEdge) => {
    const sourceX = getNodeX(0) + NODE_STROKE_WIDTH;
    const targetX = getNodeX(1);
    
    const cp1X = sourceX + (targetX - sourceX) * 0.3;
    const cp2X = sourceX + (targetX - sourceX) * 0.7;
    
    const d = `M ${sourceX} ${edge.sourceY} 
               C ${cp1X} ${edge.sourceY}, 
                 ${cp2X} ${edge.targetY}, 
                 ${targetX} ${edge.targetY}`;
    
    const isHovered = hoveredEdge === edge.id;
    const strokeColor = FLOW_COLORS[edge.flowType];
    const strokeOpacity = isHovered ? FLOW_OPACITY.hover : FLOW_OPACITY.default;
    
    return (
      <path
        key={edge.id}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeOpacity={strokeOpacity}
        strokeWidth={isHovered ? edge.strokeWidth + 2 : edge.strokeWidth}
        className="cursor-pointer transition-all duration-150"
        onMouseEnter={() => setHoveredEdge(edge.id)}
        onMouseLeave={() => setHoveredEdge(null)}
        onClick={() => handleNodeClick(edge.targetId)}
        data-testid={`sankey-edge-${edge.id}`}
      />
    );
  };
  
  const renderNode = (node: SankeyNode) => {
    const x = getNodeX(node.layer);
    const isHovered = edges.some(e => 
      (e.sourceId === node.id || e.targetId === node.id) && hoveredEdge === e.id
    );
    const useCompactLabel = node.height < 24;
    
    return (
      <g 
        key={node.id}
        className="cursor-pointer"
        onClick={() => handleNodeClick(node.id)}
        data-testid={`sankey-node-${node.id}`}
      >
        <rect
          x={x}
          y={node.y}
          width={NODE_STROKE_WIDTH}
          height={node.height}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        />
        {useCompactLabel ? (
          <text
            x={x + NODE_STROKE_WIDTH + 6}
            y={node.y + node.height / 2}
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={VALUE_FONT_SIZE}
            textDecoration={isHovered ? 'underline' : 'none'}
          >
            {node.label}: {formatCurrency(node.value)}
          </text>
        ) : (
          <>
            <text
              x={x + NODE_STROKE_WIDTH + 6}
              y={node.y + node.height / 2 - 5}
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={LABEL_FONT_SIZE}
              textDecoration={isHovered ? 'underline' : 'none'}
            >
              {node.label}
            </text>
            <text
              x={x + NODE_STROKE_WIDTH + 6}
              y={node.y + node.height / 2 + 7}
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={VALUE_FONT_SIZE}
              fontWeight={600}
            >
              {formatCurrency(node.value)}
            </text>
          </>
        )}
      </g>
    );
  };
  
  if (!hasBudget) {
    return null;
  }
  
  return (
    <section className="space-y-4" data-testid="budget-sankey">
      <button
        onClick={() => setInternalExpanded(!isExpanded)}
        className="text-sm underline-offset-2 hover:underline flex items-center gap-2"
        data-testid="button-toggle-sankey"
      >
        <span>{isExpanded ? '−' : '+'}</span>
        <span>{isExpanded ? 'Hide budget flow' : 'Show budget flow'}</span>
      </button>
      
      {isExpanded && (
        <>
          {isMobile && (
            <div className="flex gap-4 text-sm" data-testid="mobile-view-toggle">
              <button
                onClick={() => setMobileView('summary')}
                className={`underline-offset-2 ${mobileView === 'summary' ? 'underline font-semibold' : 'hover:underline'}`}
                aria-pressed={mobileView === 'summary'}
                data-testid="button-mobile-summary"
              >
                Summary
              </button>
              <button
                onClick={() => setMobileView('flow')}
                className={`underline-offset-2 ${mobileView === 'flow' ? 'underline font-semibold' : 'hover:underline'}`}
                aria-pressed={mobileView === 'flow'}
                data-testid="button-mobile-flow"
              >
                Flow
              </button>
            </div>
          )}
          
          {isMobile && mobileView === 'summary' && (
            <div className="renix-surface p-4" data-testid="sankey-mobile-summary">
              <AllocationBarStack
                totalBudget={totalBudget}
                allocations={allocations}
                contingencyValue={contingencyValue}
              />
            </div>
          )}
          
          {(isMobile && mobileView === 'flow') && (
            <div className="renix-surface p-4" data-testid="sankey-mobile-flow">
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full"
                  style={{ height: '180px', minWidth: '500px' }}
                >
                  {edges.map(renderEdge)}
                  {nodes.map(renderNode)}
                </svg>
              </div>
              <div className="flex flex-wrap gap-4 mt-4 text-xs" data-testid="sankey-legend">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1" style={{ backgroundColor: FLOW_COLORS.allocated, opacity: FLOW_OPACITY.default }} />
                  <span>Allocated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1" style={{ backgroundColor: FLOW_COLORS.contingency, opacity: FLOW_OPACITY.default }} />
                  <span>Contingency</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1" style={{ backgroundColor: FLOW_COLORS.unallocated, opacity: FLOW_OPACITY.default }} />
                  <span>Unallocated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1" style={{ backgroundColor: FLOW_COLORS['needs-attention'], opacity: FLOW_OPACITY.default }} />
                  <span>Needs Attention</span>
                </div>
              </div>
            </div>
          )}
          
          {!isMobile && (
            <div className="renix-surface p-4 overflow-hidden" data-testid="sankey-container">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full"
                style={{ height: '200px', maxHeight: '250px' }}
              >
                {edges.map(renderEdge)}
                {nodes.map(renderNode)}
              </svg>
              <div className="flex flex-wrap gap-6 mt-4 text-xs" data-testid="sankey-legend">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-1" style={{ backgroundColor: FLOW_COLORS.allocated, opacity: FLOW_OPACITY.default }} />
                  <span>Allocated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-1" style={{ backgroundColor: FLOW_COLORS.contingency, opacity: FLOW_OPACITY.default }} />
                  <span>Contingency</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-1" style={{ backgroundColor: FLOW_COLORS.unallocated, opacity: FLOW_OPACITY.default }} />
                  <span>Unallocated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-1" style={{ backgroundColor: FLOW_COLORS['needs-attention'], opacity: FLOW_OPACITY.default }} />
                  <span>Needs Attention</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AllocationBarStack({
  totalBudget,
  allocations,
  contingencyValue,
}: {
  totalBudget: number | null;
  allocations: BudgetAllocation[];
  contingencyValue: number;
}) {
  const { formatCurrency } = useFormatters();
  
  if (!totalBudget || totalBudget <= 0) {
    return null;
  }
  
  const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  const unallocatedAmount = Math.max(0, totalBudget - allocatedTotal - contingencyValue);
  
  const segmentColors: Record<string, string> = {
    'Allocated': FLOW_COLORS.allocated,
    'Contingency': FLOW_COLORS.contingency,
    'Unallocated': FLOW_COLORS.unallocated,
  };
  
  const segments = [
    { label: 'Allocated', value: allocatedTotal, width: (allocatedTotal / totalBudget) * 100 },
    { label: 'Contingency', value: contingencyValue, width: (contingencyValue / totalBudget) * 100 },
    { label: 'Unallocated', value: unallocatedAmount, width: (unallocatedAmount / totalBudget) * 100 },
  ].filter(s => s.value > 0);
  
  return (
    <div className="space-y-2" data-testid="allocation-bar-stack">
      <div className="h-8 flex border border-subtle">
        {segments.map((segment, idx) => (
          <div
            key={segment.label}
            className={`h-full ${idx > 0 ? 'border-l border-subtle' : ''}`}
            style={{ 
              width: `${segment.width}%`,
              backgroundColor: segmentColors[segment.label],
              opacity: FLOW_OPACITY.default,
            }}
            title={`${segment.label}: ${formatCurrency(segment.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {segments.map(segment => (
          <div key={segment.label} className="flex items-center gap-2">
            <span 
              className="w-3 h-3 border border-subtle" 
              style={{ backgroundColor: segmentColors[segment.label], opacity: FLOW_OPACITY.default }}
            />
            <span>{segment.label}:</span>
            <span className="font-semibold">{formatCurrency(segment.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
