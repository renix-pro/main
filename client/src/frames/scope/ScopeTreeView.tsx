import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ChevronRight, 
  ChevronDown, 
  MoreHorizontal, 
  Trash2, 
  Plus,
  FolderKanban,
  Settings,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scopeNodesApi, ScopeNodeImpact } from '@/lib/api';
import type { ScopeTreeNode as ScopeTreeNodeType, ScopeNode } from './useScopeTreeData';

interface FlattenedScopeItem {
  id: string;
  parentId: string | null;
  depth: number;
  index: number;
  name: string;
  children: ScopeTreeNodeType[];
  sortOrder: number;
  collapsed: boolean;
}

function flattenTree(
  nodes: ScopeTreeNodeType[],
  expandedIds: Set<string>,
  parentId: string | null = null,
  depth: number = 0
): FlattenedScopeItem[] {
  return nodes.reduce<FlattenedScopeItem[]>((acc, node, index) => {
    const collapsed = !expandedIds.has(node.id);
    return [
      ...acc,
      {
        id: node.id,
        parentId,
        depth,
        index,
        name: node.name,
        children: node.children,
        sortOrder: node.sortOrder,
        collapsed,
      },
      ...flattenTree(node.children, expandedIds, node.id, depth + 1),
    ];
  }, []);
}

function removeChildrenOf(items: FlattenedScopeItem[], ids: string[]): FlattenedScopeItem[] {
  const excludeParentIds = [...ids];
  return items.filter((item) => {
    if (item.parentId && excludeParentIds.includes(item.parentId)) {
      if (item.children.length) excludeParentIds.push(item.id);
      return false;
    }
    return true;
  });
}

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

function getProjection(
  items: FlattenedScopeItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number
) {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) depth = maxDepth;
  else if (projectedDepth < minDepth) depth = minDepth;

  function getParentId() {
    if (depth === 0 || !previousItem) return null;
    if (depth === previousItem.depth) return previousItem.parentId;
    if (depth > previousItem.depth) return previousItem.id;
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;
    return newParent ?? null;
  }

  return { depth, maxDepth, minDepth, parentId: getParentId() };
}

function getDescendantIds(items: FlattenedScopeItem[], parentId: string): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (item.parentId === parentId) {
      result.push(item.id);
      result.push(...getDescendantIds(items, item.id));
    }
  }
  return result;
}

function countChildren(items: FlattenedScopeItem[], parentId: string): number {
  return getDescendantIds(items, parentId).length;
}

const INDENTATION_WIDTH = 24;

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

interface ScopeTreeProps {
  projectId: string;
  rootNodes: ScopeTreeNodeType[];
  selectedNodeId: string | null;
  isReadOnly: boolean;
  searchTerm?: string;
  onSelectNode: (nodeId: string | null) => void;
  onCreateNode: (name: string, parentId: string | null) => void;
  onUpdateNode: (nodeId: string, updates: { name?: string; description?: string | null; tags?: string[]; isExpanded?: boolean }) => void;
  onMoveNode: (nodeId: string, newParentId: string | null, sortOrder?: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleExpanded: (nodeId: string) => void;
  onAddTag: (nodeId: string, tag: string) => void;
  onRemoveTag: (nodeId: string, tag: string) => void;
  getNode: (nodeId: string) => ScopeNode | undefined;
  onReorderNode: (nodeId: string, newSortOrder: number) => void;
  onSwapNodeOrder: (nodeAId: string, nodeBId: string) => void;
}

function getMatchingNodeIds(
  nodes: ScopeTreeNodeType[],
  term: string,
  getNode: (id: string) => ScopeNode | undefined
): Set<string> {
  const matches = new Set<string>();
  const lowerTerm = term.toLowerCase();

  function traverse(nodeList: ScopeTreeNodeType[]): boolean {
    let anyMatch = false;
    for (const node of nodeList) {
      const nodeData = getNode(node.id);
      const nameMatch = node.name.toLowerCase().includes(lowerTerm);
      const descMatch = nodeData?.description?.toLowerCase().includes(lowerTerm) ?? false;
      const childMatch = node.children.length > 0 ? traverse(node.children) : false;

      if (nameMatch || descMatch || childMatch) {
        matches.add(node.id);
        anyMatch = true;
      }
    }
    return anyMatch;
  }

  traverse(nodes);
  return matches;
}

function filterTree(
  nodes: ScopeTreeNodeType[],
  visibleIds: Set<string>
): ScopeTreeNodeType[] {
  return nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => ({
      ...node,
      children: filterTree(node.children, visibleIds),
    }));
}

function getExpandedIds(nodes: ScopeTreeNodeType[], nodeMap: Map<string, ScopeNode>): Set<string> {
  const expanded = new Set<string>();
  
  function traverse(nodeList: ScopeTreeNodeType[]) {
    for (const node of nodeList) {
      const nodeData = nodeMap.get(node.id);
      if (nodeData?.isExpanded) {
        expanded.add(node.id);
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return expanded;
}

export function ScopeTree({
  projectId,
  rootNodes,
  selectedNodeId,
  isReadOnly,
  searchTerm = '',
  onSelectNode,
  onCreateNode,
  onUpdateNode,
  onMoveNode,
  onDeleteNode,
  onToggleExpanded,
  onAddTag,
  onRemoveTag,
  getNode,
  onReorderNode,
  onSwapNodeOrder,
}: ScopeTreeProps) {
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [impactData, setImpactData] = useState<ScopeNodeImpact | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = searchTerm.trim().length > 0;

  const searchVisibleIds = useMemo(() => {
    if (!isSearching) return null;
    return getMatchingNodeIds(rootNodes, searchTerm.trim(), getNode);
  }, [rootNodes, searchTerm, getNode, isSearching]);

  const effectiveRootNodes = useMemo(() => {
    if (!isSearching || !searchVisibleIds) return rootNodes;
    return filterTree(rootNodes, searchVisibleIds);
  }, [rootNodes, isSearching, searchVisibleIds]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, ScopeNode>();
    function addToMap(nodes: ScopeTreeNodeType[]) {
      for (const node of nodes) {
        const nodeData = getNode(node.id);
        if (nodeData) {
          map.set(node.id, nodeData);
        }
        if (node.children.length > 0) {
          addToMap(node.children);
        }
      }
    }
    addToMap(rootNodes);
    return map;
  }, [rootNodes, getNode]);

  const searchExpandedIds = useMemo(() => {
    if (!isSearching || !searchVisibleIds) return new Set<string>();
    const ids = new Set<string>();
    function collectParents(nodes: ScopeTreeNodeType[]) {
      for (const node of nodes) {
        if (searchVisibleIds!.has(node.id) && node.children.some(c => searchVisibleIds!.has(c.id))) {
          ids.add(node.id);
        }
        if (node.children.length > 0) collectParents(node.children);
      }
    }
    collectParents(rootNodes);
    return ids;
  }, [rootNodes, isSearching, searchVisibleIds]);

  const expandedIds = useMemo(() => {
    if (isSearching) return searchExpandedIds;
    return getExpandedIds(rootNodes, nodeMap);
  }, [rootNodes, nodeMap, isSearching, searchExpandedIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(effectiveRootNodes, expandedIds, null, 0);
    const collapsedIds = flattenedTree
      .filter((i) => i.collapsed && i.children.length > 0)
      .map((i) => i.id);
    return removeChildrenOf(
      flattenedTree,
      activeId ? [activeId, ...collapsedIds] : collapsedIds
    );
  }, [effectiveRootNodes, expandedIds, activeId]);

  const allFlattenedItems = useMemo(() => {
    return flattenTree(effectiveRootNodes, expandedIds, null, 0);
  }, [effectiveRootNodes, expandedIds]);

  const projected =
    activeId && overId
      ? getProjection(flattenedItems, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : null;

  const sortedIds = useMemo(() => flattenedItems.map(({ id }) => id), [flattenedItems]);

  useEffect(() => {
    if (isAddingRoot && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingRoot]);

  const handleAddRoot = () => {
    if (newRootName.trim()) {
      onCreateNode(newRootName.trim(), null);
      setNewRootName('');
      setIsAddingRoot(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddRoot();
    } else if (e.key === 'Escape') {
      setNewRootName('');
      setIsAddingRoot(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setOverId(id);
    setOffsetLeft(0);
    document.body.style.cursor = 'grabbing';
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setOffsetLeft(event.delta.x);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId((event.over?.id as string) ?? null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    document.body.style.cursor = '';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentProjected = projected;

    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    document.body.style.cursor = '';

    if (!over || !currentProjected) return;

    const activeNode = getNode(active.id as string);
    if (!activeNode) return;

    const projectedParentId = currentProjected.parentId;

    if (projectedParentId !== null) {
      const allDescendants = getDescendantIds(allFlattenedItems, active.id as string);
      if (allDescendants.includes(projectedParentId)) {
        return;
      }
    }

    const overItem = flattenedItems.find((i) => i.id === over.id);
    if (!overItem) return;

    const activeItemIndex = flattenedItems.findIndex((i) => i.id === active.id);
    const overItemIndex = flattenedItems.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(flattenedItems, activeItemIndex, overItemIndex);

    const siblings = newItems.filter(
      (i) => i.parentId === projectedParentId && i.id !== active.id
    );

    const insertionIndex = newItems.findIndex((i) => i.id === active.id);

    let newSortOrder: number;

    const prevSibling = (() => {
      for (let i = insertionIndex - 1; i >= 0; i--) {
        if (newItems[i].parentId === projectedParentId && newItems[i].id !== active.id) {
          return newItems[i];
        }
      }
      return null;
    })();

    const nextSibling = (() => {
      for (let i = insertionIndex + 1; i < newItems.length; i++) {
        if (newItems[i].parentId === projectedParentId && newItems[i].id !== active.id) {
          return newItems[i];
        }
      }
      return null;
    })();

    if (!prevSibling && !nextSibling) {
      newSortOrder = 1000;
    } else if (!prevSibling) {
      newSortOrder = nextSibling!.sortOrder - 1000;
    } else if (!nextSibling) {
      newSortOrder = prevSibling.sortOrder + 1000;
    } else {
      newSortOrder = Math.floor((prevSibling.sortOrder + nextSibling.sortOrder) / 2);
      if (newSortOrder <= prevSibling.sortOrder) {
        newSortOrder = prevSibling.sortOrder + 1;
      }
    }

    if (activeNode.parentId !== projectedParentId) {
      onMoveNode(active.id as string, projectedParentId, newSortOrder);
    } else if (newSortOrder !== activeNode.sortOrder) {
      onReorderNode(active.id as string, newSortOrder);
    }
  };

  const handleDeleteClick = async (nodeId: string) => {
    setIsLoadingImpact(true);
    setPendingDeleteId(nodeId);
    
    try {
      const impact = await scopeNodesApi.getImpact(projectId, nodeId);
      setImpactData(impact);
    } catch (err) {
      console.error('Failed to load impact data:', err);
      const node = getNode(nodeId);
      setImpactData({
        nodeId,
        nodeName: node?.name ?? 'Unknown',
        descendantCount: 0,
        budgetAllocations: { count: 0, totalAmount: 0, currency: 'USD' },
        quoteReferences: { count: 0, vendorNames: [] },
        executionTasks: { count: 0 },
        hasImpact: false,
      });
    } finally {
      setIsLoadingImpact(false);
    }
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      onDeleteNode(pendingDeleteId);
      if (selectedNodeId === pendingDeleteId) {
        onSelectNode(null);
      }
    }
    setPendingDeleteId(null);
    setImpactData(null);
  };

  const handleCancelDelete = () => {
    setPendingDeleteId(null);
    setImpactData(null);
  };

  const activeItem = activeId
    ? flattenedItems.find((i) => i.id === activeId) ??
      allFlattenedItems.find((i) => i.id === activeId)
    : null;

  const activeChildCount = activeId ? countChildren(allFlattenedItems, activeId) : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="scope-tree-container">
      <div className="min-w-0">
        <div 
          className="bg-background border border-border rounded-lg shadow-sm overflow-hidden" 
          data-testid="scope-tree"
        >
          <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Scope Tree</span>
          </div>
          
          <div className="p-2 flex flex-col min-h-[200px]">
            {effectiveRootNodes.length === 0 && !isAddingRoot && (
              <div className="py-8 text-center text-sm text-muted-foreground flex-1" data-testid="scope-tree-empty">
                {isSearching
                  ? 'No scopes match your search.'
                  : 'No scope nodes defined. Click "Add" to create your first scope.'}
              </div>
            )}
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              measuring={measuring}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {flattenedItems.map((item) => {
                    const displayDepth =
                      item.id === activeId && projected
                        ? projected.depth
                        : item.depth;
                    return (
                      <SortableTreeItem
                        key={item.id}
                        id={item.id}
                        flatItem={item}
                        depth={displayDepth}
                        indentationWidth={INDENTATION_WIDTH}
                        projectId={projectId}
                        selectedNodeId={selectedNodeId}
                        isReadOnly={isReadOnly}
                        expandedIds={expandedIds}
                        flattenedItems={flattenedItems}
                        onSelectNode={onSelectNode}
                        onCreateNode={onCreateNode}
                        onUpdateNode={onUpdateNode}
                        onMoveNode={onMoveNode}
                        onToggleExpanded={onToggleExpanded}
                        onDeleteClick={handleDeleteClick}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        getNode={getNode}
                        onReorderNode={onReorderNode}
                        onSwapNodeOrder={onSwapNodeOrder}
                      />
                    );
                  })}
                </div>
              </SortableContext>
              
              <DragOverlay dropAnimation={null}>
                {activeId && activeItem ? (
                  <div className="flex items-center gap-2 p-2 rounded-md shadow-lg border bg-card border-border pointer-events-none w-fit max-w-[320px]" style={{ opacity: 0.92 }}>
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-foreground/70">
                      <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
                    </div>
                    <span className="text-sm font-medium truncate">{activeItem.name}</span>
                    {activeChildCount > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">(+{activeChildCount})</span>
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            
            <div className="mt-auto pt-4 border-t border-border/50">
              {!isReadOnly && !isAddingRoot && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingRoot(true)}
                  className="w-full justify-start text-muted-foreground hover:text-foreground h-9"
                  data-testid="button-add-scope-bottom"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope
                </Button>
              )}

              {isAddingRoot && (
                <div className="mt-2 flex items-center gap-2 px-2">
                  <Input
                    ref={inputRef}
                    value={newRootName}
                    onChange={(e) => setNewRootName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      if (!newRootName.trim()) {
                        setIsAddingRoot(false);
                      }
                    }}
                    placeholder="New scope name..."
                    className="flex-1 text-sm bg-background"
                    data-testid="input-new-root-name"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddRoot}
                    disabled={!newRootName.trim()}
                    data-testid="button-confirm-add-root"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewRootName('');
                      setIsAddingRoot(false);
                    }}
                    data-testid="button-cancel-add-root"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <DeleteConfirmationModal
        isOpen={pendingDeleteId !== null && impactData !== null}
        isLoading={isLoadingImpact}
        impactData={impactData}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

interface SortableTreeItemProps {
  id: string;
  flatItem: FlattenedScopeItem;
  depth: number;
  indentationWidth: number;
  projectId: string;
  selectedNodeId: string | null;
  isReadOnly: boolean;
  expandedIds: Set<string>;
  flattenedItems: FlattenedScopeItem[];
  onSelectNode: (nodeId: string | null) => void;
  onCreateNode: (name: string, parentId: string | null) => void;
  onUpdateNode: (nodeId: string, updates: { name?: string; description?: string | null; tags?: string[]; isExpanded?: boolean }) => void;
  onMoveNode: (nodeId: string, newParentId: string | null, sortOrder?: number) => void;
  onToggleExpanded: (nodeId: string) => void;
  onDeleteClick: (nodeId: string) => void;
  onAddTag: (nodeId: string, tag: string) => void;
  onRemoveTag: (nodeId: string, tag: string) => void;
  getNode: (nodeId: string) => ScopeNode | undefined;
  onReorderNode: (nodeId: string, newSortOrder: number) => void;
  onSwapNodeOrder: (nodeAId: string, nodeBId: string) => void;
}

function SortableTreeItem({
  id,
  flatItem,
  depth,
  indentationWidth,
  projectId,
  selectedNodeId,
  isReadOnly,
  expandedIds,
  flattenedItems,
  onSelectNode,
  onCreateNode,
  onUpdateNode,
  onMoveNode,
  onToggleExpanded,
  onDeleteClick,
  onAddTag,
  onRemoveTag,
  getNode,
  onReorderNode,
  onSwapNodeOrder,
}: SortableTreeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(flatItem.name);
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isReadOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const sortedSiblings = useMemo(() => {
    return flattenedItems
      .filter((i) => i.parentId === flatItem.parentId)
      .map((i) => ({ flatItem: i, data: getNode(i.id) }))
      .filter((s) => s.data !== undefined)
      .sort((a, b) => a.data!.sortOrder - b.data!.sortOrder);
  }, [flattenedItems, flatItem.parentId, getNode]);

  const siblingIndex = sortedSiblings.findIndex((s) => s.flatItem.id === id);
  const isFirst = siblingIndex === 0;
  const isLast = siblingIndex === sortedSiblings.length - 1;

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFirst || siblingIndex < 1) return;
    const prev = sortedSiblings[siblingIndex - 1].flatItem;
    onSwapNodeOrder(id, prev.id);
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLast || siblingIndex < 0) return;
    const next = sortedSiblings[siblingIndex + 1].flatItem;
    onSwapNodeOrder(id, next.id);
  };

  const hasChildren = flatItem.children.length > 0;
  const isSelected = selectedNodeId === id;
  const isExpanded = expandedIds.has(id);
  const selectedNode = isSelected ? getNode(id) : null;
  const node = getNode(id);

  const indentPx = depth * indentationWidth;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isAddingChild && childInputRef.current) {
      childInputRef.current.focus();
    }
  }, [isAddingChild]);

  useEffect(() => {
    setEditName(flatItem.name);
  }, [flatItem.name]);

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editName.trim() && editName !== flatItem.name) {
        onUpdateNode(id, { name: editName.trim() });
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setEditName(flatItem.name);
      setIsEditing(false);
    }
  };

  const handleAddChildKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (newChildName.trim()) {
        onCreateNode(newChildName.trim(), id);
        setNewChildName('');
        setIsAddingChild(false);
      }
    } else if (e.key === 'Escape') {
      setNewChildName('');
      setIsAddingChild(false);
    }
  };

  const handleStartEdit = () => {
    if (!isReadOnly) {
      setIsEditing(true);
      setEditName(flatItem.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "relative",
        isDragging && "opacity-30"
      )}
      data-testid={`scope-tree-node-${id}`}
    >
      <div
        {...(!isReadOnly ? listeners : {})}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-all duration-150 group border bg-card border-border hover-elevate mt-1 mb-1",
          isReadOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        )}
        style={{ marginLeft: `${indentPx}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelectNode(id)}
        data-testid={`scope-node-row-${id}`}
      >
        <button
          className={cn(
            "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150",
            hasChildren 
              ? "text-foreground/70 hover:text-foreground hover:bg-muted" 
              : "text-muted-foreground/30 cursor-default"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpanded(id);
            }
          }}
          data-testid={`chevron-${id}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 stroke-[2]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={() => {
                  if (editName.trim() && editName !== flatItem.name) {
                    onUpdateNode(id, { name: editName.trim() });
                  }
                  setIsEditing(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="h-8 text-sm font-medium bg-background border-primary/20 focus-visible:border-foreground/30"
                data-testid={`input-edit-name-${id}`}
              />
            ) : (
              <span
                className="block text-sm font-normal text-foreground truncate"
                onDoubleClick={handleStartEdit}
                data-testid={`text-node-name-${id}`}
              >
                {flatItem.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {node && node.tags.length > 0 && !isEditing && (
            <div className="flex gap-1 flex-shrink-0 mr-1">
              {node.tags.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground rounded-full"
                  data-testid={`tag-${id}-${tag}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {!isReadOnly && !isEditing && (
            <div 
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "hidden md:flex items-center gap-1 transition-opacity duration-200",
                isHovered ? "opacity-100" : "opacity-0"
              )}
            >
              {!isFirst && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handleMoveUp}
                  title="Move Up"
                  data-testid={`button-move-up-${id}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
              {!isLast && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handleMoveDown}
                  title="Move Down"
                  data-testid={`button-move-down-${id}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingChild(true);
                }}
                title="Add Child"
                data-testid={`button-add-child-hover-${id}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit();
                }}
                title="Rename"
                data-testid={`button-rename-hover-${id}`}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(id);
                }}
                title="Delete"
                data-testid={`button-delete-hover-${id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {!isReadOnly && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-lg transition-opacity",
                    "opacity-100 md:opacity-0",
                    isHovered && "md:opacity-100"
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`action-menu-trigger-${id}`}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAddingChild(true);
                  }}
                  data-testid={`menu-add-child-${id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Child
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                  data-testid={`menu-rename-${id}`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {flatItem.parentId !== null && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveNode(id, null, 0);
                    }}
                    data-testid={`menu-move-to-top-${id}`}
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Move to Top Level
                  </DropdownMenuItem>
                )}
                {!isFirst && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(e);
                    }}
                    data-testid={`menu-move-up-${id}`}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                )}
                {!isLast && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(e);
                    }}
                    data-testid={`menu-move-down-${id}`}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(id);
                  }}
                  data-testid={`menu-delete-${id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

        </div>
      </div>

      {isAddingChild && (
        <div 
          className="flex items-center gap-2 py-1.5 px-2"
          style={{ paddingLeft: `${indentPx + 48}px` }}
        >
          <Input
            ref={childInputRef}
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            onKeyDown={handleAddChildKeyDown}
            onBlur={() => {
              if (!newChildName.trim()) {
                setIsAddingChild(false);
              }
            }}
            placeholder="New child name..."
            className="flex-1 h-7 text-sm bg-background"
            data-testid={`input-new-child-${id}`}
          />
          <Button
            size="sm"
            className="h-7"
            onClick={() => {
              if (newChildName.trim()) {
                onCreateNode(newChildName.trim(), id);
                setNewChildName('');
                setIsAddingChild(false);
              }
            }}
            disabled={!newChildName.trim()}
            data-testid={`button-confirm-add-child-${id}`}
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => {
              setNewChildName('');
              setIsAddingChild(false);
            }}
            data-testid={`button-cancel-add-child-${id}`}
          >
            Cancel
          </Button>
        </div>
      )}

      {isSelected && selectedNode && (
        <div style={{ marginLeft: `${indentPx}px` }}>
          <ScopeNodeEditor
            node={selectedNode}
            isReadOnly={isReadOnly}
            onUpdateNode={onUpdateNode}
            onDeleteClick={onDeleteClick}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateChild={(name) => onCreateNode(name, id)}
            onClose={() => onSelectNode(null)}
          />
        </div>
      )}
    </div>
  );
}

interface ScopeNodeEditorProps {
  node: ScopeNode;
  isReadOnly: boolean;
  onUpdateNode: (nodeId: string, updates: { name?: string; description?: string | null; tags?: string[] }) => void;
  onDeleteClick: (nodeId: string) => void;
  onAddTag: (nodeId: string, tag: string) => void;
  onRemoveTag: (nodeId: string, tag: string) => void;
  onCreateChild: (name: string) => void;
  onClose: () => void;
}

function ScopeNodeEditor({
  node,
  isReadOnly,
  onUpdateNode,
  onDeleteClick,
  onAddTag,
  onRemoveTag,
  onCreateChild,
  onClose,
}: ScopeNodeEditorProps) {
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description || '');
  const [newTag, setNewTag] = useState('');
  const [newChildName, setNewChildName] = useState('');

  // Sync when node changes
  useEffect(() => {
    setName(node.name);
    setDescription(node.description || '');
  }, [node.id, node.name, node.description]);

  const handleSaveName = () => {
    if (name.trim() && name !== node.name) {
      onUpdateNode(node.id, { name: name.trim() });
    }
  };

  const handleSaveDescription = () => {
    const trimmedDesc = description.trim() || null;
    if (trimmedDesc !== node.description) {
      onUpdateNode(node.id, { description: trimmedDesc });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !node.tags.includes(newTag.trim())) {
      onAddTag(node.id, newTag.trim());
      setNewTag('');
    }
  };

  const handleAddChild = () => {
    if (newChildName.trim()) {
      onCreateChild(newChildName.trim());
      setNewChildName('');
    }
  };

  return (
    <div 
      className="w-full bg-background border border-border rounded-lg shadow-sm overflow-hidden"
      data-testid="scope-node-editor"
    >
      {/* Editor Header */}
      <div className="border-b border-border px-4 py-3 bg-muted/30 flex items-center justify-between mt-[8px] mb-[8px]">
        <span className="text-sm font-medium text-foreground">Details</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 px-2 text-muted-foreground"
          data-testid="button-close-editor"
        >
          Close
        </Button>
      </div>
      {/* Editor Content */}
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {/* Name Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            disabled={isReadOnly}
            className="text-sm bg-background"
            data-testid="input-editor-name"
          />
        </div>
        
        {/* Description Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Add a description..."
            disabled={isReadOnly}
            className="text-sm bg-background resize-none"
            rows={3}
            data-testid="textarea-editor-description"
          />
        </div>
        
        {/* Tags Section */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tags
          </label>
          {node.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded"
                  data-testid={`editor-tag-${tag}`}
                >
                  {tag}
                  {!isReadOnly && (
                    <button
                      onClick={() => onRemoveTag(node.id, tag)}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                      data-testid={`button-remove-tag-${tag}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
                className="flex-1 text-sm bg-background"
                data-testid="input-new-tag"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddTag}
                disabled={!newTag.trim() || node.tags.includes(newTag.trim())}
                data-testid="button-add-tag"
              >
                Add
              </Button>
            </div>
          )}
        </div>
        
        {/* Add Child Section */}
        {!isReadOnly && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Add Child Node
            </label>
            <div className="flex gap-2">
              <Input
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChild();
                  }
                }}
                placeholder="Child node name..."
                className="flex-1 text-sm bg-background"
                data-testid="input-add-child-name"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddChild}
                disabled={!newChildName.trim()}
                data-testid="button-add-child"
              >
                Add
              </Button>
            </div>
          </div>
        )}
        
        {/* Delete Action */}
        {!isReadOnly && (
          <div className="pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteClick(node.id)}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
              data-testid="button-delete-node"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Node
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  isLoading: boolean;
  impactData: ScopeNodeImpact | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmationModal({
  isOpen,
  isLoading,
  impactData,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  if (!impactData) return null;

  const impacts: string[] = [];
  
  if (impactData.descendantCount > 0) {
    impacts.push(`${impactData.descendantCount} child node${impactData.descendantCount > 1 ? 's' : ''}`);
  }
  if (impactData.budgetAllocations.count > 0) {
    const amount = impactData.budgetAllocations.totalAmount.toLocaleString();
    impacts.push(`${impactData.budgetAllocations.currency} ${amount} in budget allocations`);
  }
  if (impactData.quoteReferences.count > 0) {
    impacts.push(`${impactData.quoteReferences.count} vendor quote${impactData.quoteReferences.count > 1 ? 's' : ''}`);
  }
  if (impactData.executionTasks.count > 0) {
    impacts.push(`${impactData.executionTasks.count} execution task${impactData.executionTasks.count > 1 ? 's' : ''}`);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="delete-confirmation-modal">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">Delete '{impactData.nodeName}'?</DialogTitle>
          <DialogDescription className="pt-2" data-testid="modal-description">
            {impactData.hasImpact ? (
              <>
                <span className="block mb-2">This scope contains:</span>
                <ul className="list-disc pl-4 space-y-1 text-foreground">
                  {impacts.map((impact, i) => (
                    <li key={i} data-testid={`impact-item-${i}`}>{impact}</li>
                  ))}
                </ul>
                <span className="block mt-3 text-muted-foreground">
                  Deleting will remove this scope structure. Linked data will be detached but preserved.
                </span>
              </>
            ) : (
              <span>
                Are you sure you want to delete this scope node? This action cannot be undone.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-delete"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="button-confirm-delete"
          >
            {isLoading ? 'Checking...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
