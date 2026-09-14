/**
 * RENIX vNext — Generic Tree Types
 * 
 * Shared tree component types used across all frames:
 * - Scope Frame (full editing)
 * - Budget Frame (read-only with allocations)
 * - Quotes Frame (read-only with status)
 * - Invoices Frame
 * - Execution Frame
 */

import { ReactNode } from 'react';

/**
 * Base tree node interface - extend this for frame-specific data
 * Note: children is typed as the same type T for proper recursion
 */
export interface GenericTreeNode<T = unknown> {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  sortOrder?: number;
  children: T extends unknown ? GenericTreeNode<T>[] : T[];
  isExpanded?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Menu item for node action menu
 */
export interface TreeMenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: (nodeId: string) => void;
  variant?: 'default' | 'destructive';
  /** Condition to show this menu item */
  show?: (node: GenericTreeNode) => boolean;
}

/**
 * Render props for customizing tree node content
 */
export interface TreeNodeRenderProps<T extends GenericTreeNode = GenericTreeNode> {
  node: T;
  isSelected: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  isEditing: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
}

/**
 * Props for GenericTree component
 */
export interface GenericTreeProps<T extends GenericTreeNode = GenericTreeNode> {
  /** Tree nodes (root level) */
  nodes: T[];
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Callback when node is selected */
  onSelectNode: (nodeId: string | null) => void;
  /** Callback when node expand/collapse is toggled */
  onToggleExpanded: (nodeId: string) => void;
  /** Check if a node is expanded */
  isNodeExpanded: (nodeId: string) => boolean;
  
  // === Optional Editing Features ===
  
  /** Read-only mode (disables all editing) */
  isReadOnly?: boolean;
  
  /** Enable drag and drop reordering */
  enableDragDrop?: boolean;
  /** Callback when node is moved via drag-drop */
  onMoveNode?: (nodeId: string, newParentId: string | null, sortOrder?: number) => void;
  
  /** Enable inline editing (double-click to rename) */
  enableInlineEdit?: boolean;
  /** Callback when node name is updated */
  onUpdateNode?: (nodeId: string, updates: { name?: string }) => void;
  
  /** Enable adding child nodes */
  enableAddChild?: boolean;
  /** Callback to create a new child node */
  onCreateNode?: (name: string, parentId: string | null) => void;
  
  /** Action menu items (shown in dropdown) */
  menuActions?: TreeMenuAction[];
  
  // === Render Props for Customization ===
  
  /** Custom leading content (icon area) */
  renderLeadingContent?: (props: TreeNodeRenderProps<T>) => ReactNode;
  /** Custom trailing content (badges, amounts) */
  renderTrailingContent?: (props: TreeNodeRenderProps<T>) => ReactNode;
  /** Custom hover action buttons */
  renderActionButtons?: (props: TreeNodeRenderProps<T>) => ReactNode;
  /** Custom node label renderer */
  renderLabel?: (props: TreeNodeRenderProps<T>) => ReactNode;
  /** Inline detail panel rendered below the selected node (accordion-style) */
  renderExpandedDetail?: (props: TreeNodeRenderProps<T>) => ReactNode;
  
  // === Styling & Display ===
  
  /** Header title for the tree panel */
  title?: string;
  /** Header actions (buttons in header) */
  headerActions?: ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class name for container */
  className?: string;
  /** Test ID prefix for testing */
  testIdPrefix?: string;
  /** Indent size in pixels per depth level */
  indentSize?: number;
}

/**
 * Props for individual tree node row
 */
export interface GenericTreeNodeProps<T extends GenericTreeNode = GenericTreeNode> {
  node: T;
  selectedNodeId: string | null;
  isReadOnly: boolean;
  expandedIds: Set<string>;
  overId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onToggleExpanded: (nodeId: string) => void;
  
  // Edit features
  enableDragDrop: boolean;
  enableInlineEdit: boolean;
  enableAddChild: boolean;
  onUpdateNode?: (nodeId: string, updates: { name?: string }) => void;
  onCreateNode?: (name: string, parentId: string | null) => void;
  onMoveNode?: (nodeId: string, newParentId: string | null, sortOrder?: number) => void;
  menuActions: TreeMenuAction[];
  
  // Render props
  renderLeadingContent?: (props: TreeNodeRenderProps<T>) => ReactNode;
  renderTrailingContent?: (props: TreeNodeRenderProps<T>) => ReactNode;
  renderActionButtons?: (props: TreeNodeRenderProps<T>) => ReactNode;
  renderLabel?: (props: TreeNodeRenderProps<T>) => ReactNode;
  renderExpandedDetail?: (props: TreeNodeRenderProps<T>) => ReactNode;
  
  // Style
  testIdPrefix: string;
  indentSize: number;
}
