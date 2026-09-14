/**
 * RENIX vNext — Extraction Review Screen
 * 
 * MANDATORY GATE for reviewing extracted quote data from uploaded documents.
 * Appears as a temporary Zone 2 overlay.
 * 
 * DESKTOP LAYOUT:
 * - LEFT: Original document viewer (immutable, scrollable)
 * - RIGHT: Extracted Data Panel (EDITABLE) with three sections:
 *   A. METADATA (TOP): Vendor, reference, date, currency, tax rate
 *   B. HIERARCHICAL QUOTE TREE (MIDDLE): Sections and line items
 *   C. FINANCIAL METADATA (BOTTOM): Net, tax, gross totals
 * 
 * RULES:
 * - Tree MUST NOT be flattened
 * - Original numbering MUST NEVER be regenerated
 * - Taxes and totals MUST NOT be injected into the tree
 * - ALL extracted fields MUST be inline editable
 * - No auto-save, no locking, no allocation before acceptance
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Check, X, AlertCircle, FileText, ChevronUp, Info, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';
import { formatCurrency as formatCurrencyUtil } from '@/context/regionalContext';
import { useProject } from '@/context/ProjectContext';
import type { Vendor } from './useQuotesData';
import type { ConfidenceLevel } from './types';

export type VendorChoice =
  | { type: 'existing'; vendorId: string }
  | { type: 'new'; vendorName: string };

export interface ExtractedTreeNode {
  id: string;
  number: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  rowType: 'section' | 'line_item' | 'subtotal' | 'note';
  confidence?: ConfidenceLevel;
  children: ExtractedTreeNode[];
}

export interface ExtractedFinancials {
  netTotal: number | null;
  taxAmount: number | null;
  grossTotal: number | null;
  taxRate: number | null;
  taxLabel: string | null;
}

export interface ExtractedQuoteData {
  vendorName: string | null;
  vendorConfidence?: ConfidenceLevel;
  quoteReference: string | null;
  quoteDate: string | null;
  currency: string | null;
  tree: ExtractedTreeNode[];
  financials: ExtractedFinancials;
}

export interface AcceptedTreeNode {
  id: string;
  number: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  rowType: 'section' | 'line_item' | 'subtotal' | 'note';
  children: AcceptedTreeNode[];
}

export interface AcceptedExtractedData {
  vendor: VendorChoice;
  quoteReference: string;
  quoteDate: string | null;
  currency: string;
  taxRate: number | null;
  tree: AcceptedTreeNode[];
  financials: {
    netTotal: number | null;
    taxAmount: number | null;
    grossTotal: number | null;
  };
}

export interface ExtractionReviewScreenProps {
  projectId: string;
  scopeId: string;
  documentId: string;
  documentUrl: string;
  extractedData: ExtractedQuoteData;
  vendors: Vendor[];
  projectCurrency?: string;
  onAccept: (data: AcceptedExtractedData) => void;
  onCancel: () => void;
}

interface EditableTreeNode extends ExtractedTreeNode {
  children: EditableTreeNode[];
}

function deepCloneTree(nodes: ExtractedTreeNode[] | undefined | null): EditableTreeNode[] {
  if (!nodes || !Array.isArray(nodes)) {
    return [];
  }
  return nodes.map(node => ({
    ...node,
    children: deepCloneTree(node.children),
  }));
}

function convertToAcceptedTree(nodes: EditableTreeNode[]): AcceptedTreeNode[] {
  return nodes.map(node => ({
    id: node.id,
    number: node.number,
    description: node.description,
    quantity: node.quantity,
    unit: node.unit,
    unitPrice: node.unitPrice,
    totalPrice: node.totalPrice,
    rowType: node.rowType,
    children: convertToAcceptedTree(node.children),
  }));
}

const CURRENCIES = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CHF', label: 'CHF' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CAD', label: 'CAD' },
];

function ConfidenceBadge({ confidence }: { confidence?: ConfidenceLevel }) {
  if (!confidence) return null;
  
  const variant = confidence === 'high' ? 'default' : confidence === 'medium' ? 'secondary' : 'outline';
  
  return (
    <Badge variant={variant} className="text-xs ml-2" data-testid="confidence-badge">
      {confidence}
    </Badge>
  );
}

const PROGRESS_STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'extract', label: 'Extract' },
  { key: 'review', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
] as const;

function ExtractionProgressIndicator() {
  return (
    <div className="flex items-center gap-1 text-xs" data-testid="extraction-progress-indicator">
      {PROGRESS_STEPS.map((step, idx) => {
        const isCompleted = idx < 2;
        const isCurrent = idx === 2;
        return (
          <span key={step.key} className="flex items-center gap-1">
            {idx > 0 && (
              <span className="text-muted mx-0.5">&rarr;</span>
            )}
            <span
              className={
                isCompleted
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : isCurrent
                  ? 'text-foreground font-semibold'
                  : 'text-muted'
              }
              data-testid={`progress-step-${step.key}`}
            >
              {step.label}
              {isCompleted && ' \u2713'}
              {isCurrent && ' (you are here)'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function DocumentViewerFallback({ documentUrl }: { documentUrl: string }) {
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setHasError(false);
  }, [documentUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (iframe) {
          const doc = iframe.contentDocument;
          if (doc && doc.body && doc.body.innerHTML === '') {
            setHasError(true);
          }
        }
      } catch {
        // cross-origin — iframe loaded something, no error
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [documentUrl]);

  if (hasError || !documentUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center" data-testid="document-viewer-fallback">
        <FileWarning className="w-10 h-10 text-muted" />
        <p className="text-sm font-medium">Unable to display document</p>
        <p className="text-xs text-muted max-w-xs">
          The document preview could not be loaded. You can still review the extracted data on the right.
        </p>
        {documentUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(documentUrl, '_blank')}
            data-testid="button-open-document-external"
          >
            <FileText className="w-4 h-4 mr-2" />
            Open in new tab
          </Button>
        )}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={documentUrl}
      className="w-full h-full border-0"
      title="Quote Document"
      data-testid="document-viewer"
      onError={() => setHasError(true)}
    />
  );
}

interface TreeNodeRowProps {
  node: EditableTreeNode;
  depth: number;
  expandedSections: Set<string>;
  onToggleSection: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<EditableTreeNode>) => void;
  formatCurrency: (value: number | null) => string;
}

function TreeNodeRow({
  node,
  depth,
  expandedSections,
  onToggleSection,
  onUpdateNode,
  formatCurrency,
}: TreeNodeRowProps) {
  const isSection = node.rowType === 'section';
  const isExpanded = expandedSections.has(node.id);
  const hasChildren = node.children.length > 0;
  const paddingLeft = depth * 20;

  const handleDescriptionChange = (value: string) => {
    onUpdateNode(node.id, { description: value });
  };

  const handleQuantityChange = (value: string) => {
    const parsed = parseFloat(value);
    onUpdateNode(node.id, { quantity: isNaN(parsed) ? null : parsed });
  };

  const handleUnitChange = (value: string) => {
    onUpdateNode(node.id, { unit: value || null });
  };

  const handleUnitPriceChange = (value: number | null) => {
    onUpdateNode(node.id, { unitPrice: value });
  };

  const handleTotalPriceChange = (value: number | null) => {
    onUpdateNode(node.id, { totalPrice: value });
  };

  return (
    <>
      <div
        className={`
          flex items-start gap-2 py-2 px-3 border-b border-subtle/30
          ${isSection ? 'bg-muted/20' : ''}
          ${node.rowType === 'subtotal' ? 'font-medium bg-muted/10' : ''}
          ${node.rowType === 'note' ? 'text-muted italic' : ''}
        `}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        data-testid={`extraction-row-${node.id}`}
      >
        {isSection && hasChildren ? (
          <button
            onClick={() => onToggleSection(node.id)}
            className="shrink-0 p-0.5 hover:bg-muted/30 rounded transition-colors mt-1"
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
            className="shrink-0 text-xs text-muted font-mono min-w-[3rem] mt-1.5"
            data-testid={`row-number-${node.id}`}
          >
            {node.number}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <Input
            value={node.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="h-7 text-sm border-transparent hover:border-subtle focus:border-foreground bg-transparent"
            data-testid={`input-description-${node.id}`}
          />
        </div>

        {node.rowType === 'line_item' && (
          <>
            <Input
              value={node.quantity ?? ''}
              onChange={(e) => handleQuantityChange(e.target.value)}
              className="w-16 h-7 text-xs text-right border-transparent hover:border-subtle focus:border-foreground bg-transparent hidden md:block"
              placeholder="Qty"
              data-testid={`input-quantity-${node.id}`}
            />
            <Input
              value={node.unit ?? ''}
              onChange={(e) => handleUnitChange(e.target.value)}
              className="w-14 h-7 text-xs text-center border-transparent hover:border-subtle focus:border-foreground bg-transparent hidden md:block"
              placeholder="Unit"
              data-testid={`input-unit-${node.id}`}
            />
            <CurrencyInput
              value={node.unitPrice}
              onChange={handleUnitPriceChange}
              className="w-20 h-7 text-xs text-right border-transparent hover:border-subtle focus:border-foreground bg-transparent hidden md:block"
              placeholder="Price"
              data-testid={`input-unit-price-${node.id}`}
            />
          </>
        )}

        {(node.rowType === 'line_item' || node.rowType === 'subtotal') && (
          <CurrencyInput
            value={node.totalPrice}
            onChange={handleTotalPriceChange}
            className="w-24 h-7 text-sm text-right border-transparent hover:border-subtle focus:border-foreground bg-transparent font-medium"
            placeholder="Total"
            data-testid={`input-total-${node.id}`}
          />
        )}

        {node.confidence && <ConfidenceBadge confidence={node.confidence} />}
      </div>

      {isExpanded && hasChildren && (
        <>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onUpdateNode={onUpdateNode}
              formatCurrency={formatCurrency}
            />
          ))}
        </>
      )}
    </>
  );
}

export function ExtractionReviewScreen({
  projectId,
  scopeId,
  documentId,
  documentUrl,
  extractedData,
  vendors,
  projectCurrency = 'EUR',
  onAccept,
  onCancel,
}: ExtractionReviewScreenProps) {
  const [vendorChoice, setVendorChoice] = useState<VendorChoice>(() => {
    if (!extractedData.vendorName) {
      return { type: 'new', vendorName: '' };
    }
    const matchedVendor = vendors.find(
      v => v.name.toLowerCase() === extractedData.vendorName?.toLowerCase()
    );
    if (matchedVendor) {
      return { type: 'existing', vendorId: matchedVendor.id };
    }
    return { type: 'new', vendorName: extractedData.vendorName };
  });

  const [quoteReference, setQuoteReference] = useState(extractedData.quoteReference ?? '');
  const [quoteDate, setQuoteDate] = useState<Date | undefined>(() => {
    if (extractedData.quoteDate) {
      try {
        return parseISO(extractedData.quoteDate);
      } catch {
        return undefined;
      }
    }
    return undefined;
  });
  const [currency, setCurrency] = useState(extractedData.currency ?? projectCurrency);
  const [taxRate, setTaxRate] = useState<string>(
    extractedData.financials.taxRate != null 
      ? String(extractedData.financials.taxRate) 
      : ''
  );

  const [tree, setTree] = useState<EditableTreeNode[]>(() => 
    deepCloneTree(extractedData.tree)
  );

  const [financials, setFinancials] = useState({
    netTotal: extractedData.financials.netTotal,
    taxAmount: extractedData.financials.taxAmount,
    grossTotal: extractedData.financials.grossTotal,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const allSections = new Set<string>();
    const collectSections = (nodes: ExtractedTreeNode[] | undefined | null) => {
      if (!nodes || !Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.rowType === 'section') {
          allSections.add(node.id);
        }
        collectSections(node.children);
      }
    };
    collectSections(extractedData.tree);
    return allSections;
  });

  // Responsive document viewer - collapsed by default on smaller screens
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [showDocument, setShowDocument] = useState(true);

  // Initialize and track screen size changes
  useEffect(() => {
    const syncToWindowSize = () => {
      const small = window.innerWidth < 1024;
      setIsSmallScreen(small);
      setShowDocument(!small);
    };
    
    // Initialize on mount
    syncToWindowSize();
    
    // Track resize events
    window.addEventListener('resize', syncToWindowSize);
    return () => window.removeEventListener('resize', syncToWindowSize);
  }, []);
  
  // Reset state when new document is loaded (new review session)
  const documentUrlRef = useRef(documentUrl);
  useEffect(() => {
    if (documentUrl !== documentUrlRef.current) {
      documentUrlRef.current = documentUrl;
      // Reset to default visibility based on current screen size
      const small = window.innerWidth < 1024;
      setIsSmallScreen(small);
      setShowDocument(!small);
    }
  }, [documentUrl]);

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

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<EditableTreeNode>) => {
    const updateInTree = (nodes: EditableTreeNode[]): EditableTreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, ...updates };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateInTree(node.children) };
        }
        return node;
      });
    };
    setTree(prev => updateInTree(prev));
  }, []);

  const { regionalContext } = useProject();
  const formatCurrency = useCallback((value: number | null): string => {
    if (value === null) return '';
    return formatCurrencyUtil(value, { ...regionalContext, currency });
  }, [currency, regionalContext]);

  // Filter subtotal rows from tree for display (subtotals should not appear in extracted data)
  const filteredTree = useMemo(() => {
    const filterSubtotals = (nodes: EditableTreeNode[]): EditableTreeNode[] => {
      return nodes
        .filter(node => node.rowType !== 'subtotal')
        .map(node => ({
          ...node,
          children: filterSubtotals(node.children),
        }));
    };
    return filterSubtotals(tree);
  }, [tree]);

  // Calculate total from line items only (excluding subtotals, sections, notes)
  const calculatedTotal = useMemo(() => {
    let total = 0;
    const sumLineItems = (nodes: EditableTreeNode[]) => {
      for (const node of nodes) {
        if (node.rowType === 'line_item' && node.totalPrice !== null) {
          total += node.totalPrice;
        }
        if (node.children.length > 0) {
          sumLineItems(node.children);
        }
      }
    };
    sumLineItems(tree);
    return total;
  }, [tree]);

  const vendorModeLabel = useMemo(() => {
    if (vendorChoice.type === 'existing') {
      const vendor = vendors.find(v => v.id === vendorChoice.vendorId);
      return vendor?.name ?? 'Select vendor';
    }
    return 'Add new vendor';
  }, [vendorChoice, vendors]);

  const hasMatchedVendor = useMemo(() => {
    if (!extractedData.vendorName) return false;
    return vendors.some(
      v => v.name.toLowerCase() === extractedData.vendorName?.toLowerCase()
    );
  }, [extractedData.vendorName, vendors]);

  const handleAccept = () => {
    // Use filteredTree to exclude subtotals from accepted data
    const acceptedData: AcceptedExtractedData = {
      vendor: vendorChoice,
      quoteReference,
      quoteDate: quoteDate ? format(quoteDate, 'yyyy-MM-dd') : null,
      currency,
      taxRate: taxRate ? parseFloat(taxRate) : null,
      tree: convertToAcceptedTree(filteredTree),
      financials,
    };
    onAccept(acceptedData);
  };

  const hasLineItems = useMemo(() => {
    const countLineItems = (nodes: EditableTreeNode[]): number => {
      let count = 0;
      for (const node of nodes) {
        if (node.rowType === 'line_item') count++;
        count += countLineItems(node.children);
      }
      return count;
    };
    return countLineItems(filteredTree) > 0;
  }, [filteredTree]);

  const financialInconsistency = useMemo(() => {
    const { netTotal, taxAmount, grossTotal } = financials;
    if (netTotal !== null && taxAmount !== null && grossTotal !== null) {
      const expectedGross = Math.round((netTotal + taxAmount) * 100) / 100;
      const actualGross = Math.round(grossTotal * 100) / 100;
      if (Math.abs(expectedGross - actualGross) > 0.01) {
        return `Net (${formatCurrency(netTotal)}) + Tax (${formatCurrency(taxAmount)}) = ${formatCurrency(expectedGross)}, but Gross is ${formatCurrency(actualGross)}`;
      }
    }
    return null;
  }, [financials, formatCurrency]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (vendorChoice.type === 'new' && !vendorChoice.vendorName.trim()) {
      errors.push('Vendor name is required');
    }
    if (!quoteReference.trim()) {
      errors.push('Quote reference is required');
    }
    return errors;
  }, [vendorChoice, quoteReference]);

  const canAccept = validationErrors.length === 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col"
      data-testid="extraction-review-screen"
    >
      <div className="flex flex-col border-b border-subtle/50 bg-background">
        <div className="px-4 py-2 border-b border-subtle/30 bg-muted/10">
          <ExtractionProgressIndicator />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold" data-testid="text-extraction-title">
            Review Extracted Data
          </h1>
          {extractedData.vendorConfidence && (
            <ConfidenceBadge confidence={extractedData.vendorConfidence} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="border-subtle"
            data-testid="button-cancel-extraction"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={handleAccept}
                  disabled={!canAccept}
                  data-testid="button-accept-extraction"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept extracted data
                </Button>
              </span>
            </TooltipTrigger>
            {!canAccept && (
              <TooltipContent side="bottom" data-testid="tooltip-accept-disabled">
                <ul className="text-xs space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20" data-testid="validation-errors-strip">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive">
            {validationErrors.join(' · ')}
          </span>
        </div>
      )}

      <div className={`flex-1 flex min-h-0 ${isSmallScreen ? 'flex-col' : 'flex-row'}`}>
        {/* Document Viewer - collapsible on small screens */}
        {isSmallScreen ? (
          <div className="border-b border-subtle/50 flex flex-col">
            <Button
              variant="ghost"
              onClick={() => setShowDocument(!showDocument)}
              className="flex items-center justify-between w-full rounded-none px-4"
              data-testid="button-toggle-document"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted" />
                <span className="text-sm font-medium text-muted">
                  Original Document
                </span>
              </div>
              {showDocument ? (
                <ChevronUp className="w-4 h-4 text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted" />
              )}
            </Button>
            {showDocument && (
              <div className="h-[40vh] min-h-[300px]">
                <DocumentViewerFallback documentUrl={documentUrl} />
              </div>
            )}
          </div>
        ) : (
          <div className="w-1/2 border-r border-subtle/50 flex flex-col">
            <div className="px-4 py-2 border-b border-subtle/30 bg-muted/10 flex items-center justify-between">
              <span className="text-sm font-medium text-muted" data-testid="text-document-label">
                Original Document
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDocument(!showDocument)}
                className="text-xs text-muted"
                data-testid="button-toggle-document-desktop"
              >
                {showDocument ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showDocument && (
              <div className="flex-1 min-h-0">
                <DocumentViewerFallback documentUrl={documentUrl} />
              </div>
            )}
          </div>
        )}

        <div className={`${isSmallScreen ? 'flex-1' : showDocument ? 'w-1/2' : 'w-full'} flex flex-col min-h-0`}>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <section data-testid="section-metadata">
                <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
                  Quote Metadata
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Vendor <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Select
                        value={vendorChoice.type === 'existing' ? vendorChoice.vendorId : '__new__'}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            setVendorChoice({ 
                              type: 'new', 
                              vendorName: extractedData.vendorName ?? '' 
                            });
                          } else {
                            setVendorChoice({ type: 'existing', vendorId: value });
                          }
                        }}
                      >
                        <SelectTrigger 
                          className="border-subtle"
                          data-testid="select-vendor-mode"
                        >
                          <SelectValue placeholder="Select vendor option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__new__" data-testid="option-new-vendor">
                            <div className="flex items-center gap-2">
                              <Plus className="w-3 h-3" />
                              Add as new vendor
                            </div>
                          </SelectItem>
                          {vendors.length > 0 && (
                            <>
                              {vendors.map(vendor => (
                                <SelectItem 
                                  key={vendor.id} 
                                  value={vendor.id}
                                  data-testid={`option-vendor-${vendor.id}`}
                                >
                                  {vendor.name}
                                  {hasMatchedVendor && 
                                   vendor.name.toLowerCase() === extractedData.vendorName?.toLowerCase() && (
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      Match
                                    </Badge>
                                  )}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {hasMatchedVendor && vendorChoice.type === 'existing' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-700 dark:text-green-400" data-testid="vendor-match-notice">
                          <Check className="w-3 h-3 shrink-0" />
                          <span>
                            Extracted vendor &ldquo;{extractedData.vendorName}&rdquo; matched to an existing vendor
                          </span>
                        </div>
                      )}
                      {vendorChoice.type === 'new' && (
                        <Input
                          value={vendorChoice.vendorName}
                          onChange={(e) => setVendorChoice({ 
                            type: 'new', 
                            vendorName: e.target.value 
                          })}
                          placeholder="Enter new vendor name"
                          className="border-subtle"
                          data-testid="input-new-vendor-name"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Quote Reference <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={quoteReference}
                        onChange={(e) => setQuoteReference(e.target.value)}
                        placeholder="e.g. Q-2025-001"
                        className="border-subtle"
                        data-testid="input-quote-reference"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Quote Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal border-subtle"
                            data-testid="button-quote-date"
                          >
                            {quoteDate ? format(quoteDate, 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={quoteDate}
                            onSelect={setQuoteDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger 
                          className="border-subtle"
                          data-testid="select-currency"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tax Rate (%)</Label>
                      <Input
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        placeholder="e.g. 19"
                        className="border-subtle"
                        data-testid="input-tax-rate"
                      />
                      {extractedData.financials.taxLabel && (
                        <p className="text-xs text-muted">
                          Detected: {extractedData.financials.taxLabel}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section data-testid="section-tree">
                <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
                  Quote Items
                </h2>
                <div className="border border-subtle/50 rounded-md overflow-hidden">
                  <div className="flex items-center px-3 py-2 bg-muted/20 border-b border-subtle/30 text-xs font-medium text-muted">
                    <div className="w-5 shrink-0" />
                    <span className="min-w-[3rem] shrink-0">No.</span>
                    <span className="flex-1">Description</span>
                    <span className="w-16 text-right hidden md:inline">Qty</span>
                    <span className="w-14 text-center hidden md:inline">Unit</span>
                    <span className="w-20 text-right hidden md:inline">Unit Price</span>
                    <span className="w-24 text-right">Total</span>
                  </div>
                  
                  {filteredTree.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted" data-testid="empty-tree-message">
                      <FileWarning className="w-8 h-8 mx-auto mb-3 opacity-50" />
                      <p className="font-medium mb-2">No line items extracted</p>
                      <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto mb-3">
                        The AI couldn't extract line items from this document. This can happen with scanned documents, handwritten quotes, or unusual formats.
                      </p>
                      <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto">
                        You can add line items manually after accepting, or cancel and re-upload a clearer document.
                      </p>
                    </div>
                  ) : (
                    <div data-testid="extraction-tree">
                      {filteredTree.map(node => (
                        <TreeNodeRow
                          key={node.id}
                          node={node}
                          depth={0}
                          expandedSections={expandedSections}
                          onToggleSection={handleToggleSection}
                          onUpdateNode={handleUpdateNode}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section data-testid="section-financials">
                <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
                  Financial Summary
                </h2>
                <div className="border border-subtle/50 rounded-md p-4 space-y-3">
                  {/* Calculated total from line items */}
                  <div className="flex items-center justify-between bg-muted/20 rounded px-3 py-2 mb-2">
                    <div>
                      <Label className="text-sm font-medium">Calculated Total</Label>
                      <p className="text-xs text-muted">Sum of line items (excl. subtotals)</p>
                    </div>
                    <span 
                      className="text-lg font-semibold"
                      data-testid="calculated-total"
                    >
                      {formatCurrency(calculatedTotal)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Net Total</Label>
                    <CurrencyInput
                      value={financials.netTotal}
                      onChange={(value) => {
                        setFinancials(prev => ({
                          ...prev,
                          netTotal: value,
                        }));
                      }}
                      className="w-40 text-right border-subtle"
                      placeholder="Net amount"
                      data-testid="input-net-total"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Tax Amount</Label>
                    <CurrencyInput
                      value={financials.taxAmount}
                      onChange={(value) => {
                        setFinancials(prev => ({
                          ...prev,
                          taxAmount: value,
                        }));
                      }}
                      className="w-40 text-right border-subtle"
                      placeholder="Tax amount"
                      data-testid="input-tax-amount"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-subtle/30 pt-3">
                    <Label className="text-sm font-semibold">Gross Total</Label>
                    <CurrencyInput
                      value={financials.grossTotal}
                      onChange={(value) => {
                        setFinancials(prev => ({
                          ...prev,
                          grossTotal: value,
                        }));
                      }}
                      className="w-40 text-right font-semibold border-subtle"
                      placeholder="Gross total"
                      data-testid="input-gross-total"
                    />
                  </div>

                  {financialInconsistency && (
                    <div
                      className="flex items-start gap-2 mt-3 px-3 py-2 rounded-md bg-status-draft-subtle border border-[var(--signal-warning)]/30 text-sm"
                      data-testid="financial-inconsistency-warning"
                    >
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--signal-warning)]" />
                      <span className="text-foreground text-xs">
                        {financialInconsistency}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
