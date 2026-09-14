/**
 * RENIX vNext — Invoices Tree View
 * 
 * Canon v1.4 Compliant — Scope-centric, AI-first
 * 
 * Tree structure where:
 * - Scopes / sub-scopes are primary nodes (canonical scope tree)
 * - Invoices appear as leaf children under scopes
 * - State-driven iconography for invoice states
 * 
 * Uses GenericTree component for visual consistency across frames.
 * ALWAYS renders the scope tree, even when no invoices exist.
 * 
 * INVOICE STATES:
 * - Draft (○): Initial state after ingestion
 * - Finalized (●): Confirmed and immutable
 * - Paid (◌): Fully paid
 */

import { useMemo, useCallback, useState, ReactNode } from 'react';
import { Receipt, CircleDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormatters } from '@/context/ProjectContext';
import { GenericTree } from '@/components/GenericTree';
import type { GenericTreeNode, TreeNodeRenderProps } from '@/components/GenericTree/types';
import type { ScopeTreeNode } from '@/frames/scope/useScopeTreeData';
import type { Invoice } from './useInvoicesData';
import { getInvoiceDisplayStatus, type InvoiceDisplayStatus } from './useInvoicesData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type InvoiceState = 'draft' | 'finalized' | 'paid';

export const UNASSIGNED_SCOPE_ID = '__unassigned__';

export interface InvoicesTreeProps {
  scopeNodes: ScopeTreeNode[];
  invoices: Invoice[];
  scopeInvoiceMap: Map<string, string[]>;
  selectedId: string | null;
  onSelectScope: (scopeId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onQuickPay?: (invoiceId: string) => void;
  formatCurrency: (amount: number | null) => string;
  renderExpandedDetail?: (props: TreeNodeRenderProps<InvoicesTreeNodeData>) => ReactNode;
  className?: string;
}

const STATE_ICONS: Record<InvoiceState, { icon: string; label: string }> = {
  draft: { icon: '○', label: 'Draft' },
  finalized: { icon: '●', label: 'Finalized' },
  paid: { icon: '◌', label: 'Paid' },
};

function getInvoiceState(invoice: Invoice): InvoiceState {
  if (invoice.status === 'paid') {
    return 'paid';
  }
  if (invoice.status === 'finalized') {
    return 'finalized';
  }
  return 'draft';
}

interface InvoiceIconProps {
  state: InvoiceState;
}

function InvoiceIcon({ state }: InvoiceIconProps) {
  const config = STATE_ICONS[state];
  return (
    <span 
      className={cn(
        'text-sm font-medium w-4 text-center',
        state === 'finalized' && 'text-foreground',
        state === 'draft' && 'text-muted-foreground',
        state === 'paid' && 'text-green-600 dark:text-green-400'
      )}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}

export interface InvoicesTreeNodeData extends GenericTreeNode {
  nodeType: 'scope' | 'invoice';
  invoiceState?: InvoiceState;
  vendorName?: string;
  amount?: number;
  outstanding?: number;
  scopeId?: string;
  invoiceId?: string;
}

function buildInvoicesTreeNodes(
  scopeNodes: ScopeTreeNode[],
  invoiceMap: Map<string, Invoice>,
  scopeInvoiceMap: Map<string, string[]>,
  formatCurrency: (amount: number | null) => string,
  depth: number = 0
): InvoicesTreeNodeData[] {
  return scopeNodes.map((scopeNode) => {
    const invoiceIds = scopeInvoiceMap.get(scopeNode.id) || [];
    
    const invoiceChildren: InvoicesTreeNodeData[] = invoiceIds.map(invoiceId => {
      const invoice = invoiceMap.get(invoiceId);
      if (!invoice) return null;
      
      const state = getInvoiceState(invoice);
      const stateConfig = STATE_ICONS[state];
      const totalAmount = invoice.lines.reduce((sum, l) => sum + l.amount, 0);
      
      return {
        id: `invoice:${invoice.id}`,
        name: `Invoice · ${invoice.vendorName} (${stateConfig.label})`,
        parentId: `scope:${scopeNode.id}`,
        depth: depth + 1,
        children: [] as InvoicesTreeNodeData[],
        nodeType: 'invoice' as const,
        invoiceState: state,
        vendorName: invoice.vendorName,
        amount: totalAmount,
        outstanding: invoice.outstanding,
        invoiceId: invoice.id,
        metadata: { invoiceId: invoice.id, state },
      };
    }).filter(Boolean) as InvoicesTreeNodeData[];
    
    const scopeChildren = scopeNode.children.length > 0 
      ? buildInvoicesTreeNodes(scopeNode.children, invoiceMap, scopeInvoiceMap, formatCurrency, depth + 1)
      : [];
    
    const allChildren = [...scopeChildren, ...invoiceChildren];
    
    const totalInvoiced = invoiceChildren.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const totalOutstanding = invoiceChildren.reduce((sum, inv) => sum + (inv.outstanding ?? 0), 0);
    
    return {
      id: `scope:${scopeNode.id}`,
      name: scopeNode.name,
      parentId: scopeNode.parentId ? `scope:${scopeNode.parentId}` : null,
      depth,
      children: allChildren,
      isExpanded: scopeNode.isExpanded,
      nodeType: 'scope' as const,
      amount: totalInvoiced,
      outstanding: totalOutstanding,
      scopeId: scopeNode.id,
      metadata: { scopeId: scopeNode.id },
    };
  });
}

export function InvoicesTree({
  scopeNodes,
  invoices,
  scopeInvoiceMap,
  selectedId,
  onSelectScope,
  onSelectInvoice,
  onQuickPay,
  formatCurrency,
  renderExpandedDetail,
  className,
}: InvoicesTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    function collectFirstLevel(nodes: ScopeTreeNode[]) {
      for (const node of nodes) {
        ids.add(`scope:${node.id}`);
      }
    }
    collectFirstLevel(scopeNodes);
    // Also expand unassigned section by default
    ids.add(`scope:${UNASSIGNED_SCOPE_ID}`);
    return ids;
  });
  
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const invoice of invoices) {
      map.set(invoice.id, invoice);
    }
    return map;
  }, [invoices]);
  
  const treeNodes = useMemo(() => {
    const scopeTreeNodes = buildInvoicesTreeNodes(scopeNodes, invoiceMap, scopeInvoiceMap, formatCurrency);
    
    // Add "Unassigned" section for invoices without scope
    const unassignedInvoiceIds = scopeInvoiceMap.get(UNASSIGNED_SCOPE_ID) || [];
    if (unassignedInvoiceIds.length > 0) {
      const unassignedInvoices: InvoicesTreeNodeData[] = unassignedInvoiceIds.map(invoiceId => {
        const invoice = invoiceMap.get(invoiceId);
        if (!invoice) return null;
        
        const state = getInvoiceState(invoice);
        const stateConfig = STATE_ICONS[state];
        const totalAmount = invoice.lines.reduce((sum, l) => sum + l.amount, 0);
        
        return {
          id: `invoice:${invoice.id}`,
          name: `Invoice · ${invoice.vendorName} (${stateConfig.label})`,
          parentId: `scope:${UNASSIGNED_SCOPE_ID}`,
          depth: 1,
          children: [] as InvoicesTreeNodeData[],
          nodeType: 'invoice' as const,
          invoiceState: state,
          vendorName: invoice.vendorName,
          amount: totalAmount,
          outstanding: invoice.outstanding,
          invoiceId: invoice.id,
          metadata: { invoiceId: invoice.id, state },
        };
      }).filter(Boolean) as InvoicesTreeNodeData[];
      
      const totalInvoiced = unassignedInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
      const totalOutstanding = unassignedInvoices.reduce((sum, inv) => sum + (inv.outstanding ?? 0), 0);
      
      const unassignedNode: InvoicesTreeNodeData = {
        id: `scope:${UNASSIGNED_SCOPE_ID}`,
        name: 'Unassigned Invoices',
        parentId: null,
        depth: 0,
        children: unassignedInvoices,
        isExpanded: true,
        nodeType: 'scope' as const,
        amount: totalInvoiced,
        outstanding: totalOutstanding,
        scopeId: UNASSIGNED_SCOPE_ID,
        metadata: { scopeId: UNASSIGNED_SCOPE_ID, isUnassigned: true },
      };
      
      scopeTreeNodes.push(unassignedNode);
    }
    
    return scopeTreeNodes;
  }, [scopeNodes, invoiceMap, scopeInvoiceMap, formatCurrency]);
  
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
  
  const isNodeExpanded = useCallback((nodeId: string) => expandedIds.has(nodeId), [expandedIds]);
  
  const handleSelectNode = useCallback((nodeId: string | null) => {
    if (!nodeId) return;
    
    if (nodeId.startsWith('scope:')) {
      const scopeId = nodeId.replace('scope:', '');
      onSelectScope(scopeId);
    } else if (nodeId.startsWith('invoice:')) {
      const invoiceId = nodeId.replace('invoice:', '');
      onSelectInvoice(invoiceId);
    }
  }, [onSelectScope, onSelectInvoice]);
  
  const renderLeadingContent = useCallback((props: TreeNodeRenderProps<InvoicesTreeNodeData>): ReactNode => {
    const { node } = props;
    
    if (node.nodeType === 'invoice') {
      return <InvoiceIcon state={node.invoiceState!} />;
    }
    
    return null;
  }, []);

  const renderTrailingContent = useCallback((props: TreeNodeRenderProps<InvoicesTreeNodeData>): ReactNode => {
    const { node } = props;
    
    if (node.nodeType === 'invoice') {
      const canQuickPay = onQuickPay && node.invoiceState === 'finalized' && node.outstanding && node.outstanding > 0 && node.invoiceId;
      return (
        <div className="flex items-center gap-2">
          {node.outstanding && node.outstanding > 0 && (
            <Badge variant="outline" className="text-xs text-warning border-warning/50">
              {formatCurrency(node.outstanding)} due
            </Badge>
          )}
          {canQuickPay && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-accent-copper"
              title="Record payment"
              aria-label="Record payment"
              data-testid={`button-quick-pay-${node.invoiceId}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickPay(node.invoiceId!);
              }}
            >
              <CircleDollarSign className="h-4 w-4" />
            </Button>
          )}
          {node.amount && node.amount > 0 && (
            <span className={cn(
              'tabular-nums text-sm',
              node.invoiceState === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            )}>
              {formatCurrency(node.amount)}
            </span>
          )}
        </div>
      );
    }
    
    if (node.outstanding && node.outstanding > 0) {
      return (
        <span className="text-xs text-warning tabular-nums">
          {formatCurrency(node.outstanding)} outstanding
        </span>
      );
    }
    
    if (node.amount && node.amount > 0) {
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(node.amount)}
        </span>
      );
    }
    
    return null;
  }, [formatCurrency, onQuickPay]);
  
  return (
    <GenericTree
      nodes={treeNodes}
      selectedNodeId={selectedId}
      onSelectNode={handleSelectNode}
      onToggleExpanded={toggleExpanded}
      isNodeExpanded={isNodeExpanded}
      isReadOnly={true}
      enableDragDrop={false}
      enableInlineEdit={false}
      enableAddChild={false}
      title="Invoices by Scope"
      emptyMessage="No scopes defined. Add scopes in the Scope frame first."
      testIdPrefix="invoices-tree"
      className={className}
      renderLeadingContent={renderLeadingContent as any}
      renderTrailingContent={renderTrailingContent as any}
      renderExpandedDetail={renderExpandedDetail as any}
    />
  );
}
