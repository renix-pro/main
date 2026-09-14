/**
 * RENIX vNext — Quotes Frame (Zone-Based Architecture)
 * 
 * Zone-based navigation with simple state model:
 * - root: Scope grid view
 * - scope: Inside a specific scope
 * - extraction: Document extraction review overlay
 * - allocation: Row allocation dialog
 * 
 * Object model:
 * - Vendor
 * - Quote (exactly one Vendor)
 * - Quote Version (immutable snapshots)
 * - Quote Line (atomic assertions)
 */

export * from './types';
export { 
  useQuotesData, 
  type Vendor, 
  type QuoteVersion, 
  type Quote, 
  type QuotesData, 
  type QuotesFrameData 
} from './useQuotesData';
export { ScopeQuotesView } from './ScopeQuotesView';
export { 
  ExtractionReviewScreen,
  type ExtractionReviewScreenProps,
  type ExtractedQuoteData,
  type ExtractedTreeNode,
  type ExtractedFinancials,
  type AcceptedExtractedData,
  type AcceptedTreeNode,
  type VendorChoice,
} from './ExtractionReviewScreen';
export { AllocationDialog } from './AllocationDialog';
export { QuoteImportPipeline, type QuoteImportSession, type QuoteImportPipelineProps } from './QuoteImportPipeline';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearch } from 'wouter';
import { getAuthHeaders } from '@/auth/AuthContext';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { queryKeys } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ExtractionReviewScreen, type AcceptedExtractedData, type AcceptedTreeNode } from './ExtractionReviewScreen';
import { QuoteImportPipeline, type QuoteImportSession } from './QuoteImportPipeline';
import type { QuotesViewState } from './types';
import { initialViewState } from './types';
import { useQuotesData, getEffectiveQuoteStatus, isQuoteCommitted } from './useQuotesData';
import { QuotesOverview } from './QuotesOverview';
import { QuotesFrameDialogs, type DialogState } from './QuotesFrameDialogs';
import { useImportSessionChecker } from './useImportSessionChecker';
import { useScopeTileData } from './useScopeTileData';
import { QuotesSkeleton } from '@/components/FrameSkeleton';
import { useAICompanion } from '@/shell/AICompanionContext';
import { useDesktopLayoutSafe } from '@/shell/DesktopWorkspaceLayout';
import { useMobileLayoutSafe } from '@/shell/MobileWorkspaceLayout';

interface Scope {
  id: string;
  name: string;
  description: string | null;
  isOptional: boolean;
}

export function QuotesFrame() {
  const { projectId, projectName, currency, isReadOnly } = useProject();
  const { formatCurrency } = useFormatters();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const quotes = useQuotesData(projectId, currency, isReadOnly);
  const aiCompanion = useAICompanion();
  const desktopLayout = useDesktopLayoutSafe();
  const mobileLayout = useMobileLayoutSafe();
  
  const [viewState, setViewState] = useState<QuotesViewState>(initialViewState);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  
  const [activeImportSession, setActiveImportSession] = useState<QuoteImportSession | null>(null);
  const [importScopeId, setImportScopeId] = useState<string | null>(null);

  // Deep-link state: set when URL contains ?quoteId=&scopeId=&verify=true
  // Passed into QuotesOverview → ScopeDetailsPanel to programmatically open the drawer.
  const [deepLink, setDeepLink] = useState<{ quoteId: string; scopeId: string; editMode: boolean } | null>(null);

  // Deep-link: reactively read ?quoteId=&scopeId= from URL and auto-open that quote's drawer.
  // useSearch() from wouter is reactive and Safari-safe — it updates synchronously
  // with wouter's pushState navigation, unlike window.location.search which can lag.
  const search = useSearch();
  const lastAppliedSearchRef = useRef('');
  useEffect(() => {
    if (!quotes.data) return;

    const params = new URLSearchParams(search);
    const targetQuoteId = params.get('quoteId');
    const targetScopeId = params.get('scopeId');
    const targetVerify = params.get('verify') === 'true';

    if (!targetQuoteId) return;
    // Prevent re-applying after we clear the URL (replaceState doesn't update useSearch)
    if (lastAppliedSearchRef.current === search) return;

    const quote = quotes.data.quotes.find(q => q.id === targetQuoteId);
    if (!quote) return;

    lastAppliedSearchRef.current = search;

    const effectiveScopeId = targetScopeId || (quote as any).scopeId || null;

    // Select and expand the scope in the overview tree
    if (effectiveScopeId) {
      setSelectedScopeId(effectiveScopeId);
    }

    // Signal ScopeDetailsPanel (via QuotesOverview) to open this quote's drawer
    setDeepLink({
      quoteId: targetQuoteId,
      scopeId: effectiveScopeId || '',
      editMode: targetVerify,
    });

    // Clear the deep-link params from the URL without triggering a navigation
    window.history.replaceState(null, '', window.location.pathname);
  }, [quotes.data, search]);

  // Clear deep-link state after a short delay so that returning to the frame
  // (or refreshing quotes data) doesn't re-open the sheet unexpectedly.
  // ScopeDetailsPanel captures openQuoteId in its own local state on mount,
  // so clearing the parent state has no effect on the already-open sheet.
  useEffect(() => {
    if (!deepLink) return;
    const t = setTimeout(() => setDeepLink(null), 500);
    return () => clearTimeout(t);
  }, [deepLink]);

  const { data: scopeData } = useQuery<{ scopes: Scope[] }>({
    queryKey: ['api', 'projects', projectId, 'scope'],
    enabled: !!projectId,
  });

  const scopes = scopeData?.scopes || [];
  const scopeReferences: any[] = [];
  const nativeRows: any[] = [];
  
  useImportSessionChecker({
    projectId,
    scopes,
    activeImportSession,
    setActiveImportSession,
    setImportScopeId,
  });

  const closeDialog = () => setDialog({ type: 'none' });

  const scopeTileData = useScopeTileData({
    scopes,
    quotes: quotes.data?.quotes || [],
    scopeReferences,
    nativeRows,
  });

  const handleSaveVendor = (name: string, contactInfo?: string, notes?: string) => {
    if (dialog.type === 'edit-vendor') {
      quotes.updateVendor(dialog.vendor.id, name, contactInfo, notes);
    } else {
      quotes.addVendor(name, contactInfo, notes);
    }
  };

  const handleDeleteVendor = () => {
    if (dialog.type === 'delete-vendor') {
      quotes.deleteVendor(dialog.vendor.id);
    }
  };

  const handleSaveQuote = (vendorId: string, reference: string, description?: string) => {
    if (dialog.type === 'edit-quote') {
      quotes.updateQuote(dialog.quote.id, reference, description);
    } else {
      quotes.addQuote(vendorId, reference, description);
    }
  };

  const handleDeleteQuote = () => {
    if (dialog.type === 'delete-quote') {
      quotes.deleteQuote(dialog.quote.id);
    }
  };


  const handleAcceptVersion = () => {
    if (dialog.type === 'accept-version') {
      quotes.acceptVersion(dialog.quote.id, dialog.version.id);
    }
  };

  const handleAddQuoteToScope = useCallback(async (scopeId: string) => {
    if (isReadOnly) return;
    
    try {
      const res = await fetch(
        `/api/projects/${projectId}/scopes/${scopeId}/import-session`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          credentials: 'include',
        }
      );
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 409 && data.session) {
          setImportScopeId(scopeId);
          setActiveImportSession(data.session);
          return;
        }
        console.error('Failed to create import session:', data);
        return;
      }
      
      const session: QuoteImportSession = data.session;
      setImportScopeId(scopeId);
      setActiveImportSession(session);
    } catch (err) {
      console.error('Failed to start import pipeline:', err);
    }
  }, [isReadOnly, projectId]);

  const handleQuoteCreatedFromUpload = useCallback(async (quoteId: string, versionId: string) => {
    const currentDialog = dialog;
    const scopeId = currentDialog.type === 'upload-quote-for-scope' ? currentDialog.scopeId : null;
    
    closeDialog();
    
    if (currentDialog.type === 'upload-quote-for-scope' && scopeId) {
      const maxRetries = 8;
      const retryDelay = 2000;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const res = await fetch(`/api/projects/${projectId}/quote-versions/${versionId}/extraction`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            const hasExtractedData = data.extractedData?.tree?.length > 0 || 
                                     data.extractedData?.financials?.netTotal ||
                                     data.extractedData?.financials?.grossTotal;
            
            if (data.extractedData && data.documentUrl && hasExtractedData) {
              console.log(`[Extraction] Data ready after ${attempt + 1} attempts`);
              setViewState({
                view: 'extraction',
                scopeId,
                quoteId,
                versionId,
                documentId: data.documentId || versionId,
                documentUrl: data.documentUrl,
                extractedData: data.extractedData,
              });
              return;
            }
            
            if (attempt < maxRetries - 1) {
              console.log(`[Extraction] Attempt ${attempt + 1}: waiting for extraction to complete...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        } catch (err) {
          console.error('Failed to fetch extraction data:', err);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      console.log('[Extraction] Max retries reached, showing with available data');
      try {
        const finalRes = await fetch(`/api/projects/${projectId}/quote-versions/${versionId}/extraction`, {
          credentials: 'include',
        });
        if (finalRes.ok) {
          const data = await finalRes.json();
          if (data.extractedData && data.documentUrl) {
            setViewState({
              view: 'extraction',
              scopeId,
              quoteId,
              versionId,
              documentId: data.documentId || versionId,
              documentUrl: data.documentUrl,
              extractedData: data.extractedData,
            });
            return;
          }
        }
      } catch (err) {
        console.error('Final extraction fetch failed:', err);
      }
      
      setViewState({ view: 'root' });
      setSelectedScopeId(scopeId);
    }
  }, [dialog, projectId]);

  const handleExtractionAccept = useCallback(async (acceptedData: AcceptedExtractedData) => {
    if (viewState.view !== 'extraction') return;
    
    const { scopeId, quoteId, versionId } = viewState;
    
    try {
      const flattenTree = (nodes: AcceptedTreeNode[]): AcceptedTreeNode[] => {
        const result: AcceptedTreeNode[] = [];
        for (const node of nodes) {
          result.push(node);
          if (node.children?.length > 0) {
            result.push(...flattenTree(node.children));
          }
        }
        return result;
      };
      
      const allNodes = flattenTree(acceptedData.tree || []);
      
      const payload: Record<string, unknown> = {
        vendorName: acceptedData.vendor.type === 'new' ? acceptedData.vendor.vendorName : undefined,
        reference: acceptedData.quoteReference,
        date: acceptedData.quoteDate,
        currency: acceptedData.currency,
        total: acceptedData.financials?.grossTotal,
        subtotal: acceptedData.financials?.netTotal,
        tax: acceptedData.financials?.taxAmount,
        lineItems: allNodes.map(node => ({
          description: node.description,
          quantity: node.quantity,
          unit: node.unit,
          unitPrice: node.unitPrice,
          amount: node.totalPrice,
          originalNumber: node.number,
        })),
      };
      
      const res = await fetch(`/api/projects/${projectId}/quote-versions/${versionId}/extracted-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      
      if (!res.ok) {
        console.error('Failed to save extraction data:', await res.text());
      }
    } catch (err) {
      console.error('Failed to persist extraction data:', err);
    }
    
    await queryClient.refetchQueries({ queryKey: queryKeys.quotes(projectId) });
    setViewState({ view: 'root' });
    setSelectedScopeId(scopeId);
  }, [viewState, projectId, queryClient]);

  const handleExtractionCancel = useCallback(() => {
    if (viewState.view !== 'extraction') return;
    const scopeId = viewState.scopeId;
    setViewState({ view: 'root' });
    setSelectedScopeId(scopeId);
  }, [viewState]);


  const handleSelectScope = (scopeId: string) => {
    setSelectedScopeId(prev => prev === scopeId ? null : scopeId);
  };

  const handleImportPipelineComplete = useCallback(async () => {
    const scopeId = importScopeId;
    
    setActiveImportSession(null);
    setImportScopeId(null);
    
    await queryClient.refetchQueries({ queryKey: queryKeys.quotes(projectId) });
    await queryClient.refetchQueries({ 
      queryKey: ['api', 'projects', projectId, 'scope-references'] 
    });
    
    setViewState({ view: 'root' });
    if (scopeId) {
      setSelectedScopeId(scopeId);
    }
  }, [importScopeId, projectId, queryClient]);

  if (quotes.isLoading) return <QuotesSkeleton />;

  if (activeImportSession && importScopeId) {
    const scope = scopes.find(s => s.id === importScopeId);
    const scopeName = scope?.name || 'Unknown Scope';
    
    return (
      <QuoteImportPipeline
        projectId={projectId}
        scopeId={importScopeId}
        scopeName={scopeName}
        session={activeImportSession}
        vendors={quotes.data?.vendors || []}
        projectCurrency={currency}
        onComplete={handleImportPipelineComplete}
      />
    );
  }

  if (viewState.view === 'extraction') {
    return (
      <ExtractionReviewScreen
        projectId={projectId}
        scopeId={viewState.scopeId}
        documentId={viewState.documentId}
        documentUrl={viewState.documentUrl}
        extractedData={viewState.extractedData}
        vendors={quotes.data.vendors}
        projectCurrency={currency}
        onAccept={handleExtractionAccept}
        onCancel={handleExtractionCancel}
      />
    );
  }


  const handleCompareQuote = (quoteId: string) => {
    console.log('Compare quote:', quoteId);
  };

  const handleAskAI = () => {
    if (!selectedScopeId) return;

    const scope = scopes.find(s => s.id === selectedScopeId);
    const scopeName = scope?.name || 'this scope';
    const scopeQuotes = (quotes.data?.quotes || []).filter(q => q.scopeId === selectedScopeId);
    const vendors = quotes.data?.vendors || [];

    let message = `Tell me about the quotes for "${scopeName}".`;
    if (scopeQuotes.length > 0) {
      const summaries = scopeQuotes.map(q => {
        const vendor = vendors.find(v => v.id === q.vendorId);
        const latestVersion = q.versions[q.versions.length - 1];
        const amount = latestVersion ? formatCurrency(latestVersion.total) : 'N/A';
        const status = getEffectiveQuoteStatus(q);
        return `${vendor?.name || q.description || 'Untitled'} (${status}, ${amount})`;
      });
      message = `I have ${scopeQuotes.length} quote(s) for "${scopeName}": ${summaries.join('; ')}. What should I know about these? Are the amounts reasonable?`;
    }

    aiCompanion.sendToAI(message);

    if (mobileLayout) {
      mobileLayout.showAI();
    } else if (desktopLayout?.aiCollapsed) {
      desktopLayout.setAICollapsed(false);
    }
  };

  const handleCommitQuote = async () => {
    if (!selectedScopeId || !projectId) return;
    const scopeQuotes = (quotes.data?.quotes || []).filter(q => q.scopeId === selectedScopeId);
    const uncommittedQuotes = scopeQuotes.filter(q => !isQuoteCommitted(q));
    if (uncommittedQuotes.length === 0) {
      toast({ title: "Already committed", description: "All quotes for this scope are already committed." });
      return;
    }
    try {
      for (const quote of uncommittedQuotes) {
        const effectiveStatus = getEffectiveQuoteStatus(quote);
        const steps = effectiveStatus === 'verified' ? ['committed'] : ['draft', 'committed'];
        for (const targetStatus of steps) {
          const resp = await fetch(`/api/projects/${projectId}/quotes/${quote.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({ status: targetStatus }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `Failed to transition to ${targetStatus}`);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'scope-references'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'native-rows'] });
      toast({ title: "Quote committed", description: `${uncommittedQuotes.length} quote(s) committed for this scope.` });
    } catch (err: any) {
      console.error('Error committing quotes:', err);
      toast({ title: "Commit failed", description: err.message || "Could not commit quotes. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="h-full w-full bg-muted/20 dark:bg-muted/10 flex flex-col overflow-auto" data-testid="frame-quotes">
      <div className="p-6 space-y-6 pl-[0px] pr-[0px] pt-[0px] pb-[0px]">
        <QuotesOverview
          selectedScopeId={selectedScopeId}
          onSelectScope={handleSelectScope}
          onCompareQuote={handleCompareQuote}
          onAskAI={handleAskAI}
          onCommitQuote={handleCommitQuote}
          openQuoteId={deepLink?.quoteId}
          openScopeId={deepLink?.scopeId}
          openInEditMode={deepLink?.editMode}
          onAddVersion={(quoteId: string) => {
            const quote = quotes.data?.quotes.find(q => q.id === quoteId);
            const quoteScopeId = quote?.scopeId || selectedScopeId;
            const scope = quoteScopeId ? scopes.find(s => s.id === quoteScopeId) : null;
            const scopeName = scope?.name || 'this scope';
            const quoteRef = quote?.description || 'this quote';
            aiCompanion.setDeferredUploadContext({
              intent: 'add_version',
              quoteId,
              quoteRef,
              scopeName,
              scopeId: quoteScopeId ?? undefined,
            });
            aiCompanion.requestFileUpload();
            aiCompanion.open();
            if (mobileLayout) {
              mobileLayout.showAI();
            } else if (desktopLayout?.aiCollapsed) {
              desktopLayout.setAICollapsed(false);
            }
          }}
          onAcceptVersion={(quote, version) => {
            setDialog({ type: 'accept-version', quote, version });
          }}
          onDeleteQuote={(quoteId: string) => {
            quotes.deleteQuote(quoteId);
          }}
        />
      </div>
      <QuotesFrameDialogs
        dialog={dialog}
        closeDialog={closeDialog}
        vendors={quotes.data.vendors}
        currency={currency}
        projectId={projectId}
        onSaveVendor={handleSaveVendor}
        onDeleteVendor={handleDeleteVendor}
        onSaveQuote={handleSaveQuote}
        onDeleteQuote={handleDeleteQuote}
        onAcceptVersion={handleAcceptVersion}
        onQuoteCreated={handleQuoteCreatedFromUpload}
      />
    </div>
  );
}

export default QuotesFrame;
