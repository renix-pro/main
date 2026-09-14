/**
 * RENIX vNext — Allocation Dialog
 * 
 * Shows after extraction acceptance.
 * Question: "Does this entire quote apply to this scope?"
 * - "Yes" → allocate ALL rows to the scope
 * - "No" → user selects sections/rows with checkboxes
 * 
 * Section selection allocates all descendants.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AcceptedTreeNode } from './ExtractionReviewScreen';

export interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeName: string;
  tree: AcceptedTreeNode[];
  formatCurrency: (amount: number | null) => string;
  onAllocateAll: () => void;
  onAllocateSelected: (selectedRowIds: string[]) => void;
  isProcessing?: boolean;
}

interface SelectableNode extends AcceptedTreeNode {
  children: SelectableNode[];
}

function cloneTreeAsSelectable(nodes: AcceptedTreeNode[]): SelectableNode[] {
  return nodes.map(node => ({
    ...node,
    children: cloneTreeAsSelectable(node.children),
  }));
}

function collectAllIds(nodes: SelectableNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectAllIds(node.children));
  }
  return ids;
}

function collectDescendantIds(node: SelectableNode): string[] {
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

function findNode(nodes: SelectableNode[], id: string): SelectableNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

interface TreeRowProps {
  node: SelectableNode;
  depth: number;
  selectedIds: Set<string>;
  expandedSections: Set<string>;
  onToggleSection: (nodeId: string) => void;
  onToggleSelection: (nodeId: string, withDescendants: boolean) => void;
  formatCurrency: (amount: number | null) => string;
}

function TreeRow({
  node,
  depth,
  selectedIds,
  expandedSections,
  onToggleSection,
  onToggleSelection,
  formatCurrency,
}: TreeRowProps) {
  const isSection = node.rowType === 'section';
  const isExpanded = expandedSections.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedIds.has(node.id);
  const paddingLeft = depth * 20;

  const handleCheckboxChange = useCallback((checked: boolean) => {
    onToggleSelection(node.id, isSection && hasChildren);
  }, [node.id, isSection, hasChildren, onToggleSelection]);

  return (
    <>
      <div
        className={`
          flex items-center gap-2 py-2 px-3 border-b border-subtle/30
          ${isSection ? 'bg-muted/20' : ''}
          ${node.rowType === 'subtotal' ? 'font-medium bg-muted/10' : ''}
        `}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        data-testid={`allocation-row-${node.id}`}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          data-testid={`checkbox-row-${node.id}`}
        />

        {isSection && hasChildren ? (
          <button
            onClick={() => onToggleSection(node.id)}
            className="shrink-0 p-0.5 hover:bg-muted/30 rounded transition-colors"
            data-testid={`button-toggle-${node.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted" />
            )}
          </button>
        ) : (
          <div className="w-5 shrink-0" />
        )}

        {node.number && (
          <span 
            className="shrink-0 text-xs text-muted font-mono min-w-[3rem]"
            data-testid={`row-number-${node.id}`}
          >
            {node.number}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <span 
            className="text-xs line-clamp-2"
            data-testid={`row-description-${node.id}`}
          >
            {node.description || (isSection ? 'Section' : 'Item')}
          </span>
        </div>

        {node.totalPrice !== null && (
          <span 
            className="shrink-0 text-xs min-w-[6rem] text-right"
            data-testid={`row-price-${node.id}`}
          >
            {formatCurrency(node.totalPrice)}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <>
          {node.children.map(child => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onToggleSelection={onToggleSelection}
              formatCurrency={formatCurrency}
            />
          ))}
        </>
      )}
    </>
  );
}

export function AllocationDialog({
  open,
  onOpenChange,
  scopeName,
  tree,
  formatCurrency,
  onAllocateAll,
  onAllocateSelected,
  isProcessing = false,
}: AllocationDialogProps) {
  const [mode, setMode] = useState<'question' | 'selection'>('question');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const sections = new Set<string>();
    const collectSections = (nodes: AcceptedTreeNode[]) => {
      for (const node of nodes) {
        if (node.rowType === 'section') {
          sections.add(node.id);
        }
        collectSections(node.children);
      }
    };
    collectSections(tree);
    return sections;
  });

  const selectableTree = useMemo(() => cloneTreeAsSelectable(tree), [tree]);
  const allIds = useMemo(() => collectAllIds(selectableTree), [selectableTree]);

  const handleToggleSection = useCallback((nodeId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleToggleSelection = useCallback((nodeId: string, withDescendants: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(nodeId);
      
      if (isCurrentlySelected) {
        next.delete(nodeId);
        if (withDescendants) {
          const node = findNode(selectableTree, nodeId);
          if (node) {
            const descendantIds = collectDescendantIds(node);
            for (const id of descendantIds) {
              next.delete(id);
            }
          }
        }
      } else {
        next.add(nodeId);
        if (withDescendants) {
          const node = findNode(selectableTree, nodeId);
          if (node) {
            const descendantIds = collectDescendantIds(node);
            for (const id of descendantIds) {
              next.add(id);
            }
          }
        }
      }
      
      return next;
    });
  }, [selectableTree]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAllocateAll = useCallback(() => {
    onAllocateAll();
  }, [onAllocateAll]);

  const handleAllocateSelected = useCallback(() => {
    onAllocateSelected(Array.from(selectedIds));
  }, [onAllocateSelected, selectedIds]);

  const handleNoSelectRows = useCallback(() => {
    setMode('selection');
    setSelectedIds(new Set());
  }, []);

  const handleBackToQuestion = useCallback(() => {
    setMode('question');
  }, []);

  const selectedCount = selectedIds.size;
  const totalCount = allIds.length;

  if (mode === 'question') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl" data-testid="allocation-drawer-question">
          <SheetHeader>
            <SheetTitle>Allocate to Scope</SheetTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Does this entire quote apply to "{scopeName}"?
            </p>
          </SheetHeader>
          
          <div className="flex flex-col gap-3 py-4">
            <Button
              onClick={handleAllocateAll}
              disabled={isProcessing}
              className="w-full"
              data-testid="button-allocate-all"
            >
              <Check className="w-4 h-4 mr-2" />
              Yes, allocate all rows
            </Button>
            <Button
              variant="outline"
              onClick={handleNoSelectRows}
              disabled={isProcessing}
              className="w-full border-subtle"
              data-testid="button-select-rows"
            >
              No, let me select specific rows
            </Button>
          </div>

          <div className="pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              data-testid="button-cancel-allocation"
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" data-testid="allocation-drawer-selection">
        <SheetHeader>
          <SheetTitle>Select Rows to Allocate</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Choose which rows to allocate to "{scopeName}". 
            Selecting a section will include all items within it.
          </p>
        </SheetHeader>

        <div className="flex items-center justify-between py-2 border-b border-subtle/30">
          <span className="text-xs text-muted">
            {selectedCount} of {totalCount} rows selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={isProcessing}
              data-testid="button-select-all"
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              disabled={isProcessing}
              data-testid="button-deselect-all"
            >
              Deselect all
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
          <div className="border border-subtle/30 rounded-lg overflow-hidden">
            {selectableTree.map(node => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedIds={selectedIds}
                expandedSections={expandedSections}
                onToggleSection={handleToggleSection}
                onToggleSelection={handleToggleSelection}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t flex-wrap">
          <Button
            variant="ghost"
            onClick={handleBackToQuestion}
            disabled={isProcessing}
            data-testid="button-back-to-question"
          >
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="border-subtle"
              data-testid="button-cancel-selection"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAllocateSelected}
              disabled={isProcessing || selectedCount === 0}
              data-testid="button-confirm-allocation"
            >
              <Check className="w-4 h-4 mr-2" />
              Allocate {selectedCount} row{selectedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
