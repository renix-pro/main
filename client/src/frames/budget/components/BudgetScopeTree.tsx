/**
 * RENIX vNext — Budget Scope Tree View
 * 
 * Canon v1.4 Compliant
 * 
 * Displays scope hierarchy with budget allocations in a tree structure.
 * Uses GenericTree component for visual consistency across frames.
 */

import { useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useFormatters, useProject } from '@/context/ProjectContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/api';
import { GenericTree } from '@/components/GenericTree';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { GenericTreeNode, TreeNodeRenderProps } from '@/components/GenericTree/types';
import type { BudgetAllocation } from '../useBudgetData';
import type { ScopeTreeNode, ScopeNode } from '@/frames/scope/useScopeTreeData';

interface BudgetScopeTreeProps {
  rootNodes: ScopeTreeNode[];
  allocations: BudgetAllocation[];
  selectedNodeId: string | null;
  isReadOnly: boolean;
  hasBudget: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onAllocateToScope: (scopeId: string, scopeName: string) => void;
  onEditAllocation: (allocation: BudgetAllocation) => void;
  onDeleteAllocation: (allocation: BudgetAllocation) => void;
  getNode: (nodeId: string) => ScopeNode | undefined;
}

interface BudgetTreeNodeData extends GenericTreeNode {
  totalAllocated: number;
  hasAllocations: boolean;
  scopeName: string;
}

function buildBudgetTreeNodes(
  nodes: ScopeTreeNode[],
  allocationsByScope: Map<string, BudgetAllocation[]>,
  getTotalAllocated: (nodeId: string) => number
): BudgetTreeNodeData[] {
  return nodes.map((node) => {
    const totalAllocated = getTotalAllocated(node.id);
    const children = node.children.length > 0 
      ? buildBudgetTreeNodes(node.children, allocationsByScope, getTotalAllocated)
      : [];
    
    return {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      depth: node.depth,
      sortOrder: node.sortOrder,
      children,
      isExpanded: node.isExpanded,
      totalAllocated,
      hasAllocations: totalAllocated > 0,
      scopeName: node.name,
      metadata: { scopeId: node.id },
    };
  });
}

export function BudgetScopeTree({
  rootNodes,
  allocations,
  selectedNodeId,
  isReadOnly,
  hasBudget,
  onSelectNode,
  onAllocateToScope,
  onEditAllocation,
  onDeleteAllocation,
  getNode,
}: BudgetScopeTreeProps) {
  const { formatCurrency } = useFormatters();
  
  const getExpandedIdsFromTree = useCallback(() => {
    const ids = new Set<string>();
    function collectExpanded(nodes: ScopeTreeNode[]) {
      for (const node of nodes) {
        const nodeData = getNode(node.id);
        if (nodeData?.isExpanded) {
          ids.add(node.id);
        }
        if (node.children.length > 0) {
          collectExpanded(node.children);
        }
      }
    }
    collectExpanded(rootNodes);
    return ids;
  }, [rootNodes, getNode]);
  
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => getExpandedIdsFromTree());
  
  useEffect(() => {
    setExpandedIds(getExpandedIdsFromTree());
  }, [getExpandedIdsFromTree]);
  
  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const isNodeExpanded = useCallback((nodeId: string) => {
    return expandedIds.has(nodeId);
  }, [expandedIds]);

  const allocationsByScope = useMemo(() => {
    const map = new Map<string, BudgetAllocation[]>();
    allocations.forEach(alloc => {
      if (alloc.target.type === 'scope' && alloc.target.scopeId) {
        const existing = map.get(alloc.target.scopeId) || [];
        existing.push(alloc);
        map.set(alloc.target.scopeId, existing);
      }
    });
    return map;
  }, [allocations]);

  const findNodeById = (nodes: ScopeTreeNode[], id: string): ScopeTreeNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const getTotalAllocated = useCallback((nodeId: string): number => {
    const directAllocations = allocationsByScope.get(nodeId) || [];
    const directTotal = directAllocations.reduce((sum, a) => sum + a.amount, 0);
    
    const node = rootNodes.find(n => n.id === nodeId) || findNodeById(rootNodes, nodeId);
    if (!node) return directTotal;
    
    let childrenTotal = 0;
    function sumChildren(nodes: ScopeTreeNode[]) {
      for (const child of nodes) {
        const childAllocs = allocationsByScope.get(child.id) || [];
        childrenTotal += childAllocs.reduce((sum, a) => sum + a.amount, 0);
        if (child.children.length > 0) {
          sumChildren(child.children);
        }
      }
    }
    sumChildren(node.children);
    
    return directTotal + childrenTotal;
  }, [allocationsByScope, rootNodes]);

  const budgetTreeNodes = useMemo(() => 
    buildBudgetTreeNodes(rootNodes, allocationsByScope, getTotalAllocated),
    [rootNodes, allocationsByScope, getTotalAllocated]
  );


  const renderTrailingContent = useCallback((props: TreeNodeRenderProps<BudgetTreeNodeData>): ReactNode => {
    const { node, isHovered } = props;
    const scopeNodeData = getNode(node.id);
    
    return (
      <div className="flex items-center gap-2">
        {scopeNodeData?.costType === 'direct' && (
          <Badge variant="secondary" className="text-[10px]" data-testid={`badge-direct-cost-${node.id}`}>Direct</Badge>
        )}
        {node.hasAllocations ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(node.totalAllocated)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground px-2 py-1 border border-dashed border-border rounded-md">
            Not allocated
          </span>
        )}
        
        {!isReadOnly && hasBudget && isHovered && !node.hasAllocations && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAllocateToScope(node.id, node.scopeName);
            }}
            className="text-xs underline-offset-2 hover:underline text-primary"
            data-testid={`button-allocate-${node.id}`}
          >
            Allocate
          </button>
        )}
      </div>
    );
  }, [formatCurrency, isReadOnly, hasBudget, onAllocateToScope, getNode]);

  const renderExpandedDetail = useCallback((props: { node: { id: string; name: string } }) => {
    const scopeNode = getNode(props.node.id);
    if (!scopeNode) return null;
    const nodeAllocations = allocationsByScope.get(scopeNode.id) || [];
    return (
      <BudgetNodeDetail
        node={scopeNode}
        allocations={nodeAllocations}
        isReadOnly={isReadOnly}
        hasBudget={hasBudget}
        onAllocate={() => onAllocateToScope(scopeNode.id, scopeNode.name)}
        onEditAllocation={onEditAllocation}
        onDeleteAllocation={onDeleteAllocation}
        onClose={() => onSelectNode(null)}
        formatCurrency={formatCurrency}
      />
    );
  }, [getNode, allocationsByScope, isReadOnly, hasBudget, onAllocateToScope, onEditAllocation, onDeleteAllocation, onSelectNode, formatCurrency]);

  return (
    <div className="flex flex-col gap-4 mt-[12px] mb-[12px]" data-testid="budget-scope-tree-container">
      <GenericTree
        nodes={budgetTreeNodes}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onToggleExpanded={toggleExpanded}
        isNodeExpanded={isNodeExpanded}
        isReadOnly={true}
        enableDragDrop={false}
        enableInlineEdit={false}
        enableAddChild={false}
        emptyMessage="No scope nodes defined. Add scopes in the Scope Frame to allocate budget."
        testIdPrefix="budget-tree"
        renderTrailingContent={renderTrailingContent as any}
        renderExpandedDetail={renderExpandedDetail as any}
      />
    </div>
  );
}

interface BudgetNodeDetailProps {
  node: ScopeNode;
  allocations: BudgetAllocation[];
  isReadOnly: boolean;
  hasBudget: boolean;
  onAllocate: () => void;
  onEditAllocation: (allocation: BudgetAllocation) => void;
  onDeleteAllocation: (allocation: BudgetAllocation) => void;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}

function BudgetNodeDetail({
  node,
  allocations,
  isReadOnly,
  hasBudget,
  onAllocate,
  onEditAllocation,
  onDeleteAllocation,
  onClose,
  formatCurrency,
}: BudgetNodeDetailProps) {
  const { projectId } = useProject();
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  const costTypeMutation = useMutation({
    mutationFn: async (newCostType: string) => {
      await apiRequest('PATCH', `/api/projects/${projectId}/scope-nodes/${node.id}`, { costType: newCostType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scopeNodes(projectId) });
    },
  });

  const isDirectCost = node.costType === 'direct';

  return (
    <div 
      className="w-full bg-background border border-border rounded-lg shadow-sm overflow-hidden"
      data-testid="budget-node-detail"
    >
      <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground truncate">{node.name}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`cost-type-${node.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                Direct Cost
              </Label>
              <Switch
                id={`cost-type-${node.id}`}
                checked={isDirectCost}
                disabled={costTypeMutation.isPending}
                onCheckedChange={(checked) => {
                  costTypeMutation.mutate(checked ? 'direct' : 'standard');
                }}
                data-testid={`toggle-cost-type-${node.id}`}
              />
            </div>
          )}
          {isReadOnly && isDirectCost && (
            <Badge variant="secondary" className="text-[10px]">Direct</Badge>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-close-detail"
          >
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {node.description && (
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</span>
            <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="scope-description">
              {node.description}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Allocated</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(totalAllocated)}</span>
        </div>

        {allocations.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Allocations ({allocations.length})
            </div>
            {allocations.map(allocation => (
              <div
                key={allocation.id}
                className="flex items-start justify-between gap-2 py-2 border-t border-border group"
                data-allocation-id={allocation.id}
                data-testid={`detail-allocation-${allocation.id}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{allocation.label}</span>
                  {allocation.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {allocation.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(allocation.amount)}
                  </span>
                  {!isReadOnly && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEditAllocation(allocation)}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                        data-testid={`button-edit-allocation-${allocation.id}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteAllocation(allocation)}
                        className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors"
                        data-testid={`button-delete-allocation-${allocation.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">No allocations yet</p>
            {!isReadOnly && hasBudget && (
              <button
                onClick={onAllocate}
                className="text-sm font-medium text-primary hover:underline"
                data-testid="button-add-allocation"
              >
                Add Allocation
              </button>
            )}
            {!isReadOnly && !hasBudget && (
              <p className="text-xs text-muted-foreground">Set a total budget intent to start allocating</p>
            )}
          </div>
        )}

        {!isReadOnly && hasBudget && allocations.length > 0 && (
          <button
            onClick={onAllocate}
            className="w-full py-2 text-sm font-medium text-primary border border-primary/20 rounded-lg hover-elevate transition-colors"
            data-testid="button-add-more-allocation"
          >
            Add Another Allocation
          </button>
        )}
      </div>
    </div>
  );
}
