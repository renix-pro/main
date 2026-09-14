/**
 * RENIX vNext — Scope Frame (Canon v1.4 Compliant)
 * 
 * Pure tree-based Scope Frame UI.
 * 
 * The Scope Frame declares WHAT is included in a project using
 * a recursive tree structure with unbounded depth.
 * 
 * Visual Rules:
 * - Pure black/white only - no colors except grayscale
 * - Zero border radius (all elements square)
 * - No icons indicating state
 * - No progress indicators, percentages, checkmarks
 * - Left-aligned, vertically stacked tree
 * - Indentation communicates hierarchy ONLY
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useScopeTreeData } from './useScopeTreeData';
import { ScopeTree } from './ScopeTreeView';
import { PostureTile } from '@/components/tiles';
import { LayoutTemplate, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScopeSkeleton } from '@/components/FrameSkeleton';
import { Button } from '@/components/ui/button';
import { ScopeTemplateDialog, type ScopeTemplate } from './ScopeTemplates';
import { scopeNodesApi, queryKeys } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function ScopeFrame() {
  const { projectId, isReadOnly } = useProject();
  const { toast } = useToast();
  const scopeTreeData = useScopeTreeData(projectId, isReadOnly);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
  }, []);

  const handleApplyTemplate = useCallback(async (template: ScopeTemplate) => {
    try {
      await scopeNodesApi.batchCreate(projectId, template.groups);
      queryClient.invalidateQueries({ queryKey: queryKeys.scopeNodes(projectId) });
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast({ title: 'Template failed', description: 'Something went wrong applying this template. Please try again.' });
    }
  }, [projectId, toast]);

  if (scopeTreeData.isLoading) {
    return <ScopeSkeleton />;
  }

  if (scopeTreeData.isMigrating) {
    return (
      <div className="h-full" data-testid="frame-scope">
        <div className="flex items-center justify-center h-32">
          <span className="text-sm text-muted-foreground">Migrating scope data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4" data-testid="frame-scope">
      {isReadOnly && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground px-2 py-1 border border-border rounded">
            Read-only
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <PostureTile
          label="Total Scopes"
          value={scopeTreeData.nodes.length}
          className="flex-1"
        />
        <div className="relative" data-testid="scope-search-container">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search scopes..."
            className="pl-8 pr-8 w-56"
            data-testid="input-scope-search"
          />
          {searchInput && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-8"
              onClick={() => setSearchInput('')}
              data-testid="button-clear-scope-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!isReadOnly && scopeTreeData.rootNodes.length === 0 && (
          <Button
            variant="outline"
            onClick={() => setShowTemplateDialog(true)}
            data-testid="scope-template-button"
          >
            <LayoutTemplate className="h-4 w-4 mr-2" />
            Use a template
          </Button>
        )}
      </div>

      <ScopeTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onApply={handleApplyTemplate}
      />
        
      <ScopeTree
        projectId={projectId}
        rootNodes={scopeTreeData.rootNodes}
        selectedNodeId={selectedNodeId}
        isReadOnly={isReadOnly}
        searchTerm={searchTerm}
        onSelectNode={handleSelectNode}
        onCreateNode={(name, parentId) => {
          scopeTreeData.createNode(name, parentId);
        }}
        onUpdateNode={(nodeId, updates) => {
          scopeTreeData.updateNode(nodeId, updates);
        }}
        onMoveNode={(nodeId, newParentId, sortOrder) => {
          scopeTreeData.moveNode(nodeId, newParentId, sortOrder);
        }}
        onDeleteNode={(nodeId) => {
          scopeTreeData.deleteNode(nodeId);
          if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
          }
        }}
        onToggleExpanded={(nodeId) => {
          scopeTreeData.toggleExpanded(nodeId);
        }}
        onAddTag={(nodeId, tag) => {
          scopeTreeData.addTag(nodeId, tag);
        }}
        onRemoveTag={(nodeId, tag) => {
          scopeTreeData.removeTag(nodeId, tag);
        }}
        getNode={scopeTreeData.getNode}
        onReorderNode={(nodeId, newSortOrder) => {
          scopeTreeData.reorderNode(nodeId, newSortOrder);
        }}
        onSwapNodeOrder={(nodeAId, nodeBId) => {
          scopeTreeData.swapNodeOrder(nodeAId, nodeBId);
        }}
      />
    </div>
  );
}

export default ScopeFrame;
