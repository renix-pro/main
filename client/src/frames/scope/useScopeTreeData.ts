/**
 * RENIX vNext — Scope Tree Data Hook
 * 
 * Canon v1.4 Compliant — Tree-based Scope Structure
 * 
 * The Scope Frame declares WHAT is included in a project using
 * a recursive tree structure with unbounded depth.
 * 
 * Key differences from useScopeData:
 * - No fixed hierarchy — unbounded depth tree
 * - Nodes can exist at any depth
 * - Each node can have children
 * - Tags for categorization
 * 
 * All mutations are blocked when project is read-only.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  queryKeys, 
  scopeNodesApi, 
  scopeApi,
  ScopeNodeData,
  CreateScopeNodeInput,
  UpdateScopeNodeInput,
  MoveScopeNodeInput,
} from '@/lib/api';

export interface ScopeNode {
  id: string;
  projectId: string;
  userId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  tags: string[];
  sortOrder: number;
  isExpanded: boolean;
  costType: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ScopeTreeNode extends ScopeNode {
  children: ScopeTreeNode[];
  depth: number;
}

export interface ScopeTreeData {
  nodes: ScopeNode[];
  rootNodes: ScopeTreeNode[];
  nodeMap: Map<string, ScopeNode>;
  getChildren: (parentId: string | null) => ScopeNode[];
  getDescendants: (nodeId: string) => ScopeNode[];
  getAncestors: (nodeId: string) => ScopeNode[];
  getNode: (nodeId: string) => ScopeNode | undefined;
}

function transformApiNode(apiNode: ScopeNodeData): ScopeNode {
  return {
    id: apiNode.id,
    projectId: apiNode.projectId,
    userId: apiNode.userId,
    parentId: apiNode.parentId,
    name: apiNode.name,
    description: apiNode.description,
    tags: apiNode.tags || [],
    sortOrder: apiNode.sortOrder ?? 0,
    isExpanded: apiNode.isExpanded,
    costType: apiNode.costType ?? 'standard',
    createdAt: new Date(apiNode.createdAt).getTime(),
    updatedAt: new Date(apiNode.updatedAt).getTime(),
    createdBy: apiNode.createdBy,
  };
}

function buildTreeNodes(
  nodes: ScopeNode[],
  parentId: string | null,
  depth: number = 0
): ScopeTreeNode[] {
  return nodes
    .filter(n => n.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(node => ({
      ...node,
      depth,
      children: buildTreeNodes(nodes, node.id, depth + 1),
    }));
}

function buildScopeTreeData(apiNodes: ScopeNodeData[]): ScopeTreeData {
  const nodes = apiNodes.map(transformApiNode);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const rootNodes = buildTreeNodes(nodes, null);

  const getChildren = (parentId: string | null): ScopeNode[] => {
    return nodes.filter(n => n.parentId === parentId);
  };

  const getDescendants = (nodeId: string): ScopeNode[] => {
    const result: ScopeNode[] = [];
    const stack = getChildren(nodeId);
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      stack.push(...getChildren(current.id));
    }
    return result;
  };

  const getAncestors = (nodeId: string): ScopeNode[] => {
    const result: ScopeNode[] = [];
    let current = nodeMap.get(nodeId);
    while (current?.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (parent) {
        result.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return result;
  };

  const getNode = (nodeId: string): ScopeNode | undefined => {
    return nodeMap.get(nodeId);
  };

  return {
    nodes,
    rootNodes,
    nodeMap,
    getChildren,
    getDescendants,
    getAncestors,
    getNode,
  };
}

export function useScopeTreeData(
  projectId: string, 
  isReadOnly: boolean = false, 
  userId: string = 'user-001'
) {
  const { toast } = useToast();
  const migrationAttemptedRef = useRef(false);

  const { data: nodesResponse, isLoading: isLoadingNodes } = useQuery({
    queryKey: queryKeys.scopeNodes(projectId),
    queryFn: () => scopeNodesApi.get(projectId),
  });

  const { data: legacyScopeResponse, isLoading: isLoadingLegacy } = useQuery({
    queryKey: queryKeys.scope(projectId),
    queryFn: () => scopeApi.get(projectId),
    enabled: !isLoadingNodes && (!nodesResponse || nodesResponse.nodes.length === 0),
  });

  const treeData: ScopeTreeData = useMemo(() => {
    if (!nodesResponse) {
      return {
        nodes: [],
        rootNodes: [],
        nodeMap: new Map(),
        getChildren: () => [],
        getDescendants: () => [],
        getAncestors: () => [],
        getNode: () => undefined,
      };
    }
    return buildScopeTreeData(nodesResponse.nodes);
  }, [nodesResponse]);

  const invalidateScopeNodes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scopeNodes(projectId) });
  }, [projectId]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('ScopeTree: Mutation blocked - project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const migrateMutation = useMutation({
    mutationFn: () => scopeNodesApi.migrate(projectId),
    onSuccess: () => {
      invalidateScopeNodes();
      queryClient.invalidateQueries({ queryKey: queryKeys.scope(projectId) });
    },
  });

  useEffect(() => {
    if (
      !isReadOnly &&
      !isLoadingNodes &&
      !isLoadingLegacy &&
      !migrationAttemptedRef.current &&
      nodesResponse?.nodes.length === 0 &&
      legacyScopeResponse &&
      (legacyScopeResponse.scopes?.length ?? 0) > 0
    ) {
      migrationAttemptedRef.current = true;
      migrateMutation.mutate();
    }
  }, [
    isReadOnly,
    isLoadingNodes,
    isLoadingLegacy,
    nodesResponse,
    legacyScopeResponse,
    migrateMutation,
  ]);

  const createNodeMutation = useMutation({
    mutationFn: (data: CreateScopeNodeInput) => scopeNodesApi.create(projectId, data),
    onSuccess: invalidateScopeNodes,
  });

  const updateNodeMutation = useMutation({
    mutationFn: (data: { nodeId: string } & UpdateScopeNodeInput) => 
      scopeNodesApi.update(projectId, data.nodeId, data),
    onSuccess: invalidateScopeNodes,
  });

  const moveNodeMutation = useMutation({
    mutationFn: (data: { nodeId: string } & MoveScopeNodeInput) => 
      scopeNodesApi.move(projectId, data.nodeId, data),
    onSuccess: invalidateScopeNodes,
  });

  const reorderNodeMutation = useMutation({
    mutationFn: (data: { nodeId: string; sortOrder: number }) => 
      scopeNodesApi.reorder(projectId, data.nodeId, { sortOrder: data.sortOrder }),
    onSuccess: invalidateScopeNodes,
  });

  const batchReorderMutation = useMutation({
    mutationFn: (updates: { nodeId: string; sortOrder: number }[]) =>
      scopeNodesApi.batchReorder(projectId, updates),
    onSuccess: invalidateScopeNodes,
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: string) => scopeNodesApi.delete(projectId, nodeId),
    onSuccess: invalidateScopeNodes,
  });

  const createNode = useCallback((
    name: string,
    parentId: string | null = null,
    description?: string,
    tags: string[] = []
  ): string | undefined => {
    return guardReadOnly(() => {
      const tempId = crypto.randomUUID();
      createNodeMutation.mutate({
        parentId,
        name,
        description: description ?? null,
        tags,
        createdBy: userId,
      });
      return tempId;
    });
  }, [guardReadOnly, createNodeMutation, userId]);

  const updateNode = useCallback((
    nodeId: string,
    updates: {
      name?: string;
      description?: string | null;
      tags?: string[];
      isExpanded?: boolean;
    }
  ) => {
    guardReadOnly(() => {
      updateNodeMutation.mutate({
        nodeId,
        ...updates,
      });
    });
  }, [guardReadOnly, updateNodeMutation]);

  const moveNode = useCallback((nodeId: string, newParentId: string | null, sortOrder?: number) => {
    guardReadOnly(() => {
      const node = treeData.getNode(nodeId);
      if (!node) return;

      if (newParentId !== null) {
        const descendants = treeData.getDescendants(nodeId);
        if (descendants.some(d => d.id === newParentId)) {
          console.warn('ScopeTree: Cannot move node to its own descendant');
          toast({ title: 'Can\'t move here', description: 'A folder can\'t be placed inside itself.' });
          return;
        }
      }

      moveNodeMutation.mutate({ nodeId, newParentId, sortOrder });
    });
  }, [guardReadOnly, moveNodeMutation, treeData]);

  const reorderNode = useCallback((nodeId: string, newSortOrder: number) => {
    guardReadOnly(() => {
      reorderNodeMutation.mutate({ nodeId, sortOrder: newSortOrder });
    });
  }, [guardReadOnly, reorderNodeMutation]);

  const swapNodeOrder = useCallback((nodeAId: string, nodeBId: string) => {
    guardReadOnly(() => {
      const nodeA = treeData.getNode(nodeAId);
      const nodeB = treeData.getNode(nodeBId);
      if (!nodeA || !nodeB) return;
      batchReorderMutation.mutate([
        { nodeId: nodeAId, sortOrder: nodeB.sortOrder },
        { nodeId: nodeBId, sortOrder: nodeA.sortOrder },
      ]);
    });
  }, [guardReadOnly, batchReorderMutation, treeData]);

  const deleteNode = useCallback((nodeId: string) => {
    guardReadOnly(() => {
      deleteNodeMutation.mutate(nodeId);
    });
  }, [guardReadOnly, deleteNodeMutation]);

  const toggleExpanded = useCallback((nodeId: string) => {
    const node = treeData.getNode(nodeId);
    if (node) {
      updateNode(nodeId, { isExpanded: !node.isExpanded });
    }
  }, [treeData, updateNode]);

  const addTag = useCallback((nodeId: string, tag: string) => {
    const node = treeData.getNode(nodeId);
    if (node && !node.tags.includes(tag)) {
      updateNode(nodeId, { tags: [...node.tags, tag] });
    }
  }, [treeData, updateNode]);

  const removeTag = useCallback((nodeId: string, tag: string) => {
    const node = treeData.getNode(nodeId);
    if (node) {
      updateNode(nodeId, { tags: node.tags.filter(t => t !== tag) });
    }
  }, [treeData, updateNode]);

  const isEmpty = treeData.nodes.length === 0;
  const isLoading = isLoadingNodes || migrateMutation.isPending;
  const isMigrating = migrateMutation.isPending;

  const totalActiveNodes = useMemo(() => {
    return treeData.nodes.length;
  }, [treeData.nodes]);

  const maxDepth = useMemo(() => {
    let max = 0;
    const calculateDepth = (nodes: ScopeTreeNode[]) => {
      for (const node of nodes) {
        max = Math.max(max, node.depth);
        if (node.children.length > 0) {
          calculateDepth(node.children);
        }
      }
    };
    calculateDepth(treeData.rootNodes);
    return max;
  }, [treeData.rootNodes]);

  return {
    ...treeData,
    isEmpty,
    isLoading,
    isMigrating,
    isReadOnly,
    totalActiveNodes,
    maxDepth,
    createNode,
    updateNode,
    moveNode,
    reorderNode,
    swapNodeOrder,
    deleteNode,
    toggleExpanded,
    addTag,
    removeTag,
    triggerMigration: () => {
      if (!isReadOnly) {
        migrateMutation.mutate();
      }
    },
  };
}
