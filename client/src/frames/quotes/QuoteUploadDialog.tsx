/**
 * RENIX vNext — Quote Upload Dialog
 * 
 * Canon v1.4 Compliant — Document Backbone Model
 * 
 * CORE TRUTH: A quote enters RENIX as a DOCUMENT, not as a form.
 * The user can UPLOAD a new document OR SELECT an existing document.
 * 
 * Flow:
 * 1. User uploads a new file OR selects an existing document
 * 2. System IMMEDIATELY creates SourceDocument, Quote, QuoteVersion v1
 * 3. Extraction starts automatically
 * 4. Dialog closes and Quote Workspace opens
 * 
 * Document Backbone Model:
 * - Documents persist independently of quotes
 * - Documents can be reused across multiple scopes
 * - Selecting an existing document reuses the file, creates new quote structure
 */

import { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, AlertCircle, FolderOpen, Check } from 'lucide-react';
import { RenixSpinner, RenixLoader } from '@/components/RenixLoader';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUpload } from '@/hooks/use-upload';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/api';

interface DocumentAsset {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  title: string;
  uploadedAt: string;
  fileDataUrl: string | null;
}

interface QuoteUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onQuoteCreated: (quoteId: string, versionId: string) => void;
}

interface CreateQuoteFromUploadResponse {
  quote: {
    id: string;
    reference: string;
    vendorId: string | null;
  };
  version: {
    id: string;
    versionNumber: number;
  };
  sourceDocument: {
    id: string;
    fileName: string;
    fileType: string;
  };
}

export function QuoteUploadDialog({
  open,
  onOpenChange,
  projectId,
  onQuoteCreated,
}: QuoteUploadDialogProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'select'>('upload');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Fetch existing documents for selection
  const { data: documentsData } = useQuery<{ documents: DocumentAsset[] }>({
    queryKey: queryKeys.documents(projectId),
    enabled: open && !!projectId,
  });

  // Filter to quote-compatible documents (PDFs, images, spreadsheets, docs)
  const selectableDocuments = useMemo(() => {
    if (!documentsData?.documents) return [];
    return documentsData.documents.filter(doc => {
      const ext = doc.fileName.toLowerCase().split('.').pop() || '';
      return ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext);
    });
  }, [documentsData]);

  const { uploadFile, isUploading, progress } = useUpload({
    projectId,
    purpose: 'quote',
    onSuccess: async (response) => {
      setIsCreating(true);
      setError(null);
      
      try {
        if (!response.uploadToken) {
          throw new Error('Upload token missing - authentication may have failed');
        }
        
        const res = await apiRequest(
          'POST',
          `/api/projects/${projectId}/quotes/from-upload`,
          {
            uploadToken: response.uploadToken,
            fileName: response.metadata.name,
            fileType: response.metadata.contentType,
          }
        );
        
        const result = await res.json() as CreateQuoteFromUploadResponse;
        
        // Invalidate quotes data to ensure fresh data before opening workspace
        await queryClient.invalidateQueries({ queryKey: queryKeys.quotes(projectId) });
        
        onQuoteCreated(result.quote.id, result.version.id);
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create quote from upload');
      } finally {
        setIsCreating(false);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    await uploadFile(file);
  }, [uploadFile]);

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

  // Handle selecting an existing document
  const handleSelectExistingDocument = useCallback(async () => {
    if (!selectedDocId) return;
    
    const selectedDoc = selectableDocuments.find(d => d.id === selectedDocId);
    if (!selectedDoc) return;
    
    setError(null);
    setIsCreating(true);
    
    try {
      const res = await apiRequest(
        'POST',
        `/api/projects/${projectId}/quotes/from-existing-document`,
        {
          documentId: selectedDocId,
        }
      );
      
      // Handle error responses from the server
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errorData.message || `Server error: ${res.status}`);
      }
      
      const result = await res.json() as CreateQuoteFromUploadResponse;
      
      // Invalidate both quotes and documents caches to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) }),
      ]);
      
      onQuoteCreated(result.quote.id, result.version.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote from document');
    } finally {
      setIsCreating(false);
    }
  }, [selectedDocId, selectableDocuments, projectId, onQuoteCreated, onOpenChange]);

  const isProcessing = isUploading || isCreating;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="quote-upload-dialog">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>
            Upload a new quote document or select an existing document from your project.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'select')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" data-testid="tab-upload-new">
              <Upload className="w-4 h-4 mr-2" />
              Upload New
            </TabsTrigger>
            <TabsTrigger value="select" data-testid="tab-select-existing">
              <FolderOpen className="w-4 h-4 mr-2" />
              Select Existing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragOver 
                  ? 'border-foreground bg-muted/50' 
                  : 'border-subtle hover:border-foreground/50'
                }
                ${isProcessing ? 'pointer-events-none opacity-60' : ''}
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              data-testid="quote-upload-dropzone"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <RenixLoader size="lg" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {isUploading ? `Uploading... ${progress}%` : 'Creating quote...'}
                    </p>
                    <p className="text-xs text-muted">
                      {isUploading 
                        ? 'Uploading document to storage' 
                        : 'Extracting quote data from document'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <FileText className="w-12 h-12 text-muted" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Drop quote document here
                    </p>
                    <p className="text-xs text-muted">
                      PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, CSV
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
                      onChange={handleInputChange}
                      disabled={isProcessing}
                      data-testid="input-quote-file"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-subtle pointer-events-none"
                      disabled={isProcessing}
                      data-testid="button-select-file"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Select File
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="select" className="mt-4">
            {selectableDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents available</p>
                <p className="text-xs">Upload a document to the Documents frame first, or use the Upload New tab.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {selectableDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        disabled={isProcessing}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors
                          ${selectedDocId === doc.id 
                            ? 'bg-primary/10 border border-primary' 
                            : 'hover:bg-muted border border-transparent'
                          }
                          ${isProcessing ? 'opacity-60 pointer-events-none' : ''}
                        `}
                        data-testid={`document-option-${doc.id}`}
                      >
                        <FileText className="w-5 h-5 flex-shrink-0 text-muted" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title || doc.fileName}</p>
                          <p className="text-xs text-muted truncate">
                            {doc.fileName} · {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                        {selectedDocId === doc.id && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  onClick={handleSelectExistingDocument}
                  disabled={!selectedDocId || isProcessing}
                  className="w-full"
                  data-testid="button-use-selected-document"
                >
                  {isProcessing ? (
                    <>
                      <RenixSpinner className="mr-2" />
                      Creating quote...
                    </>
                  ) : (
                    'Use Selected Document'
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div 
            className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
            data-testid="quote-upload-error"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="text-xs text-muted space-y-1">
          <p>Supported formats: PDF, images (JPG, PNG), Word documents, spreadsheets</p>
          <p>Quote content will be preserved in original language (no translation)</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
