/**
 * RENIX vNext — Generic Tree Component
 * 
 * Unified tree component for all frames:
 * - Scope Frame (full editing, drag-drop)
 * - Budget Frame (read-only with allocations)
 * - Quotes Frame (read-only with status)
 * - Invoices Frame
 * - Execution Frame
 * 
 * Features:
 * - Expand/collapse with chevrons
 * - Single selection
 * - Optional drag & drop reordering
 * - Optional inline editing
 * - Optional action menu
 * - Customizable via render props
 */

import { useMemo, useState, useCallback } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { GenericTreeNode as NodeType, GenericTreeProps } from './types';
import { GenericTreeNode } from './GenericTreeNode';

// Flatten tree for sortable context (visible nodes only)
function flattenTree<T extends NodeType>(nodes: T[], expandedIds: Set<string>): T[] {
  const result: T[] = [];
  
  function traverse(nodeList: T[]) {
    for (const node of nodeList) {
      result.push(node);
      if (node.children.length > 0 && expandedIds.has(node.id)) {
        traverse(node.children as T[]);
      }
    }
  }
  
  traverse(nodes);
  return result;
}

// Build a flat map of ALL nodes (including collapsed) for DnD calculations
function buildNodeMap<T extends NodeType>(nodes: T[]): Map<string, T> {
  const map = new Map<string, T>();
  
  function traverse(nodeList: T[]) {
    for (const node of nodeList) {
      map.set(node.id, node);
      if (node.children.length > 0) {
        traverse(node.children as T[]);
      }
    }
  }
  
  traverse(nodes);
  return map;
}

// Check if nodeId is a descendant of potentialAncestorId
function isDescendant<T extends NodeType>(nodeMap: Map<string, T>, nodeId: string, potentialAncestorId: string): boolean {
  let current = nodeMap.get(nodeId);
  while (current && current.parentId) {
    if (current.parentId === potentialAncestorId) return true;
    current = nodeMap.get(current.parentId);
  }
  return false;
}

export function GenericTree<T extends NodeType>({
  nodes,
  selectedNodeId,
  onSelectNode,
  onToggleExpanded,
  isNodeExpanded,
  isReadOnly = false,
  enableDragDrop = false,
  onMoveNode,
  enableInlineEdit = false,
  onUpdateNode,
  enableAddChild = false,
  onCreateNode,
  menuActions = [],
  renderLeadingContent,
  renderTrailingContent,
  renderActionButtons,
  renderLabel,
  renderExpandedDetail,
  title,
  headerActions,
  emptyMessage = 'No items',
  className,
  testIdPrefix = 'tree',
  indentSize = 24,
}: GenericTreeProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Build expanded IDs set
  const expandedIds = useMemo(() => {
    const ids = new Set<string>();
    function collectExpanded(nodeList: T[]) {
      for (const node of nodeList) {
        if (isNodeExpanded(node.id)) {
          ids.add(node.id);
        }
        if (node.children.length > 0) {
          collectExpanded(node.children as T[]);
        }
      }
    }
    collectExpanded(nodes);
    return ids;
  }, [nodes, isNodeExpanded]);

  // Flatten visible nodes for drag and drop
  const flatNodes = useMemo(() => flattenTree(nodes, expandedIds), [nodes, expandedIds]);
  const flatNodeIds = useMemo(() => flatNodes.map(n => n.id), [flatNodes]);
  
  // Build full node map for DnD calculations (includes collapsed nodes)
  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id || !onMoveNode) return;

    const activeNode = nodeMap.get(active.id as string);
    const overNode = nodeMap.get(over.id as string);

    if (!activeNode || !overNode) return;

    // Prevent dropping into own descendants
    if (isDescendant(nodeMap, overNode.id, activeNode.id)) {
      return;
    }

    // Hierarchical DnD logic:
    // - If over node is expanded (has visible children), make active node first child
    // - Otherwise, place active node as sibling after over node
    
    const overIsExpanded = expandedIds.has(overNode.id);
    const overHasChildren = overNode.children.length > 0;
    
    let newParentId: string | null;
    let sortOrder: number;
    
    // Helper to get siblings' sort orders from FULL tree (not just visible)
    const getSiblingsSortOrders = (parentId: string | null): number[] => {
      const sortOrders: number[] = [];
      nodeMap.forEach((node) => {
        if (node.parentId === parentId && node.id !== activeNode.id) {
          sortOrders.push(node.sortOrder ?? 0);
        }
      });
      return sortOrders.sort((a, b) => a - b);
    };
    
    if (overIsExpanded && overHasChildren) {
      // Make active node first child of over node
      newParentId = overNode.id;
      const childSortOrders = getSiblingsSortOrders(overNode.id);
      sortOrder = childSortOrders.length > 0 ? childSortOrders[0] - 1000 : 0;
    } else {
      // Place as sibling after over node
      newParentId = overNode.parentId;
      const siblingSortOrders = getSiblingsSortOrders(newParentId);
      const overSortOrder = overNode.sortOrder ?? 0;
      
      // Find next sibling's sort order
      const nextSortOrder = siblingSortOrders.find(s => s > overSortOrder);
      if (nextSortOrder !== undefined) {
        // Place between over and next
        sortOrder = overSortOrder + Math.floor((nextSortOrder - overSortOrder) / 2);
      } else {
        // Place at end
        sortOrder = overSortOrder + 1000;
      }
    }

    onMoveNode(activeNode.id, newParentId, sortOrder);
  }, [nodeMap, expandedIds, onMoveNode]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  // Find active node for drag overlay
  const activeNode = activeId ? flatNodes.find(n => n.id === activeId) : null;

  // Tree content
  const treeContent = (
    <div className="space-y-2">
      {nodes.map((node) => (
        <GenericTreeNode
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          isReadOnly={isReadOnly}
          expandedIds={expandedIds}
          overId={overId}
          onSelectNode={onSelectNode}
          onToggleExpanded={onToggleExpanded}
          enableDragDrop={enableDragDrop && !isReadOnly}
          enableInlineEdit={enableInlineEdit && !isReadOnly}
          enableAddChild={enableAddChild && !isReadOnly}
          onUpdateNode={onUpdateNode}
          onCreateNode={onCreateNode}
          onMoveNode={onMoveNode}
          menuActions={menuActions}
          renderLeadingContent={renderLeadingContent}
          renderTrailingContent={renderTrailingContent}
          renderActionButtons={renderActionButtons}
          renderLabel={renderLabel}
          renderExpandedDetail={renderExpandedDetail}
          testIdPrefix={testIdPrefix}
          indentSize={indentSize}
        />
      ))}
    </div>
  );

  return (
    <div 
      className={cn("bg-background border border-border rounded-lg shadow-sm overflow-hidden", className)}
      data-testid={`${testIdPrefix}-container`}
    >
      {/* Header */}
      {(title || headerActions) && (
        <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between">
          {title && <span className="text-sm font-medium text-foreground">{title}</span>}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      
      {/* Tree Content */}
      <div className="p-2 flex flex-col min-h-[200px]">
        {nodes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex-1" data-testid={`${testIdPrefix}-empty`}>
            {emptyMessage}
          </div>
        ) : enableDragDrop && !isReadOnly ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={flatNodeIds} strategy={verticalListSortingStrategy}>
              {treeContent}
            </SortableContext>
            
            <DragOverlay>
              {activeNode && (
                <div className="bg-card border border-primary shadow-lg rounded-xl p-3 opacity-90">
                  <span className="text-sm font-semibold">{activeNode.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          treeContent
        )}
      </div>
    </div>
  );
}
