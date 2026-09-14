/**
 * RENIX vNext — Documents & Media Frame
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * The Documents & Media Frame stores project evidence and artifacts.
 * It preserves documents, images, and media as immutable records
 * that support recall, verification, and reflection.
 * 
 * Core invariants:
 * - Files are immutable originals
 * - Metadata and annotations are non-destructive
 * - Documents never mutate Scope, Budget, Quotes, Invoices, Financing, or Execution
 * - Missing documents are a valid state
 * 
 * Forbidden behavior:
 * - No file replacement or silent modification
 * - No automatic categorization or association
 * - No implication of approval or correctness
 * - No mandatory organization
 * - No AI-committed changes
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, FileText, Image, Film, File, Receipt, ClipboardList, CheckCircle2, Clock, Search, X } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { useQuery } from '@tanstack/react-query';
import { useProject } from '../../context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryKeys, scopeNodesApi } from '@/lib/api';
import { useDocumentsData, type DocumentAsset, type DocumentType, type DocumentPurpose } from './useDocumentsData';
import { DocumentListRow } from './DocumentListRow';
import {
  UploadDialog,
  EditDetailsDialog,
  DetailsDialog,
  DeleteConfirmDialog,
  DuplicateDialog,
  type DuplicateInfo,
} from './DocumentDialogs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DocumentsSkeleton } from '@/components/FrameSkeleton';

type ProcessingStatus = 'all' | 'processed' | 'extracting' | 'unprocessed';

type DialogState =
  | { type: 'none' }
  | { type: 'upload' }
  | { type: 'edit-details'; document: DocumentAsset }
  | { type: 'view-details'; document: DocumentAsset }
  | { type: 'delete'; document: DocumentAsset }
  | { type: 'duplicate'; duplicateInfo: DuplicateInfo; pendingFile: File; pendingTitle?: string; pendingDescription?: string; pendingDocumentType?: DocumentType };

function getProcessingStatus(doc: DocumentAsset): Exclude<ProcessingStatus, 'all'> {
  if (doc.summary && doc.extractedText) return 'processed';
  if (doc.extractedText && !doc.summary) return 'extracting';
  return 'unprocessed';
}

async function generateChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const PURPOSE_ICONS: Record<DocumentPurpose, typeof FileText> = {
  quote: ClipboardList,
  invoice: Receipt,
  document: FileText,
  image: Image,
  media: Film,
  other: File,
};

const PURPOSE_LABELS: Record<DocumentPurpose, string> = {
  quote: 'Quotes',
  invoice: 'Invoices',
  document: 'Documents',
  image: 'Images',
  media: 'Media',
  other: 'Other',
};

export function DocumentsFrame() {
  const { projectId, projectName, isReadOnly, highlightDocumentId, clearHighlightDocument } = useProject();
  const documentsData = useDocumentsData(projectId, isReadOnly);
  const { toast } = useToast();

  const { data: scopeNodesResponse } = useQuery({
    queryKey: queryKeys.scopeNodes(projectId),
    queryFn: () => scopeNodesApi.get(projectId),
  });

  const scopeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (scopeNodesResponse?.nodes) {
      for (const node of scopeNodesResponse.nodes) {
        map.set(node.id, node.name);
      }
    }
    return map;
  }, [scopeNodesResponse]);

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [activeTab, setActiveTab] = useState<'all' | DocumentPurpose>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 200);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);
  const [processingFilter, setProcessingFilter] = useState<ProcessingStatus>('all');

  const processingCounts = useMemo(() => {
    const counts = { processed: 0, extracting: 0, unprocessed: 0 };
    for (const doc of documentsData.documents) {
      counts[getProcessingStatus(doc)]++;
    }
    return counts;
  }, [documentsData.documents]);

  useEffect(() => {
    if (!highlightDocumentId || documentsData.isLoading) return;

    setActiveTab('all');

    let attempts = 0;
    const maxAttempts = 10;
    const tryScroll = () => {
      const el = window.document.querySelector(`[data-testid="document-row-${highlightDocumentId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);

    const timer = setTimeout(() => clearHighlightDocument(), 8000);
    return () => clearTimeout(timer);
  }, [highlightDocumentId, documentsData.isLoading, clearHighlightDocument]);

  const dialogDocument = useMemo(() => {
    if (dialog.type === 'view-details' || dialog.type === 'edit-details') {
      return documentsData.documents.find(d => d.id === dialog.document.id) ?? dialog.document;
    }
    return null;
  }, [dialog, documentsData.documents]);

  const closeDialog = () => setDialog({ type: 'none' });

  const handleUpload = async (file: File, title?: string, description?: string, documentType?: import('./useDocumentsData').DocumentType) => {
    try {
      const checksum = await generateChecksum(file);
      
      const response = await apiRequest(
        'POST',
        `/api/projects/${projectId}/documents/check-duplicate`,
        { checksum, fileName: file.name }
      );
      const duplicateCheck = await response.json() as { isDuplicate: boolean; existingDocument?: { id: string; fileName: string; uploadedAt: string } };
      
      if (duplicateCheck.isDuplicate && duplicateCheck.existingDocument) {
        setDialog({
          type: 'duplicate',
          duplicateInfo: {
            existingId: duplicateCheck.existingDocument.id,
            existingFileName: duplicateCheck.existingDocument.fileName,
            existingUploadedAt: duplicateCheck.existingDocument.uploadedAt,
            newFileName: file.name,
          },
          pendingFile: file,
          pendingTitle: title,
          pendingDescription: description,
          pendingDocumentType: documentType,
        });
        return;
      }
      
      const docId = await documentsData.uploadDocument(file, title, description, documentType);
      if (docId) {
        toast({
          title: 'Document uploaded',
          description: `"${title || file.name}" has been added to the project.`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not verify document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleKeepBoth = async () => {
    if (dialog.type !== 'duplicate') return;
    const { pendingFile, pendingTitle, pendingDescription, pendingDocumentType } = dialog;
    closeDialog();
    
    const modifiedTitle = `${pendingTitle || pendingFile.name.replace(/\.[^/.]+$/, '')} (copy)`;
    const docId = await documentsData.uploadDocument(pendingFile, modifiedTitle, pendingDescription, pendingDocumentType);
    if (docId) {
      await documentsData.addTag(docId, 'duplicate');
      toast({
        title: 'Document uploaded',
        description: `"${modifiedTitle}" has been added and tagged as duplicate.`,
      });
    }
  };

  const handleReplaceDuplicate = async () => {
    if (dialog.type !== 'duplicate') return;
    const { duplicateInfo, pendingFile, pendingTitle, pendingDescription, pendingDocumentType } = dialog;
    closeDialog();
    
    await documentsData.deleteDocument(duplicateInfo.existingId);
    const docId = await documentsData.uploadDocument(pendingFile, pendingTitle, pendingDescription, pendingDocumentType);
    if (docId) {
      toast({
        title: 'Document replaced',
        description: `"${pendingTitle || pendingFile.name}" has replaced the existing document.`,
      });
    }
  };

  const handleCancelDuplicate = () => {
    closeDialog();
    toast({
      title: 'Upload cancelled',
      description: 'The duplicate document was not uploaded.',
    });
  };

  const handleSaveMetadata = (title: string, description?: string, documentType?: DocumentType) => {
    if (dialog.type === 'edit-details') {
      documentsData.updateMetadata(dialog.document.id, title, description);
      if (documentType && documentType !== dialog.document.documentType) {
        documentsData.setDocumentType(dialog.document.id, documentType);
      }
      toast({
        title: 'Metadata updated',
        description: 'Document metadata has been saved.',
      });
    }
  };

  const handleAddTag = (tag: string) => {
    if (dialog.type === 'edit-details') {
      documentsData.addTag(dialog.document.id, tag);
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (dialog.type === 'edit-details') {
      documentsData.removeTag(dialog.document.id, tag);
    }
  };

  const handleAddAnnotation = (docId: string, content: string) => {
    documentsData.addAnnotation(docId, content);
    toast({
      title: 'Annotation added',
      description: 'Your note has been attached to the document.',
    });
  };

  const handleConfirmDelete = () => {
    if (dialog.type === 'delete') {
      const docTitle = dialog.document.title;
      documentsData.deleteDocument(dialog.document.id, () => {
        toast({
          title: 'Document deleted',
          description: `"${docTitle}" has been removed.`,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.quotes(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.scopeNodes(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.financing(projectId) });
        queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'resolved-cost-demand'] });
      });
    }
  };

  const getFilteredDocuments = (): DocumentAsset[] => {
    let docs: DocumentAsset[];
    if (activeTab === 'all') {
      docs = documentsData.documents;
    } else {
      docs = documentsData.documentsByPurpose[activeTab];
    }
    if (processingFilter !== 'all') {
      docs = docs.filter(doc => getProcessingStatus(doc) === processingFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      docs = docs.filter(doc => {
        const titleMatch = doc.title?.toLowerCase().includes(q);
        const fileNameMatch = doc.fileName?.toLowerCase().includes(q);
        const tagsMatch = doc.tags?.some(tag => tag.toLowerCase().includes(q));
        return titleMatch || fileNameMatch || tagsMatch;
      });
    }
    return docs;
  };

  const filteredDocuments = getFilteredDocuments();

  if (documentsData.isLoading) return <DocumentsSkeleton />;

  return (
    <motion.div
      className="h-full space-y-4"
      data-testid="frame-documents"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground" data-testid="text-frame-description">
          {isReadOnly ? 'Memory and evidence (read-only)' : 'Memory and evidence'}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 pr-8 w-56"
              data-testid="input-search-documents"
            />
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={clearSearch}
                data-testid="button-clear-search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => setDialog({ type: 'upload' })}
              data-testid="button-upload-document"
            >
              <Plus className="h-4 w-4 mr-1" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {!documentsData.isEmpty && (
        <div
          className="renix-surface flex items-center gap-2 px-3 py-2 rounded-md flex-wrap"
          data-testid="documents-processing-strip"
        >
          <span className="text-xs text-muted-foreground font-medium mr-1" data-testid="text-processing-label">
            Processing:
          </span>
          <Badge
            variant={processingFilter === 'all' ? 'default' : 'secondary'}
            className="cursor-pointer text-xs"
            onClick={() => setProcessingFilter('all')}
            data-testid="filter-processing-all"
          >
            All {documentsData.documents.length}
          </Badge>
          {processingCounts.processed > 0 && (
            <Badge
              variant={processingFilter === 'processed' ? 'approved' : 'secondary'}
              className="cursor-pointer text-xs"
              onClick={() => setProcessingFilter(processingFilter === 'processed' ? 'all' : 'processed')}
              data-testid="filter-processing-processed"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Processed {processingCounts.processed}
            </Badge>
          )}
          {processingCounts.extracting > 0 && (
            <Badge
              variant={processingFilter === 'extracting' ? 'pending' : 'secondary'}
              className="cursor-pointer text-xs"
              onClick={() => setProcessingFilter(processingFilter === 'extracting' ? 'all' : 'extracting')}
              data-testid="filter-processing-extracting"
            >
              <RenixSpinner className="mr-1" />
              Extracting {processingCounts.extracting}
            </Badge>
          )}
          {processingCounts.unprocessed > 0 && (
            <Badge
              variant={processingFilter === 'unprocessed' ? 'draft' : 'secondary'}
              className="cursor-pointer text-xs"
              onClick={() => setProcessingFilter(processingFilter === 'unprocessed' ? 'all' : 'unprocessed')}
              data-testid="filter-processing-unprocessed"
            >
              <Clock className="h-3 w-3 mr-1" />
              Pending {processingCounts.unprocessed}
            </Badge>
          )}
        </div>
      )}

      {documentsData.isEmpty ? (
        <Card className="border-dashed" data-testid="documents-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 mb-4 text-secondary" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No documents yet
            </h3>
            <p className="text-sm text-center max-w-md mb-6 text-secondary">
              {isReadOnly
                ? 'This project has no documents or media recorded.'
                : 'Documents are the source of truth for your project. Upload quotes, invoices, contracts, or plans — AI will extract and classify the data automatically.'}
            </p>
            {!isReadOnly && (
              <Button
                onClick={() => setDialog({ type: 'upload' })}
                data-testid="button-empty-upload"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                All ({documentsData.documents.length})
              </TabsTrigger>
              {(['quote', 'invoice', 'document', 'image', 'media', 'other'] as DocumentPurpose[]).map(purpose => {
                const count = documentsData.purposeCounts[purpose];
                if (count === 0) return null;
                const Icon = PURPOSE_ICONS[purpose];
                return (
                  <TabsTrigger key={purpose} value={purpose} data-testid={`tab-${purpose}`}>
                    <Icon className="h-4 w-4 mr-1" />
                    {PURPOSE_LABELS[purpose]} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredDocuments.length === 0 ? (
                <p className="text-sm text-center py-8 text-secondary" data-testid="text-no-filtered-results">
                  {debouncedSearch.trim()
                    ? `No documents matching "${debouncedSearch.trim()}".`
                    : processingFilter !== 'all'
                      ? `No documents matching "${processingFilter}" status in this category.`
                      : 'No items in this category.'}
                </p>
              ) : (
                <Card className="overflow-hidden">
                  <div className="divide-y divide-border/50">
                    {filteredDocuments.map(doc => (
                      <DocumentListRow
                        key={doc.id}
                        document={doc}
                        isReadOnly={isReadOnly}
                        scopeNameMap={scopeNameMap}
                        isHighlighted={highlightDocumentId === doc.id}
                        onEditDetails={() => setDialog({ type: 'edit-details', document: doc })}
                        onViewDetails={() => setDialog({ type: 'view-details', document: doc })}
                        onDelete={() => setDialog({ type: 'delete', document: doc })}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <UploadDialog
        open={dialog.type === 'upload'}
        onOpenChange={(open) => !open && closeDialog()}
        onUpload={handleUpload}
      />

      <EditDetailsDialog
        open={dialog.type === 'edit-details'}
        onOpenChange={(open) => !open && closeDialog()}
        document={dialog.type === 'edit-details' ? dialogDocument : null}
        onSave={handleSaveMetadata}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <DetailsDialog
        open={dialog.type === 'view-details'}
        onOpenChange={(open) => !open && closeDialog()}
        document={dialog.type === 'view-details' ? dialogDocument : null}
        scopeNameMap={scopeNameMap}
        isReadOnly={isReadOnly}
        onEditDetails={() => {
          if (dialog.type === 'view-details' && dialogDocument) {
            setDialog({ type: 'edit-details', document: dialogDocument });
          }
        }}
        onAddAnnotation={(content) => {
          if (dialog.type === 'view-details' && dialogDocument) {
            handleAddAnnotation(dialogDocument.id, content);
          }
        }}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete'}
        onOpenChange={(open) => !open && closeDialog()}
        documentTitle={dialog.type === 'delete' ? dialog.document.title : ''}
        documentId={dialog.type === 'delete' ? dialog.document.id : undefined}
        projectId={projectId}
        onConfirm={handleConfirmDelete}
      />

      <DuplicateDialog
        open={dialog.type === 'duplicate'}
        onOpenChange={(open) => !open && closeDialog()}
        duplicateInfo={dialog.type === 'duplicate' ? dialog.duplicateInfo : null}
        onKeepBoth={handleKeepBoth}
        onReplace={handleReplaceDuplicate}
        onCancel={handleCancelDuplicate}
      />
    </motion.div>
  );
}

export default DocumentsFrame;
