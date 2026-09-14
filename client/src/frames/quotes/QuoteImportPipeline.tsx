/**
 * RENIX vNext — Quote Import Pipeline
 * 
 * MANDATORY MODAL for quote import workflow.
 * Enforces linear flow: uploading → extracting → reviewing → allocating → completed
 * User CANNOT return to scope view until pipeline is completed or cancelled.
 * 
 * State Machine:
 * - uploading: File upload UI
 * - extracting: Loading spinner with polling
 * - reviewing: ExtractionReviewScreen overlay
 * - allocating: Allocation confirmation
 * - completed/cancelled: Parent handles dismissal
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryKeys } from '@/lib/api';
import { getAuthHeaders } from '@/auth/AuthContext';
import { ExtractionReviewScreen, type AcceptedExtractedData, type ExtractedQuoteData } from './ExtractionReviewScreen';
import { AllocationDialog } from './AllocationDialog';
import { X, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { RenixSpinner, RenixLoader } from '@/components/RenixLoader';
import { Button } from '@/components/ui/button';
import { useUpload } from '@/hooks/use-upload';
import { useFormatters } from '@/context/ProjectContext';
import type { Vendor } from './useQuotesData';

export interface QuoteImportSession {
  id: string;
  projectId: string;
  scopeId: string;
  userId: string;
  documentId: string | null;
  quoteVersionId: string | null;
  state: 'uploading' | 'extracting' | 'reviewing' | 'allocating' | 'completed' | 'cancelled';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteImportPipelineProps {
  projectId: string;
  scopeId: string;
  scopeName: string;
  session: QuoteImportSession;
  vendors: Vendor[];
  projectCurrency?: string;
  onComplete: () => void;
}

interface ExtractionStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData?: ExtractedQuoteData;
  error?: string;
}

const STEP_LABELS: Record<QuoteImportSession['state'], { step: number; label: string }> = {
  uploading: { step: 1, label: 'Upload Quote' },
  extracting: { step: 2, label: 'Extracting Data' },
  reviewing: { step: 3, label: 'Review & Edit' },
  allocating: { step: 4, label: 'Allocate to Scope' },
  completed: { step: 4, label: 'Complete' },
  cancelled: { step: 0, label: 'Cancelled' },
};

export function QuoteImportPipeline({
  projectId,
  scopeId,
  scopeName,
  session,
  vendors,
  projectCurrency = 'EUR',
  onComplete,
}: QuoteImportPipelineProps) {
  const queryClient = useQueryClient();
  const { formatCurrency } = useFormatters();
  
  // Use a ref for session ID to ensure mutations always use the current session
  const sessionIdRef = useRef(session.id);
  sessionIdRef.current = session.id;
  
  const [currentState, setCurrentState] = useState<QuoteImportSession['state']>(session.state);
  const [documentId, setDocumentId] = useState<string | null>(session.documentId);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedQuoteData | null>(null);
  const [acceptedData, setAcceptedData] = useState<AcceptedExtractedData | null>(null);
  const [error, setError] = useState<string | null>(session.errorMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractionTimedOut, setExtractionTimedOut] = useState(false);
  const pollAttemptRef = useRef(0);

  const { uploadFile, isUploading, progress } = useUpload({
    projectId,
    purpose: 'quote-import',
    onSuccess: async (response) => {
      if (response.uploadToken) {
        try {
          const res = await apiRequest(
            'POST',
            `/api/projects/${projectId}/documents`,
            {
              uploadToken: response.uploadToken,
              fileName: response.metadata.name,
              fileSize: response.metadata.size,
              mimeType: response.metadata.contentType,
              documentType: 'quote',
              title: response.metadata.name,
              fileDataUrl: response.objectPath,
            }
          );
          const doc = await res.json();
          setDocumentId(doc.id);
          setDocumentUrl(doc.fileDataUrl || response.objectPath || null);
          await transitionToExtracting(doc.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create document');
        }
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: { state: QuoteImportSession['state']; documentId?: string; errorMessage?: string }) => {
      // Use ref to get current session ID (avoids stale closure issues)
      const res = await apiRequest(
        'PATCH',
        `/api/projects/${projectId}/import-sessions/${sessionIdRef.current}`,
        updates
      );
      return res.json();
    },
  });

  const startExtractionMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await apiRequest(
        'POST',
        `/api/projects/${projectId}/documents/${docId}/extract`,
        {}
      );
      return res.json();
    },
  });

  const { data: extractionStatus, refetch: refetchExtraction } = useQuery<ExtractionStatus>({
    queryKey: ['extraction-status', projectId, documentId],
    queryFn: async () => {
      if (!documentId) throw new Error('No document ID');
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/extraction`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch extraction status');
      return res.json();
    },
    enabled: currentState === 'extracting' && !!documentId && !extractionTimedOut && !error,
    refetchInterval: currentState === 'extracting' && !extractionTimedOut && !error ? 2000 : false,
  });

  const hasReTriggeredRef = useRef(false);
  const hasFetchedReviewDataRef = useRef(false);
  
  // Sync local state when session prop changes (e.g., new session created)
  useEffect(() => {
    if (session.id !== sessionIdRef.current) {
      // Session changed - reset to new session's state
      sessionIdRef.current = session.id;
      setCurrentState(session.state);
      setDocumentId(session.documentId);
      setError(session.errorMessage);
      setExtractedData(null);
      setAcceptedData(null);
      setExtractionTimedOut(false);
      pollAttemptRef.current = 0;
      hasReTriggeredRef.current = false;
      hasFetchedReviewDataRef.current = false;
    }
  }, [session.id, session.state, session.documentId, session.errorMessage]);
  
  useEffect(() => {
    if (currentState === 'extracting' && extractionStatus && documentId) {
      pollAttemptRef.current += 1;
      
      if (extractionStatus.status === 'completed' && extractionStatus.extractedData) {
        setExtractedData(extractionStatus.extractedData);
        pollAttemptRef.current = 0;
        transitionToReviewing();
        hasReTriggeredRef.current = false;
      } else if (extractionStatus.status === 'failed') {
        setError(extractionStatus.error || 'Extraction failed. You can retry or cancel.');
        pollAttemptRef.current = 0;
        hasReTriggeredRef.current = false;
      } else if (extractionStatus.status === 'pending' && !hasReTriggeredRef.current) {
        hasReTriggeredRef.current = true;
        startExtractionMutation.mutate(documentId);
      }
      
      if (pollAttemptRef.current >= 30 && (extractionStatus.status === 'pending' || extractionStatus.status === 'processing')) {
        setExtractionTimedOut(true);
        setError('Extraction is taking longer than expected. You can retry or cancel.');
        pollAttemptRef.current = 0;
      }
    }
  }, [currentState, extractionStatus, documentId]);

  // Resume 'reviewing' state: fetch extraction data if not already loaded
  useEffect(() => {
    if (currentState === 'reviewing' && !extractedData && documentId && !hasFetchedReviewDataRef.current) {
      hasFetchedReviewDataRef.current = true;
      (async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/extraction`, {
            credentials: 'include',
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'completed' && data.extractedData) {
              setExtractedData(data.extractedData);
              // Also set the document URL if available
              const docRes = await fetch(`/api/projects/${projectId}/documents/${documentId}`, {
                credentials: 'include',
                headers: getAuthHeaders(),
              });
              if (docRes.ok) {
                const doc = await docRes.json();
                setDocumentUrl(doc.fileDataUrl || null);
              }
            } else if (data.status === 'pending' || data.status === 'processing') {
              // Extraction not complete, switch back to extracting state
              setCurrentState('extracting');
              hasFetchedReviewDataRef.current = false;
            } else if (data.status === 'failed') {
              setError(data.error || 'Extraction failed');
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load extraction data');
        }
      })();
    }
  }, [currentState, extractedData, documentId, projectId]);

  const transitionToExtracting = useCallback(async (docId: string) => {
    try {
      await updateSessionMutation.mutateAsync({ state: 'extracting', documentId: docId });
      setCurrentState('extracting');
      await startExtractionMutation.mutateAsync(docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start extraction');
    }
  }, [updateSessionMutation, startExtractionMutation]);

  const transitionToReviewing = useCallback(async () => {
    try {
      await updateSessionMutation.mutateAsync({ state: 'reviewing' });
      setCurrentState('reviewing');
    } catch (err) {
      console.error('[QuoteImportPipeline] transitionToReviewing failed:', err);
      setCurrentState('reviewing');
      setError(null);
    }
  }, [updateSessionMutation]);

  const transitionToAllocating = useCallback(async (data: AcceptedExtractedData) => {
    try {
      setAcceptedData(data);
      await updateSessionMutation.mutateAsync({ state: 'allocating' });
      setCurrentState('allocating');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transition to allocating');
    }
  }, [updateSessionMutation]);

  const completeAllocation = useCallback(async (selectedRowIds?: string[]) => {
    if (!acceptedData) return;
    
    try {
      const response = await apiRequest(
        'POST',
        `/api/projects/${projectId}/scopes/${scopeId}/allocate-quote`,
        {
          sessionId: sessionIdRef.current,
          acceptedData,
          selectedRowIds: selectedRowIds || null,
        }
      );
      
      const result = await response.json();
      
      if (!result.success || !result.quoteVersionId) {
        throw new Error(result.message || 'Allocation failed — no quote version was created. Please retry.');
      }
      
      try {
        await updateSessionMutation.mutateAsync({ state: 'completed' });
      } catch (sessionErr) {
        console.error('[QuoteImportPipeline] Session update to completed failed, proceeding anyway:', sessionErr);
      }
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes(projectId) }),
        queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'scope-references'] }),
      ]);
      
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete allocation');
    }
  }, [acceptedData, projectId, scopeId, updateSessionMutation, queryClient, onComplete]);

  const handleCancel = useCallback(async () => {
    try {
      if (documentId) {
        try {
          await apiRequest('DELETE', `/api/projects/${projectId}/documents/${documentId}`);
        } catch (cleanupErr) {
          console.error('[QuoteImportPipeline] Document cleanup failed:', cleanupErr);
        }
      }
      
      await updateSessionMutation.mutateAsync({ state: 'cancelled' });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
      onComplete();
    }
  }, [documentId, projectId, updateSessionMutation, onComplete]);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    await uploadFile(file);
  }, [uploadFile]);

  const handleRetryExtraction = useCallback(async () => {
    if (!documentId) return;
    setError(null);
    setExtractionTimedOut(false);
    pollAttemptRef.current = 0;
    hasReTriggeredRef.current = false;
    try {
      await startExtractionMutation.mutateAsync(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry extraction');
    }
  }, [documentId, startExtractionMutation]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleAcceptReview = useCallback((data: AcceptedExtractedData) => {
    transitionToAllocating(data);
  }, [transitionToAllocating]);

  const handleCancelReview = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  const stepInfo = STEP_LABELS[currentState];
  const isProcessing = isUploading || updateSessionMutation.isPending || startExtractionMutation.isPending;

  const renderUploadingScreen = () => (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <FileText className="w-12 h-12 mx-auto text-muted" />
          <h2 className="text-xl font-semibold">Upload Quote Document</h2>
          <p className="text-sm text-muted">
            Upload a PDF, image, or spreadsheet containing the quote for {scopeName}
          </p>
        </div>

        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragOver ? 'border-foreground bg-muted/50' : 'border-subtle hover:border-foreground/50'}
            ${isProcessing ? 'pointer-events-none opacity-50' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="upload-dropzone"
        >
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
            onChange={handleInputChange}
            className="hidden"
            id="quote-file-input"
            disabled={isProcessing}
            data-testid="input-file"
          />
          <label
            htmlFor="quote-file-input"
            className="flex flex-col items-center gap-3 cursor-pointer"
          >
            {isUploading ? (
              <>
                <RenixLoader size="md" />
                <span className="text-sm">Uploading... {progress}%</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted" />
                <span className="text-sm">
                  Drag and drop a file here, or click to browse
                </span>
                <span className="text-xs text-muted">
                  PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, CSV (max 10MB)
                </span>
              </>
            )}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive" data-testid="upload-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderExtractingScreen = () => (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center space-y-4">
        {!error ? (
          <>
            <RenixLoader size="lg" className="mx-auto" />
            <h2 className="text-xl font-semibold">Extracting Quote Data...</h2>
            <p className="text-sm text-muted max-w-sm">
              Analyzing the document and extracting line items, pricing, and vendor information.
              This may take a moment.
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Extraction Issue</h2>
          </>
        )}
      </div>

      {error && (
        <div className="mt-6 max-w-sm space-y-4">
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive" data-testid="extraction-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex justify-center gap-3">
            <Button
              variant="default"
              onClick={handleRetryExtraction}
              disabled={startExtractionMutation.isPending}
              data-testid="button-retry-extraction"
            >
              {startExtractionMutation.isPending ? (
                <RenixSpinner className="mr-2" />
              ) : null}
              Retry Extraction
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={updateSessionMutation.isPending}
              data-testid="button-cancel-extraction"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewingScreen = () => {
    if (!extractedData || !documentId) {
      return (
        <div className="flex items-center justify-center h-full">
          <RenixLoader size="md" />
        </div>
      );
    }

    return (
      <ExtractionReviewScreen
        projectId={projectId}
        scopeId={scopeId}
        documentId={documentId}
        documentUrl={documentUrl || ''}
        extractedData={extractedData}
        vendors={vendors}
        projectCurrency={projectCurrency}
        onAccept={handleAcceptReview}
        onCancel={handleCancelReview}
      />
    );
  };

  const renderAllocatingScreen = () => {
    if (!acceptedData) {
      return (
        <div className="flex items-center justify-center h-full">
          <RenixLoader size="md" />
        </div>
      );
    }

    return (
      <AllocationDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
        scopeName={scopeName}
        tree={acceptedData.tree}
        formatCurrency={formatCurrency}
        onAllocateAll={() => completeAllocation()}
        onAllocateSelected={(selectedRowIds) => completeAllocation(selectedRowIds)}
        isProcessing={updateSessionMutation.isPending}
      />
    );
  };

  const renderContent = () => {
    switch (currentState) {
      case 'uploading':
        return renderUploadingScreen();
      case 'extracting':
        return renderExtractingScreen();
      case 'reviewing':
        return renderReviewingScreen();
      case 'allocating':
        return renderAllocatingScreen();
      default:
        return null;
    }
  };

  if (currentState === 'reviewing') {
    return (
      <div 
        className="fixed inset-0 z-50 bg-background"
        data-testid="quote-import-pipeline"
      >
        {renderReviewingScreen()}
      </div>
    );
  }

  if (currentState === 'allocating') {
    return (
      <div data-testid="quote-import-pipeline">
        {renderAllocatingScreen()}
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
      data-testid="quote-import-pipeline"
    >
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Import Quote</h1>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="px-2 py-0.5 bg-muted/30 rounded text-xs font-medium">
                Step {stepInfo.step} of 4
              </span>
              <span>{stepInfo.label}</span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isProcessing}
            data-testid="button-cancel-pipeline"
          >
            <X className="w-5 h-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
