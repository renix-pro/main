/**
 * RENIX vNext — Generic Tree Node Component
 * 
 * Individual tree node with support for:
 * - Expand/collapse
 * - Selection
 * - Drag & drop (optional)
 * - Inline editing (optional)
 * - Action menu (optional)
 * - Custom content via render props
 */

import { memo, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ChevronRight, 
  ChevronDown, 
  MoreHorizontal, 
  GripVertical, 
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenericTreeNode as NodeType, GenericTreeNodeProps, TreeNodeRenderProps } from './types';

function GenericTreeNodeInner<T extends NodeType>({
  node,
  selectedNodeId,
  isReadOnly,
  expandedIds,
  overId,
  onSelectNode,
  onToggleExpanded,
  enableDragDrop,
  enableInlineEdit,
  enableAddChild,
  onUpdateNode,
  onCreateNode,
  onMoveNode,
  menuActions,
  renderLeadingContent,
  renderTrailingContent,
  renderActionButtons,
  renderLabel,
  renderExpandedDetail,
  testIdPrefix,
  indentSize,
}: GenericTreeNodeProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const childInputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isDropTarget = overId === node.id;

  // Drag and drop hook (only active when enabled)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: node.id,
    disabled: !enableDragDrop || isReadOnly,
  });

  const style = enableDragDrop ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : undefined;

  // Build render props for customization
  const renderProps: TreeNodeRenderProps<T> = {
    node,
    isSelected,
    isExpanded,
    isHovered,
    isEditing,
    isDragging,
    isDropTarget,
  };

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

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editName.trim() && editName !== node.name && onUpdateNode) {
        onUpdateNode(node.id, { name: editName.trim() });
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setEditName(node.name);
      setIsEditing(false);
    }
  };

  const handleAddChildKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (newChildName.trim() && onCreateNode) {
        onCreateNode(newChildName.trim(), node.id);
        setNewChildName('');
        setIsAddingChild(false);
      }
    } else if (e.key === 'Escape') {
      setNewChildName('');
      setIsAddingChild(false);
    }
  };

  const handleStartEdit = () => {
    if (!isReadOnly && enableInlineEdit) {
      setIsEditing(true);
      setEditName(node.name);
    }
  };

  // Filter menu actions based on show condition
  const visibleMenuActions = menuActions.filter(action => 
    !action.show || action.show(node)
  );

  // Indentation based on depth
  const indentPx = node.depth * indentSize;

  return (
    <div 
      ref={enableDragDrop ? setNodeRef : undefined}
      style={style}
      className="relative transition-opacity pt-[0px] pb-[0px]"
      data-testid={`${testIdPrefix}-node-${node.id}`}
    >
      {/* Node Row */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-all duration-150 cursor-pointer group border bg-card border-border hover-elevate mt-1 mb-1",
          isSelected && "ring-1 ring-foreground/20"
        )}
        style={{ marginLeft: `${indentPx}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelectNode(node.id)}
        data-testid={`${testIdPrefix}-node-row-${node.id}`}
      >
        {/* Expand/Collapse Toggle */}
        <button
          className={cn(
            "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150",
            hasChildren 
              ? "text-foreground/70 hover:text-foreground hover:bg-muted" 
              : "text-muted-foreground/30 cursor-default"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpanded(node.id);
            }
          }}
          data-testid={`${testIdPrefix}-chevron-${node.id}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 stroke-[2]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
          )}
        </button>

        {/* Leading Content (Icon area) */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {renderLeadingContent && renderLeadingContent(renderProps)}

          {/* Label / Name */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={() => {
                  if (editName.trim() && editName !== node.name && onUpdateNode) {
                    onUpdateNode(node.id, { name: editName.trim() });
                  }
                  setIsEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-8 text-sm font-medium bg-background border-primary/20 focus-visible:border-foreground/30"
                data-testid={`${testIdPrefix}-input-edit-${node.id}`}
              />
            ) : renderLabel ? (
              renderLabel(renderProps)
            ) : (
              <span
                className="block text-sm font-normal text-foreground truncate"
                onDoubleClick={handleStartEdit}
                data-testid={`${testIdPrefix}-label-${node.id}`}
              >
                {node.name}
              </span>
            )}
          </div>
        </div>
        
        {/* Trailing Content (badges, amounts) */}
        {renderTrailingContent && !isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {renderTrailingContent(renderProps)}
          </div>
        )}

        {/* Hover Action Buttons */}
        {!isReadOnly && !isEditing && (
          <div className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            {renderActionButtons && renderActionButtons(renderProps)}
            {enableAddChild && onCreateNode && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingChild(true);
                  // Always expand the node when adding a child (helps with visibility)
                  if (!isExpanded) {
                    onToggleExpanded(node.id);
                  }
                }}
                data-testid={`${testIdPrefix}-button-add-child-${node.id}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Action Menu */}
        {!isReadOnly && !isEditing && visibleMenuActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 rounded-lg transition-opacity",
                  isHovered ? "opacity-100" : "opacity-0"
                )}
                onClick={(e) => e.stopPropagation()}
                data-testid={`${testIdPrefix}-menu-trigger-${node.id}`}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {visibleMenuActions.map((action, index) => (
                <DropdownMenuItem
                  key={action.id}
                  className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick(node.id);
                  }}
                  data-testid={`${testIdPrefix}-menu-${action.id}-${node.id}`}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Drag Handle */}
        {enableDragDrop && !isReadOnly && (
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab active:cursor-grabbing p-1 text-muted-foreground transition-opacity",
              isHovered ? "opacity-40 hover:opacity-100" : "opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
            data-testid={`${testIdPrefix}-drag-handle-${node.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </div>
      {/* Add Child Input */}
      {isAddingChild && enableAddChild && (
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
            data-testid={`${testIdPrefix}-input-new-child-${node.id}`}
          />
          <Button
            size="sm"
            className="h-7"
            onClick={() => {
              if (newChildName.trim() && onCreateNode) {
                onCreateNode(newChildName.trim(), node.id);
                setNewChildName('');
                setIsAddingChild(false);
              }
            }}
            data-testid={`${testIdPrefix}-button-add-child-confirm-${node.id}`}
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
            data-testid={`${testIdPrefix}-button-add-child-cancel-${node.id}`}
          >
            Cancel
          </Button>
        </div>
      )}
      {/* Inline Detail Panel (accordion-style, shown for selected node) */}
      {isSelected && renderExpandedDetail && (
        <div style={{ marginLeft: `${indentPx}px` }}>
          {renderExpandedDetail(renderProps)}
        </div>
      )}
      {/* Render Children (when expanded) */}
      {isExpanded && node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <GenericTreeNodeInner
              key={child.id}
              node={child as T}
              selectedNodeId={selectedNodeId}
              isReadOnly={isReadOnly}
              expandedIds={expandedIds}
              overId={overId}
              onSelectNode={onSelectNode}
              onToggleExpanded={onToggleExpanded}
              enableDragDrop={enableDragDrop}
              enableInlineEdit={enableInlineEdit}
              enableAddChild={enableAddChild}
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
      )}
    </div>
  );
}

export const GenericTreeNode = memo(GenericTreeNodeInner) as typeof GenericTreeNodeInner;
