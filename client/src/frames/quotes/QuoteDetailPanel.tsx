import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/auth/AuthContext';
import {
  ArrowLeft, FileText, Check, Trash2, CheckCircle2,
  AlertCircle, GitCompare, Sparkles, Calendar, Pencil, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '../../context/ProjectContext';
import type { Quote, QuoteVersion, Vendor, QuoteLineItem } from './useQuotesData';
import type { ExtractedQuote, NativeExtraction, ScopeData, ScopeReference, FullExtractionResult } from './QuoteWorkspaceTypes';
import { RenixSpinner, RenixLoader } from '@/components/RenixLoader';
import { DerivedQuoteView, EditableDerivedQuoteView } from './QuoteDerivedView';
import { QuoteAIAssessment } from './QuoteAIAssessment';
import { QuoteNativeTable } from './QuoteNativeTable';
import { InlineVersionComparison } from './InlineVersionComparison';
import { QuoteAIPanel } from './QuoteAIPanel';
import { useRegionalContext } from '../../context/ProjectContext';

function getActiveVersion(versions: any[]) {
  return versions?.find((v: any) => v.commitmentStatus === 'active')
    || versions?.find((v: any) => v.commitmentStatus === 'accepted')
    || versions?.[0];
}

function formatDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function InlineEditField({
  label, value, editMode, isReadOnly, onChange, testId, type = 'text'
}: {
  label: string; value: string; editMode: boolean; isReadOnly?: boolean;
  onChange: (val: string) => void; testId: string; type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (localValue !== value) onChange(localValue);
  };

  return (
    <div className="flex items-center justify-between py-1.5 border-l-2 border-muted-foreground/20 pl-3" data-testid={testId}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <input
            ref={inputRef}
            type={type}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLocalValue(value); setEditing(false); } }}
            className="text-xs font-medium text-right bg-transparent border-b border-foreground/30 outline-none px-1 py-0 min-w-[100px]"
            data-testid={`${testId}-input`}
          />
        ) : (
          <span className="text-xs font-normal" data-testid={`${testId}-value`}>{value || '\u2014'}</span>
        )}
        {editMode && !isReadOnly && (
          <button onClick={() => setEditing(true)} className="text-muted-foreground/50" data-testid={`${testId}-edit`}>
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface QuoteDetailPanelProps {
  projectId: string;
  quote: Quote;
  vendor: Vendor | undefined;
  allQuotes: Quote[];
  vendors: Vendor[];
  formatCurrency: (amount: number) => string;
  currencySymbol?: string;
  scopeName?: string;
  isReadOnly?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onSelectLineageQuote?: (quoteId: string) => void;
  onAddVersion?: () => void;
  onAcceptVersion?: (version: QuoteVersion) => void;
  onSelectVersion?: (versionId: string) => void;
  onDeleteQuote?: () => void;
  initialEditMode?: boolean;
}

export function QuoteDetailPanel({
  projectId,
  quote,
  vendor,
  allQuotes,
  vendors,
  formatCurrency,
  currencySymbol = '€',
  scopeName,
  isReadOnly = false,
  onBack,
  onClose,
  onSelectLineageQuote,
  onAddVersion,
  onAcceptVersion,
  onSelectVersion,
  onDeleteQuote,
  initialEditMode = false,
}: QuoteDetailPanelProps) {
  const { toast } = useToast();
  const { navigateToDocument } = useProject();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(initialEditMode);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const version = useMemo(() => {
    if (selectedVersionId) {
      const found = quote.versions.find((v: QuoteVersion) => v.id === selectedVersionId);
      if (found) return found;
    }
    return getActiveVersion(quote.versions);
  }, [quote.versions, selectedVersionId]);

  const versionNumber = version?.versionNumber;
  const extractionStatus = version?.extractionStatus;
  const commitmentStatus = version?.commitmentStatus;

  const scopeQuoteCount = useMemo(() => {
    if (!quote?.scopeId) return 1;
    return allQuotes.filter(q => q.scopeId === quote.scopeId).length;
  }, [quote, allQuotes]);

  const handleToggleCommitmentStatus = useCallback(async (newStatus: 'active' | 'superseded') => {
    if (!quote || !version?.id || !projectId || isTogglingStatus) return;
    if (version.extractionStatus !== 'verified') return;
    if (version.commitmentStatus !== 'active' && version.commitmentStatus !== 'superseded') return;
    if (version.commitmentStatus === newStatus) return;

    setIsTogglingStatus(true);
    try {
      if (newStatus === 'active') {
        const scopeSiblings = allQuotes.filter(q => q.scopeId === quote.scopeId && q.id !== quote.id);
        for (const sibling of scopeSiblings) {
          const siblingVersion = getActiveVersion(sibling.versions);
          if (siblingVersion?.commitmentStatus === 'active') {
            const sibRes = await fetch(`/api/projects/${projectId}/versions/${siblingVersion.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ commitmentStatus: 'superseded' }),
            });
            if (!sibRes.ok) throw new Error('Failed to supersede sibling quote');
          }
        }
      }

      const response = await fetch(`/api/projects/${projectId}/versions/${version.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commitmentStatus: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      await queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
      toast({ title: `Quote ${newStatus === 'active' ? 'activated' : 'superseded'}` });
    } catch (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    } finally {
      setIsTogglingStatus(false);
    }
  }, [quote, version, projectId, allQuotes, queryClient, toast, isTogglingStatus]);

  const { data: extractionResult } = useQuery<any>({
    queryKey: ['api', 'projects', projectId, 'quote-versions', version?.id, 'extraction'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/quote-versions/${version!.id}/extraction`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId && !!version?.id,
  });

  const extractionLineItems = useMemo(() => {
    const tree = extractionResult?.extractedData?.tree;
    if (!Array.isArray(tree) || tree.length === 0) return null;
    return tree.filter((node: any) => {
      if (node.quantity || node.unitPrice) return true;
      const desc = (node.description || '').toLowerCase();
      return !/zwischensumme|subtotal|summe|sub-total|total\b|netto|brutto|gesamt/.test(desc) && desc.trim() !== '';
    });
  }, [extractionResult]);

  const { data: sourceDocuments } = useQuery<any[]>({
    queryKey: ['api', 'projects', projectId, 'source-documents'],
    enabled: !!projectId,
  });

  const sourceDoc = useMemo(() => {
    if (!version?.sourceDocumentId || !sourceDocuments) return null;
    return sourceDocuments.find((d: any) => d.id === version.sourceDocumentId) || null;
  }, [version?.sourceDocumentId, sourceDocuments]);

  const sourceDocName = sourceDoc?.fileName || null;
  const sourceDocDocumentId = sourceDoc?.documentId || null;

  const lineageQuotes = useMemo(() => {
    if (!quote?.lineageId) return [];
    return allQuotes
      .filter(q => q.lineageId === quote.lineageId)
      .sort((a, b) => {
        const vA = getActiveVersion(a.versions)?.versionNumber ?? 0;
        const vB = getActiveVersion(b.versions)?.versionNumber ?? 0;
        return vA - vB;
      });
  }, [quote, allQuotes]);

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedQuote | null>(null);
  const [nativeData, setNativeData] = useState<NativeExtraction | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'native' | 'derived'>('native');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [scopeData, setScopeData] = useState<ScopeData | null>(null);
  const [scopeReferences, setScopeReferences] = useState<ScopeReference[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  const selectedVersion = useMemo(() => {
    return version;
  }, [version]);

  const currentVersion = selectedVersion;

  const isDataVerified = useMemo(() => {
    return currentVersion?.extractionStatus === 'verified';
  }, [currentVersion]);

  const hasUncommittedData = useMemo(() => {
    return (extractedData !== null || nativeData !== null) && !isDataVerified;
  }, [extractedData, nativeData, isDataVerified]);

  const persistExtractedData = useCallback(async (
    data: ExtractedQuote,
    native: NativeExtraction | null,
    targetVersionId: string
  ) => {
    if (!targetVersionId) return;

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const response = await apiRequest(
        'PUT',
        `/api/projects/${projectId}/quote-versions/${targetVersionId}/extracted-data`,
        {
          vendorName: data.vendorName,
          vendorContact: data.vendorContact,
          vendorEmail: data.vendorEmail,
          vendorPhone: data.vendorPhone,
          reference: data.reference,
          date: data.date,
          validUntil: data.validUntil,
          subtotal: data.subtotal,
          tax: data.tax,
          taxRate: data.taxRate,
          total: data.total,
          currency: data.currency,
          notes: data.notes,
          lineItems: data.lineItems,
          nativeExtractionData: native,
        }
      );

      console.log('Extracted data persisted successfully');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error persisting extracted data:', err);
      setSaveStatus('error');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [projectId]);

  const compareVersion = useMemo(() => {
    if (!compareVersionId) return null;
    return quote.versions.find(v => v.id === compareVersionId) || null;
  }, [compareVersionId, quote.versions]);

  const handleVerifyExtraction = useCallback(async () => {
    if (!selectedVersion || isReadOnly) return;

    setIsCommitting(true);
    try {
      if (extractedData) {
        await persistExtractedData(extractedData, nativeData, selectedVersion.id);
      }

      const response = await fetch(
        `/api/projects/${projectId}/versions/${selectedVersion.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ extractionStatus: 'verified' }),
        }
      );

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
        toast({
          title: "Extraction verified",
          description: "The extracted data has been verified and confirmed.",
        });
      } else {
        toast({
          title: "Verification failed",
          description: "Could not verify this extraction. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error verifying extraction:', err);
    } finally {
      setIsCommitting(false);
    }
  }, [selectedVersion, projectId, extractedData, nativeData, persistExtractedData, isReadOnly, queryClient, toast]);

  const acceptedVersion = useMemo(() => {
    return quote.versions.find(v => v.commitmentStatus === 'accepted');
  }, [quote.versions]);

  const isVersionAccepted = selectedVersion?.commitmentStatus === 'accepted';

  const subtotal = useMemo(() => {
    if (extractedData?.lineItems && extractedData.lineItems.length > 0) {
      return extractedData.lineItems
        .filter(item => !!(item.quantity || item.unitPrice))
        .reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    if (selectedVersion?.lineItems && selectedVersion.lineItems.length > 0) {
      return selectedVersion.lineItems
        .filter((item: QuoteLineItem) => !!(item.quantity || item.unitPrice))
        .reduce((sum: number, item: QuoteLineItem) => sum + (item.totalPrice || 0), 0);
    }
    return 0;
  }, [selectedVersion, extractedData]);

  const handleViewModeChange = (value: string) => {
    const mode = value as 'native' | 'derived';
    setViewMode(mode);
  };

  const loadedSourceDocIdRef = useRef<string | null>(null);
  const loadedExtractionVersionIdRef = useRef<string | null>(null);
  const documentUrlRef = useRef<string | null>(null);
  const isExtractingRef = useRef(false);
  const prevSourceDocIdRef = useRef<string | null>(null);

  const buildDerivedData = useCallback((persistedData: any): ExtractedQuote => {
    const tree = persistedData.extractedData?.tree || [];
    const financials = persistedData.extractedData?.financials || {};
    return {
      vendorName: persistedData.extractedData?.vendorName || '',
      vendorContact: persistedData.extractedData?.vendorContact || '',
      vendorEmail: persistedData.extractedData?.vendorEmail || '',
      vendorPhone: persistedData.extractedData?.vendorPhone || '',
      reference: persistedData.extractedData?.quoteReference || '',
      date: persistedData.extractedData?.quoteDate || '',
      validUntil: persistedData.extractedData?.validUntil || '',
      subtotal: financials.netTotal ?? undefined,
      tax: financials.taxAmount ?? undefined,
      taxRate: financials.taxRate ?? undefined,
      total: financials.grossTotal ?? undefined,
      currency: persistedData.extractedData?.currency || 'EUR',
      notes: persistedData.extractedData?.notes || '',
      lineItems: tree.map((node: any) => ({
        description: node.description || '',
        quantity: node.quantity ?? undefined,
        unit: node.unit ?? undefined,
        unitPrice: node.unitPrice ?? undefined,
        amount: node.totalPrice ?? undefined,
      })),
    };
  }, []);

  useEffect(() => {
    const currentVersionId = selectedVersion?.id;
    const currentSourceDocId = selectedVersion?.sourceDocumentId;
    const isVerified = selectedVersion?.extractionStatus === 'verified';

    if (!currentVersionId || !currentSourceDocId) return;

    if (prevSourceDocIdRef.current !== null && prevSourceDocIdRef.current !== currentSourceDocId) {
      setDocumentUrl(null);
      documentUrlRef.current = null;
      setNativeData(null);
      setExtractedData(null);
      setExtractionError(null);
      loadedExtractionVersionIdRef.current = null;
      loadedSourceDocIdRef.current = null;
    }
    prevSourceDocIdRef.current = currentSourceDocId;

    if (currentVersionId === loadedExtractionVersionIdRef.current) return;
    if (isExtractingRef.current) return;

    let cancelled = false;

    const loadVerifiedQuote = async () => {
      try {
        const extractionRes = await fetch(
          `/api/projects/${projectId}/quote-versions/${currentVersionId}/extraction`,
          { credentials: 'include' }
        );
        if (cancelled) return;

        if (extractionRes.ok) {
          const persistedData = await extractionRes.json();
          if (!cancelled) {
            setExtractedData(buildDerivedData(persistedData));
            if (persistedData.nativeExtractionData) {
              setNativeData(persistedData.nativeExtractionData);
            }
            if (persistedData.documentUrl) {
              setDocumentUrl(persistedData.documentUrl);
              documentUrlRef.current = persistedData.documentUrl;
              loadedSourceDocIdRef.current = currentSourceDocId;
            }
            loadedExtractionVersionIdRef.current = currentVersionId;
          }
        }
      } catch (err) {
        console.error('Error loading verified extraction data:', err);
      }
    };

    const loadDraftQuote = async () => {
      let currentDocUrl = documentUrlRef.current;
      if (currentSourceDocId !== loadedSourceDocIdRef.current) {
        try {
          const response = await fetch(`/api/projects/${projectId}/source-documents`, { credentials: 'include' });
          if (cancelled) return;
          if (response.ok) {
            const docs = await response.json();
            const sourceDoc = docs.find((d: any) => d.id === currentSourceDocId);
            const documentPath = sourceDoc?.objectStoragePath || sourceDoc?.fileDataUrl;
            if (documentPath && !cancelled) {
              setDocumentUrl(documentPath);
              documentUrlRef.current = documentPath;
              loadedSourceDocIdRef.current = currentSourceDocId;
              currentDocUrl = documentPath;
            }
          }
        } catch (err) {
          console.error('Failed to load source document URL:', err);
        }
      }

      if (cancelled) return;

      try {
        const extractionRes = await fetch(
          `/api/projects/${projectId}/quote-versions/${currentVersionId}/extraction`,
          { credentials: 'include' }
        );
        if (cancelled) return;

        if (extractionRes.ok) {
          const persistedData = await extractionRes.json();
          const hasAnyPersistedData = !!(
            persistedData.extractedData?.tree?.length > 0 ||
            persistedData.extractedData?.financials?.grossTotal != null ||
            persistedData.extractedData?.financials?.netTotal != null ||
            persistedData.extractedData?.vendorName ||
            persistedData.extractedData?.quoteReference ||
            persistedData.extractedData?.quoteDate
          );

          if (hasAnyPersistedData || persistedData.extractedData) {
            const derivedData = buildDerivedData(persistedData);

            if (!cancelled) {
              setExtractedData(derivedData);
              loadedExtractionVersionIdRef.current = currentVersionId;
              if (persistedData.nativeExtractionData) {
                setNativeData(persistedData.nativeExtractionData);
              }
            }
            return;
          }
        }
      } catch (persistedErr) {
        console.error('Error loading persisted extraction:', persistedErr);
      }

      if (cancelled || !currentDocUrl) return;

      setExtractionError(null);
      setIsExtracting(true);
      isExtractingRef.current = true;

      try {
        const extractResponse = await fetch('/api/documents/extract-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ objectPath: currentDocUrl }),
        });

        if (cancelled) return;

        if (extractResponse.ok) {
          const data: FullExtractionResult = await extractResponse.json();
          setNativeData(data.native);
          setExtractedData(data.derived);
          loadedExtractionVersionIdRef.current = currentVersionId;
          await persistExtractedData(data.derived, data.native, currentVersionId);
        } else {
          const errorData = await extractResponse.json().catch(() => ({}));
          setExtractionError(errorData.error || 'Failed to extract document data');
        }
      } catch (err) {
        setExtractionError(err instanceof Error ? err.message : 'Extraction failed');
      } finally {
        setIsExtracting(false);
        isExtractingRef.current = false;
      }
    };

    if (isVerified) {
      loadVerifiedQuote();
    } else {
      loadDraftQuote();
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion?.id, selectedVersion?.sourceDocumentId, selectedVersion?.extractionStatus, projectId, persistExtractedData, buildDerivedData]);

  const handleUpdateExtractedData = useCallback((updatedData: ExtractedQuote) => {
    setExtractedData(updatedData);
  }, []);

  const { data: scopeDataQuery } = useQuery({
    queryKey: ['scope-data', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/scope`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch scope data');
      const data = await response.json();
      return {
        scopes: data.scopes || [],
        areas: data.areas || [],
        items: data.items || [],
      };
    },
    enabled: editMode,
  });

  const { data: scopeNodesQuery } = useQuery({
    queryKey: ['scope-nodes', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/scope-nodes`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch scope nodes');
      const data = await response.json();
      return data.nodes || [];
    },
    enabled: editMode,
  });

  useEffect(() => {
    if (scopeDataQuery) {
      setScopeData(scopeDataQuery);
    }
  }, [scopeDataQuery]);

  const { data: scopeRefsQuery } = useQuery({
    queryKey: ['scope-references', projectId, selectedVersion?.id],
    queryFn: async () => {
      if (!selectedVersion?.id) return [];
      const response = await fetch(`/api/projects/${projectId}/quote-versions/${selectedVersion.id}/scope-references`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch scope references');
      return response.json();
    },
    enabled: !!selectedVersion?.id && editMode,
  });

  const prevVersionIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevVersionIdRef.current !== selectedVersion?.id) {
      setScopeReferences([]);
      prevVersionIdRef.current = selectedVersion?.id;
    }
    if (scopeRefsQuery) {
      setScopeReferences(scopeRefsQuery);
    }
  }, [scopeRefsQuery, selectedVersion?.id]);

  const addScopeRefMutation = useMutation({
    mutationFn: async ({ rowId, scopeId, scopeItemId }: { rowId: string; scopeId: string; scopeItemId?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/native-rows/${rowId}/scope-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scopeId,
          scopeItemId: scopeItemId || null,
          allocationPercentage: 100,
        }),
      });
      if (!response.ok) throw new Error('Failed to add scope reference');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
    onError: (error) => {
      console.error('Failed to add scope reference:', error);
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
  });

  const removeScopeRefMutation = useMutation({
    mutationFn: async (refId: string) => {
      const response = await fetch(`/api/projects/${projectId}/scope-references/${refId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove scope reference');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
    onError: (error) => {
      console.error('Failed to remove scope reference:', error);
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async ({ refId, percentage }: { refId: string; percentage: number }) => {
      const response = await fetch(`/api/projects/${projectId}/scope-references/${refId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ allocationPercentage: percentage }),
      });
      if (!response.ok) throw new Error('Failed to update allocation percentage');
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }
      return { refId, percentage };
    },
    onMutate: async ({ refId, percentage }) => {
      await queryClient.cancelQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
      const previousRefs = scopeReferences;
      setScopeReferences(prev => prev.map(ref =>
        ref.id === refId ? { ...ref, allocationPercentage: percentage } : ref
      ));
      return { previousRefs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
    onError: (error, _variables, context) => {
      console.error('Failed to update allocation percentage:', error);
      if (context?.previousRefs) {
        setScopeReferences(context.previousRefs);
      }
      queryClient.invalidateQueries({ queryKey: ['scope-references', projectId, selectedVersion?.id] });
    },
  });

  const handleAddScopeReference = useCallback(async (rowId: string, scopeId: string, scopeItemId?: string) => {
    if (isReadOnly || !selectedVersion?.id) return;
    addScopeRefMutation.mutate({ rowId, scopeId, scopeItemId });
  }, [addScopeRefMutation, selectedVersion?.id, isReadOnly]);

  const handleRemoveScopeReference = useCallback(async (refId: string) => {
    if (isReadOnly) return;
    removeScopeRefMutation.mutate(refId);
  }, [removeScopeRefMutation, isReadOnly]);

  const handleUpdateAllocationPercentage = useCallback(async (refId: string, percentage: number) => {
    if (isReadOnly) return;
    updateAllocationMutation.mutate({ refId, percentage });
  }, [updateAllocationMutation, isReadOnly]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    const base = extractedData || {
      vendorName: '',
      vendorContact: '',
      vendorEmail: '',
      vendorPhone: '',
      reference: '',
      date: '',
      validUntil: '',
      lineItems: [],
    };
    const updated = { ...base, [field]: value } as ExtractedQuote;
    setExtractedData(updated);
  }, [extractedData]);

  const vendorName = vendor?.name || extractedData?.vendorName || '';
  const vendorContact = vendor?.contactDetails?.contact || extractedData?.vendorContact || '';
  const vendorEmail = vendor?.contactDetails?.email || extractedData?.vendorEmail || '';
  const vendorPhone = vendor?.contactDetails?.phone || extractedData?.vendorPhone || '';
  const quoteReference = extractedData?.reference || '';
  const quoteDate = extractedData?.date || '';
  const quoteValidUntil = extractedData?.validUntil || '';

  const fin = quote.financials;
  const displaySubtotal = extractedData?.subtotal ?? fin?.netAmount ?? (subtotal > 0 ? subtotal : undefined);
  const displayTax = extractedData?.tax ?? fin?.taxAmount ?? undefined;
  const displayTaxRate = extractedData?.taxRate ?? fin?.taxRate;
  const displayTotal = extractedData?.total ?? fin?.grossAmount ?? 0;

  return (
    <div
      className="h-full flex flex-col"
      data-testid="quote-detail-panel"
    >
      <header className="p-4 border-b border-subtle space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                data-testid="button-panel-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-lg font-semibold truncate" data-testid="text-panel-title">
              {quoteReference || scopeName || 'Quote'}
            </h1>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0"
              data-testid="button-close-panel"
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {versionNumber != null && (
              <Badge variant="outline" className="text-xs" data-testid="panel-version-badge">
                v{versionNumber}
              </Badge>
            )}
            {extractionStatus === 'draft' && (
              <Badge variant="draft" className="text-xs" data-testid="badge-extraction-status">Draft</Badge>
            )}
            {extractionStatus === 'verified' && (
              <Badge variant="approved" className="text-xs" data-testid="badge-extraction-status">Verified</Badge>
            )}
            {commitmentStatus === 'active' && (() => {
              const canToggle = extractionStatus === 'verified' && !!projectId && scopeQuoteCount > 1;
              return (
                <Badge
                  className={`text-xs ${canToggle ? 'cursor-pointer' : ''} ${isTogglingStatus ? 'opacity-50 pointer-events-none' : ''}`}
                  title={canToggle ? 'Click to supersede' : undefined}
                  onClick={canToggle ? () => handleToggleCommitmentStatus('superseded') : undefined}
                  data-testid="badge-commitment-status"
                >
                  Active
                </Badge>
              );
            })()}
            {commitmentStatus === 'superseded' && (() => {
              const canToggle = extractionStatus === 'verified' && !!projectId;
              return (
                <Badge
                  variant="secondary"
                  className={`text-xs ${canToggle ? 'cursor-pointer' : ''} ${isTogglingStatus ? 'opacity-50 pointer-events-none' : ''}`}
                  title={canToggle ? 'Click to set as active' : undefined}
                  onClick={canToggle ? () => handleToggleCommitmentStatus('active') : undefined}
                  data-testid="badge-commitment-status"
                >
                  Superseded
                </Badge>
              );
            })()}
            {commitmentStatus === 'accepted' && (
              <Badge variant="approved" className="text-xs" data-testid="badge-commitment-status">Accepted</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {editMode ? (
              <>
                {quote.versions.length > 1 && (
                  <Select value={compareVersionId ?? ''} onValueChange={(v) => setCompareVersionId(v || null)}>
                    <SelectTrigger className="w-auto border-subtle h-9 text-xs" data-testid="select-compare-version">
                      <GitCompare className="w-3.5 h-3.5 mr-1" />
                      <SelectValue placeholder="Compare" />
                    </SelectTrigger>
                    <SelectContent>
                      {quote.versions.filter(v => v.id !== selectedVersion?.id).map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          v{v.versionNumber} — {formatCurrency(v.total)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!isReadOnly && onDeleteQuote && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-subtle text-destructive hover:bg-destructive/10"
                        data-testid="button-delete-quote"
                        title="Delete quote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this quote? This action cannot be undone.
                          All versions and associated data will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onDeleteQuote}
                          className="bg-destructive hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          Delete Quote
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isSaving}
                  onClick={async () => {
                    if (extractedData && selectedVersion?.id) {
                      try {
                        await persistExtractedData(extractedData, nativeData, selectedVersion.id);
                        setEditMode(false);
                      } catch {
                        toast({ title: 'Save failed', description: 'Your changes could not be saved. Please try again.', variant: 'destructive' });
                      }
                    } else {
                      setEditMode(false);
                    }
                  }}
                  data-testid="button-toggle-edit-mode"
                  title={isSaving ? 'Saving...' : 'Done editing'}
                >
                  {isSaving ? (
                    <RenixSpinner />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
              </>
            ) : (
              <>
                {!isReadOnly && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEditMode(true)}
                    data-testid="button-toggle-edit-mode"
                    title="Edit quote"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              className="border-subtle"
              onClick={() => setShowAIPanel(prev => !prev)}
              data-testid="button-quote-ai"
              title="Ask AI"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {editMode && compareVersionId && compareVersion && selectedVersion && (
        <InlineVersionComparison
          leftVersion={selectedVersion}
          rightVersion={compareVersion}
          formatCurrency={formatCurrency}
          currencySymbol={currencySymbol}
          onClose={() => setCompareVersionId(null)}
        />
      )}

      {editMode && selectedVersion?.extractionStatus === 'draft' && !isReadOnly && (extractedData || nativeData) && (
        <div
          className="bg-status-draft-subtle border border-[var(--signal-warning)]/20 rounded-lg p-4 mx-3 mb-3 flex items-center justify-between gap-3"
          data-testid="verification-nudge-banner"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--signal-warning)] flex-shrink-0" />
            <p className="text-sm text-foreground">
              This quote's extraction has not been verified. Review the data below and verify to include it in your project financials.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 border-[var(--signal-warning)]/30"
            onClick={() => {
              const el = document.querySelector('[data-testid="card-extraction-verification"]');
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            data-testid="button-verify-now"
          >
            Verify Now
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <QuoteAIAssessment
          projectId={projectId}
          quoteId={quote.id}
        />

        <div>
          <h3 className="text-xs font-semibold mb-0.5 text-muted-foreground uppercase tracking-wide">Vendor Information</h3>
          <div className="space-y-0 divide-y divide-border/50">
            <InlineEditField label="Name" value={vendorName} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('vendorName', val)} testId="field-vendor-name" />
            <InlineEditField label="Contact" value={vendorContact} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('vendorContact', val)} testId="field-vendor-contact" />
            <InlineEditField label="Email" value={vendorEmail} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('vendorEmail', val)} testId="field-vendor-email" type="email" />
            <InlineEditField label="Phone" value={vendorPhone} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('vendorPhone', val)} testId="field-vendor-phone" type="tel" />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold mb-0.5 text-muted-foreground uppercase tracking-wide">Quote Header</h3>
          <div className="space-y-0 divide-y divide-border/50">
            <InlineEditField label="Reference" value={quoteReference} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('reference', val)} testId="field-quote-reference" />
            <InlineEditField label="Date" value={quoteDate} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('date', val)} testId="field-quote-date" />
            <InlineEditField label="Valid Until" value={quoteValidUntil} editMode={editMode} isReadOnly={isReadOnly} onChange={val => handleFieldChange('validUntil', val)} testId="field-quote-valid-until" />
          </div>
        </div>

        <div className="col-span-2" data-testid="drawer-details-grid">
          <div className="text-muted-foreground text-xs" data-testid="label-source-document">Source Document</div>
          <div className="text-foreground truncate text-xs" data-testid="value-source-document">
            {version?.sourceDocumentId ? (
              sourceDocName && sourceDocDocumentId ? (
                <button
                  className="inline-flex items-center gap-1.5 hover:underline cursor-pointer text-left text-status-pending bg-transparent text-xs"
                  onClick={() => {
                    navigateToDocument(sourceDocDocumentId);
                  }}
                  data-testid="link-source-document"
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  {sourceDocName}
                </button>
              ) : (
                'Loading...'
              )
            ) : (
              'No document'
            )}
          </div>
        </div>

        {(extractedData || nativeData) && !isDataVerified && (
          <Card className="border-subtle" data-testid="card-extraction-verification">
            <CardHeader className="py-3 border-b border-subtle">
              <CardTitle className="text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Extraction Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  {editMode
                    ? 'Review the extracted data below and verify it matches the source document.'
                    : 'This quote has not been verified yet. Switch to edit mode to review and verify the extracted data.'}
                </p>
                {editMode && (
                  <Button
                    onClick={handleVerifyExtraction}
                    disabled={isReadOnly || isCommitting}
                    className="w-full sm:w-auto"
                    data-testid="button-confirm-extraction"
                  >
                    {isCommitting ? (
                      <>
                        <RenixSpinner className="mr-2" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Verify extraction accuracy
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {editMode && (extractedData || nativeData || isExtracting) && (
          <div data-testid="quote-data-section">
            {isExtracting ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <RenixLoader size="md" />
                <p className="text-sm text-muted">Extracting quote data...</p>
              </div>
            ) : extractedData || nativeData ? (
              <div className="space-y-4">
                {isDataVerified ? (
                  <div data-testid="verified-quote-view">
                    {extractedData ? (
                      <EditableDerivedQuoteView
                        extractedData={extractedData}
                        isReadOnly={isReadOnly}
                        currencySymbol={currencySymbol}
                        formatCurrency={formatCurrency}
                        onUpdateExtractedData={handleUpdateExtractedData}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-muted italic">No structured data available.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Tabs value={viewMode} onValueChange={handleViewModeChange} data-testid="quote-view-tabs">
                    <TabsList className="w-full border border-subtle" data-testid="quote-view-tabs-list">
                      <TabsTrigger value="native" className="flex-1" data-testid="tab-trigger-native">
                        Original Quote
                      </TabsTrigger>
                      <TabsTrigger value="derived" className="flex-1" data-testid="tab-trigger-derived">
                        Analysed Quote
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="native" className="mt-4" data-testid="tab-content-native">
                      {nativeData ? (
                        <div className="space-y-4">
                          {nativeData.language && (
                            <p className="text-xs text-muted">
                              Language: {nativeData.language === 'de' ? 'German' : nativeData.language}
                            </p>
                          )}
                          <QuoteNativeTable
                            nativeData={nativeData}
                            scopeData={scopeData || undefined}
                            scopeReferences={scopeReferences}
                            onAddScopeReference={handleAddScopeReference}
                            onRemoveScopeReference={handleRemoveScopeReference}
                            onUpdateAllocationPercentage={handleUpdateAllocationPercentage}
                            isReadOnly={isReadOnly}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <p className="text-sm text-muted italic">
                            Original quote data not available. Upload a document for full extraction.
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="derived" className="mt-4" data-testid="tab-content-derived">
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-start gap-2" data-testid="analysed-quote-banner">
                        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Analysed values are interpretations. Refer to the original quote for authority.
                        </p>
                      </div>
                      {extractedData ? (
                        <EditableDerivedQuoteView
                          extractedData={extractedData}
                          isReadOnly={isReadOnly}
                          currencySymbol={currencySymbol}
                          formatCurrency={formatCurrency}
                          onUpdateExtractedData={handleUpdateExtractedData}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <p className="text-sm text-muted italic">No structured data available.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <FileText className="w-12 h-12 text-muted" />
                <p className="text-sm text-muted text-center">
                  Upload a document to extract quote data.
                </p>
              </div>
            )}
          </div>
        )}

        {!editMode && version && (extractionLineItems || version.lineItems.length > 0) && (
          <div data-testid="drawer-line-items-section">
            <div className="text-sm font-medium text-foreground mb-2" data-testid="line-items-header">
              {extractionLineItems
                ? `Line Items (${extractionLineItems.length})`
                : `Line Items (${version.lineItems.length})`}
            </div>
            {extractionLineItems ? (
              <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Qty</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Unit Price</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractionLineItems.map((node: any, idx: number) => (
                      <tr key={idx} className="border-b border-border last:border-b-0" data-testid={`line-item-row-${idx}`}>
                        <td className="p-2 text-foreground">{node.description}</td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {node.quantity != null ? `${node.quantity}${node.unit ? ` ${node.unit}` : ''}` : '\u2014'}
                        </td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {node.unitPrice != null ? formatCurrency(node.unitPrice) : '\u2014'}
                        </td>
                        <td className="p-2 text-right tabular-nums text-foreground whitespace-nowrap">
                          {node.totalPrice != null ? formatCurrency(node.totalPrice) : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : version.lineItems.length > 0 ? (
              <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Qty</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Unit Price</th>
                      <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.lineItems.map((item: QuoteLineItem) => (
                      <tr key={item.id} className="border-b border-border last:border-b-0" data-testid={`line-item-row-${item.id}`}>
                        <td className="p-2 text-foreground">{item.description}</td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : '\u2014'}
                        </td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {item.unitPrice != null ? formatCurrency(item.unitPrice) : '\u2014'}
                        </td>
                        <td className="p-2 text-right tabular-nums text-foreground whitespace-nowrap">
                          {item.totalPrice != null ? formatCurrency(item.totalPrice) : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        <div data-testid="drawer-total">
          <h3 className="text-sm font-semibold mb-2">Financial Summary</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net</span>
              <span className="tabular-nums" data-testid="text-quote-summary-subtotal">
                {displaySubtotal !== undefined
                  ? formatCurrency(displaySubtotal)
                  : isExtracting ? <span className="text-muted italic">Extracting...</span> : <span className="text-muted">&mdash;</span>
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax{displayTaxRate ? ` (${(displayTaxRate * 100).toFixed(0)}%)` : ''}
              </span>
              <span className="tabular-nums" data-testid="text-quote-summary-tax">
                {displayTax !== undefined
                  ? formatCurrency(displayTax)
                  : isExtracting ? <span className="text-muted italic">Extracting...</span> : <span className="text-muted">&mdash;</span>
                }
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-1 border-t border-subtle">
              <span>Total</span>
              <span className="tabular-nums" data-testid="text-drawer-gross">
                {displayTotal > 0 ? formatCurrency(displayTotal) : <span className="text-muted">&mdash;</span>}
              </span>
            </div>
          </div>
        </div>

        <div data-testid="drawer-lineage-section">
          <div className="text-sm font-medium text-foreground mb-3">Version History</div>
          {lineageQuotes.length > 1 ? (
            <div className="space-y-0 border-l-2 border-border ml-2 pl-4">
              {lineageQuotes.map(lq => {
                const lqVersion = getActiveVersion(lq.versions);
                const lqVendor = vendors.find(v => v.id === lq.vendorId);
                const isCurrent = lq.id === quote.id;
                const lqCommitment = lqVersion?.commitmentStatus;

                return (
                  <button
                    key={lq.id}
                    className={`w-full text-left py-2 flex items-center gap-2 flex-wrap text-xs ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => {
                      if (!isCurrent && onSelectLineageQuote) {
                        onSelectLineageQuote(lq.id);
                      }
                    }}
                    data-testid={`lineage-entry-${lq.id}`}
                  >
                    <span>v{lqVersion?.versionNumber ?? '?'}</span>
                    <span className="text-muted-foreground/40">&mdash;</span>
                    <span>{lqVendor?.name || 'Unknown'}</span>
                    <span className="text-muted-foreground/40">&mdash;</span>
                    <span className="tabular-nums">{lqVersion ? formatCurrency(lqVersion.total) : '\u2014'}</span>
                    {lqCommitment === 'active' && (
                      <Badge variant="outline" className="text-xs" data-testid={`lineage-badge-${lq.id}`}>Active</Badge>
                    )}
                    {lqCommitment === 'superseded' && (
                      <Badge variant="secondary" className="text-xs opacity-60" data-testid={`lineage-badge-${lq.id}`}>Superseded</Badge>
                    )}
                    {lqCommitment === 'accepted' && (
                      <Badge variant="approved" className="text-xs" data-testid={`lineage-badge-${lq.id}`}>Accepted</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground" data-testid="no-lineage">
              No other versions
            </div>
          )}
        </div>

        {editMode && !quote.scopeId && (
          <Card className="border-subtle" data-testid="card-scope-coverage">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium uppercase tracking-wider">Scope Assignment</span>
                <Badge variant="outline" className="text-xs border-subtle">Unassigned</Badge>
              </div>
              <p className="text-sm text-muted italic mt-2">
                This quote is not linked to any scope.
              </p>
            </CardContent>
          </Card>
        )}

        {editMode && selectedVersion && (
          <div className="flex items-center justify-between text-xs text-muted px-1" data-testid="version-info-compact">
            <div className="flex items-center gap-3">
              <span>v{selectedVersion.versionNumber}</span>
              {selectedVersion.extractionStatus === 'verified' && (
                <Badge variant="approved" className="text-xs">Verified</Badge>
              )}
              {selectedVersion.extractionStatus === 'draft' && (
                <Badge variant="draft" className="text-xs">Draft</Badge>
              )}
              {selectedVersion.commitmentStatus === 'accepted' && (
                <Badge variant="outline" className="text-xs">Accepted</Badge>
              )}
            </div>
            {selectedVersion.validUntil && (
              <span>Valid until {selectedVersion.validUntil}</span>
            )}
          </div>
        )}
      </div>

      {editMode && showAIPanel && selectedVersion && (
        <QuoteAIPanel
          projectId={projectId}
          quote={quote}
          selectedVersion={selectedVersion}
          extractedData={extractedData}
          vendorName={vendor?.name ?? 'Unknown'}
          formatCurrency={formatCurrency}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  );
}
