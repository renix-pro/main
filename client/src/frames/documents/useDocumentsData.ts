/**
 * RENIX vNext — Documents & Media Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Manages project documents and media as immutable evidence artifacts.
 * 
 * Core invariants:
 * - Files are immutable originals (no replacement or modification)
 * - Metadata and annotations are non-destructive (append-only)
 * - Documents never mutate Scope, Budget, Quotes, Invoices, Financing, or Execution
 * - Missing documents are a valid state
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { deriveDocumentPurpose, type DocumentPurpose } from './utils';
import { useToast } from '@/hooks/use-toast';

export type DocumentType = 'document' | 'image' | 'media' | 'other';
export type { DocumentPurpose } from './utils';

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  content: string;
  createdAt: number;
  createdBy: string;
}

export interface MetadataRevision {
  id: string;
  field: 'title' | 'description';
  previousValue: string | null;
  newValue: string | null;
  changedAt: number;
  changedBy: string;
}

export interface DocumentAssociation {
  id: string;
  documentId: string;
  type: 'scope' | 'quote' | 'invoice' | 'execution';
  entityId: string;
  entityLabel: string;
  vendorName?: string | null;
}

export interface DocumentAsset {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  title: string;
  description: string | null;
  tags: string[];
  associations: DocumentAssociation[];
  annotations: DocumentAnnotation[];
  metadataRevisions: MetadataRevision[];
  uploadedAt: number;
  uploadedBy: string;
  fileDataUrl: string | null;
  summary: string | null;
  extractedText: string | null;
}

export interface DocumentLogEntry {
  id: string;
  documentId: string;
  action: 'uploaded' | 'metadata_updated' | 'tag_added' | 'tag_removed' | 'annotation_added' | 'association_added' | 'association_removed' | 'deleted';
  previousValue: string | null;
  newValue: string | null;
  timestamp: number;
  actor: string;
}

export interface DocumentsData {
  documents: DocumentAsset[];
  log: DocumentLogEntry[];
}

interface DocumentResponse {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  title: string;
  description: string | null;
  tags: string[];
  uploadedAt: string;
  uploadedBy: string;
  fileDataUrl: string | null;
  summary: string | null;
  extractedText: string | null;
}

interface AnnotationResponse {
  id: string;
  documentId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

interface AssociationResponse {
  id: string;
  documentId: string;
  type?: 'scope' | 'quote' | 'invoice' | 'execution';
  associationType?: string;
  entityId: string;
  entityLabel: string;
  vendorName?: string | null;
}

interface DocumentsResponse {
  documents: DocumentResponse[];
  annotations: Record<string, AnnotationResponse[]> | AnnotationResponse[];
  associations: Record<string, AssociationResponse[]> | AssociationResponse[];
}

function toDocumentsData(response: DocumentsResponse): DocumentsData {
  // Handle both object-keyed and array formats for annotations/associations
  const getAnnotationsForDoc = (docId: string): AnnotationResponse[] => {
    if (!response.annotations) return [];
    if (Array.isArray(response.annotations)) {
      return response.annotations.filter(a => a.documentId === docId);
    }
    // Object keyed by document ID
    return (response.annotations as Record<string, AnnotationResponse[]>)[docId] || [];
  };

  const getAssociationsForDoc = (docId: string): AssociationResponse[] => {
    if (!response.associations) return [];
    if (Array.isArray(response.associations)) {
      return response.associations.filter(a => a.documentId === docId);
    }
    return (response.associations as Record<string, AssociationResponse[]>)[docId] || [];
  };

  const normalizeAssociation = (a: AssociationResponse): DocumentAssociation => ({
    id: a.id,
    documentId: a.documentId,
    type: (a.type || a.associationType || 'other') as DocumentAssociation['type'],
    entityId: a.entityId,
    entityLabel: a.entityLabel,
    vendorName: a.vendorName || null,
  });

  return {
    documents: (response.documents || []).map(doc => ({
      ...doc,
      annotations: getAnnotationsForDoc(doc.id).map(a => ({
        ...a,
        createdAt: new Date(a.createdAt).getTime(),
      })),
      associations: getAssociationsForDoc(doc.id).map(normalizeAssociation),
      metadataRevisions: [],
      uploadedAt: new Date(doc.uploadedAt).getTime(),
    })),
    log: [],
  };
}

interface UseDocumentsDataReturn {
  data: DocumentsData;
  documents: DocumentAsset[];
  isEmpty: boolean;
  isLoading: boolean;
  error: Error | null;
  documentsByType: Record<DocumentType, DocumentAsset[]>;
  counts: Record<DocumentType, number>;
  documentsByPurpose: Record<DocumentPurpose, DocumentAsset[]>;
  purposeCounts: Record<DocumentPurpose, number>;
  uploadDocument: (file: File, title?: string, description?: string, documentType?: DocumentType) => Promise<string | undefined>;
  updateMetadata: (documentId: string, title: string, description?: string) => void;
  setDocumentType: (documentId: string, documentType: DocumentType) => void;
  addTag: (documentId: string, tag: string) => void;
  removeTag: (documentId: string, tag: string) => void;
  addAnnotation: (documentId: string, content: string) => void;
  addAssociation: (documentId: string, association: Omit<DocumentAssociation, 'id' | 'documentId'>) => void;
  removeAssociation: (documentId: string, associationType: string, entityId: string) => void;
  deleteDocument: (documentId: string, onSuccess?: () => void) => void;
  getDocumentById: (documentId: string) => DocumentAsset | undefined;
}

export function useDocumentsData(projectId: string, isReadOnly: boolean): UseDocumentsDataReturn {
  const { toast } = useToast();
  const { data: apiData, isLoading, error } = useQuery<DocumentsResponse>({
    queryKey: queryKeys.documents(projectId),
    enabled: !!projectId,
  });

  const data: DocumentsData = useMemo(() => {
    if (!apiData) return { documents: [], log: [] };
    return toDocumentsData(apiData);
  }, [apiData]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('[Documents] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const invalidateDocuments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
  }, [projectId]);

  type UploadDocumentVars = { file: File; title?: string; description?: string; documentType?: DocumentType };
  type UpdateMetadataVars = { documentId: string; title: string; description?: string };
  type SetDocumentTypeVars = { documentId: string; documentType: DocumentType };
  type AddTagVars = { documentId: string; tag: string };
  type RemoveTagVars = { documentId: string; tag: string };
  type AddAnnotationVars = { documentId: string; content: string };
  type AddAssociationVars = { documentId: string; association: Omit<DocumentAssociation, 'id' | 'documentId'> };
  type RemoveAssociationVars = { documentId: string; associationType: string; entityId: string };

  const uploadDocumentMutation = useMutationWithProposal({
    mutationFn: async ({ file, title, description, documentType }: UploadDocumentVars) => {
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await apiRequest('POST', `/api/projects/${projectId}/documents`, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType: documentType ?? 'other',
        title: title || file.name,
        description: description ?? null,
        fileDataUrl,
        checksum,
      });
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<UploadDocumentVars>({
      category: 'documents',
      entityType: 'document',
      action: 'create',
      getTitle: (vars) => `Upload Document: ${vars.title || vars.file.name}`,
      getDescription: (vars) => 
        vars.description 
          ? `Upload "${vars.title || vars.file.name}" (${vars.documentType || 'other'}): ${vars.description}`
          : `Upload document "${vars.title || vars.file.name}" as ${vars.documentType || 'other'}`,
    }),
  });

  const updateMetadataMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, title, description }: UpdateMetadataVars) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/documents/${documentId}`, {
        title,
        description: description ?? null,
      });
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<UpdateMetadataVars>({
      category: 'documents',
      entityType: 'document',
      action: 'update',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Update Document: ${vars.title}`,
      getDescription: (vars) => 
        vars.description 
          ? `Update document title to "${vars.title}" with description: ${vars.description}`
          : `Update document title to "${vars.title}"`,
    }),
  });

  const setDocumentTypeMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, documentType }: SetDocumentTypeVars) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/documents/${documentId}`, { documentType });
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<SetDocumentTypeVars>({
      category: 'documents',
      entityType: 'document',
      action: 'update',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Change Document Type: ${vars.documentType}`,
      getDescription: (vars) => `Change document type to "${vars.documentType}"`,
    }),
  });

  const addTagMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, tag }: AddTagVars) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/documents/${documentId}/tags`, { tag: tag.trim().toLowerCase() });
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<AddTagVars>({
      category: 'documents',
      entityType: 'tag',
      action: 'create',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Add Tag: ${vars.tag}`,
      getDescription: (vars) => `Add tag "${vars.tag}" to document`,
    }),
  });

  const removeTagMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, tag }: RemoveTagVars) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/documents/${documentId}/tags/${encodeURIComponent(tag)}`);
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<RemoveTagVars>({
      category: 'documents',
      entityType: 'tag',
      action: 'delete',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Remove Tag: ${vars.tag}`,
      getDescription: (vars) => `Remove tag "${vars.tag}" from document`,
    }),
  });

  const addAnnotationMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, content }: AddAnnotationVars) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/documents/${documentId}/annotations`, { content: content.trim() });
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<AddAnnotationVars>({
      category: 'documents',
      entityType: 'annotation',
      action: 'create',
      getEntityId: (vars) => vars.documentId,
      getTitle: () => 'Add Annotation',
      getDescription: (vars) => `Add annotation: "${vars.content.substring(0, 50)}${vars.content.length > 50 ? '...' : ''}"`,
    }),
  });

  const addAssociationMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, association }: AddAssociationVars) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/documents/${documentId}/associations`, association);
      return res.json();
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<AddAssociationVars>({
      category: 'documents',
      entityType: 'association',
      action: 'create',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Link Document to ${vars.association.type}`,
      getDescription: (vars) => `Associate document with ${vars.association.type}: ${vars.association.entityLabel}`,
    }),
  });

  const removeAssociationMutation = useMutationWithProposal({
    mutationFn: async ({ documentId, associationType, entityId }: RemoveAssociationVars) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/documents/${documentId}/associations/${associationType}/${entityId}`);
    },
    onSuccess: invalidateDocuments,
    proposalConfig: createProposalConfig<RemoveAssociationVars>({
      category: 'documents',
      entityType: 'association',
      action: 'delete',
      getEntityId: (vars) => vars.documentId,
      getTitle: (vars) => `Unlink Document from ${vars.associationType}`,
      getDescription: (vars) => `Remove association with ${vars.associationType} (${vars.entityId})`,
    }),
  });

  type DeleteDocumentVars = { documentId: string; onSuccess?: () => void };
  
  const deleteDocumentMutation = useMutationWithProposal({
    mutationFn: async ({ documentId }: DeleteDocumentVars) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/documents/${documentId}`);
    },
    onSuccess: (_data, variables) => {
      invalidateDocuments();
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/quotes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: queryKeys.financing(projectId) });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'resolved-cost-demand'] });
      variables.onSuccess?.();
    },
    onError: (error) => {
      console.error('Failed to delete document:', error instanceof Error ? error.message : 'An unexpected error occurred');
    },
    proposalConfig: createProposalConfig<DeleteDocumentVars>({
      category: 'documents',
      entityType: 'document',
      action: 'delete',
      getEntityId: (vars) => vars.documentId,
      getTitle: () => 'Delete Document',
      getDescription: () => 'Permanently delete this document and all its annotations',
    }),
  });

  const uploadDocument = useCallback(async (
    file: File,
    title?: string,
    description?: string,
    documentType?: DocumentType
  ): Promise<string | undefined> => {
    return guardReadOnly(() => {
      const tempId = crypto.randomUUID();
      uploadDocumentMutation.mutateWithProposal({ file, title, description, documentType });
      return tempId;
    });
  }, [guardReadOnly, uploadDocumentMutation]);

  const updateMetadata = useCallback((documentId: string, title: string, description?: string) => {
    guardReadOnly(() => {
      updateMetadataMutation.mutateWithProposal({ documentId, title, description });
    });
  }, [guardReadOnly, updateMetadataMutation]);

  const setDocumentType = useCallback((documentId: string, documentType: DocumentType) => {
    guardReadOnly(() => {
      setDocumentTypeMutation.mutateWithProposal({ documentId, documentType });
    });
  }, [guardReadOnly, setDocumentTypeMutation]);

  const addTag = useCallback((documentId: string, tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;
    guardReadOnly(() => {
      addTagMutation.mutateWithProposal({ documentId, tag: normalizedTag });
    });
  }, [guardReadOnly, addTagMutation]);

  const removeTag = useCallback((documentId: string, tag: string) => {
    guardReadOnly(() => {
      removeTagMutation.mutateWithProposal({ documentId, tag });
    });
  }, [guardReadOnly, removeTagMutation]);

  const addAnnotation = useCallback((documentId: string, content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    guardReadOnly(() => {
      addAnnotationMutation.mutateWithProposal({ documentId, content: trimmedContent });
    });
  }, [guardReadOnly, addAnnotationMutation]);

  const addAssociation = useCallback((documentId: string, association: Omit<DocumentAssociation, 'id' | 'documentId'>) => {
    guardReadOnly(() => {
      addAssociationMutation.mutateWithProposal({ documentId, association });
    });
  }, [guardReadOnly, addAssociationMutation]);

  const removeAssociation = useCallback((documentId: string, associationType: string, entityId: string) => {
    guardReadOnly(() => {
      removeAssociationMutation.mutateWithProposal({ documentId, associationType, entityId });
    });
  }, [guardReadOnly, removeAssociationMutation]);

  const deleteDocument = useCallback((documentId: string, onSuccess?: () => void) => {
    guardReadOnly(() => {
      deleteDocumentMutation.mutateWithProposal({ documentId, onSuccess });
    });
  }, [guardReadOnly, deleteDocumentMutation]);

  const getDocumentById = useCallback((documentId: string): DocumentAsset | undefined => {
    return data.documents.find(d => d.id === documentId);
  }, [data.documents]);

  const isEmpty = data.documents.length === 0;

  const documentsByType = useMemo(() => {
    const validTypes: DocumentType[] = ['document', 'image', 'media', 'other'];
    const result: Record<DocumentType, DocumentAsset[]> = {
      document: [],
      image: [],
      media: [],
      other: [],
    };
    for (const doc of data.documents) {
      // Map non-standard document types to 'other' to prevent runtime errors
      const type: DocumentType = validTypes.includes(doc.documentType as DocumentType) 
        ? (doc.documentType as DocumentType) 
        : 'other';
      result[type].push(doc);
    }
    return result;
  }, [data.documents]);

  const counts = useMemo(() => ({
    document: documentsByType.document.length,
    image: documentsByType.image.length,
    media: documentsByType.media.length,
    other: documentsByType.other.length,
  }), [documentsByType]);

  const documentsByPurpose = useMemo(() => {
    const result: Record<DocumentPurpose, DocumentAsset[]> = {
      quote: [],
      invoice: [],
      document: [],
      image: [],
      media: [],
      other: [],
    };
    for (const doc of data.documents) {
      const purpose = deriveDocumentPurpose(doc.associations || [], doc.documentType);
      result[purpose].push(doc);
    }
    return result;
  }, [data.documents]);

  const purposeCounts = useMemo(() => ({
    quote: documentsByPurpose.quote.length,
    invoice: documentsByPurpose.invoice.length,
    document: documentsByPurpose.document.length,
    image: documentsByPurpose.image.length,
    media: documentsByPurpose.media.length,
    other: documentsByPurpose.other.length,
  }), [documentsByPurpose]);

  return {
    data,
    documents: data.documents,
    isEmpty,
    isLoading,
    error: error as Error | null,
    documentsByType,
    counts,
    documentsByPurpose,
    purposeCounts,
    uploadDocument,
    updateMetadata,
    setDocumentType,
    addTag,
    removeTag,
    addAnnotation,
    addAssociation,
    removeAssociation,
    deleteDocument,
    getDocumentById,
  };
}
