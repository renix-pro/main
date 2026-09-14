/**
 * RENIX vNext — Document Card
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Displays a document/media asset with metadata and controls.
 * Strictly observational — no implication of approval or authority.
 */

import { FileText, Image, Film, File, MoreHorizontal, Pencil, Trash2, Tag, MessageSquare, Link2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocumentAsset, DocumentType } from './useDocumentsData';
import { normalizeDocumentType, deriveDocumentPurpose, getPurposeLabel } from './utils';

const TYPE_ICONS: Record<DocumentType, typeof FileText> = {
  document: FileText,
  image: Image,
  media: Film,
  other: File,
};

const TYPE_LABELS: Record<DocumentType, string> = {
  document: 'Document',
  image: 'Image',
  media: 'Media',
  other: 'File',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface DocumentCardProps {
  document: DocumentAsset;
  isReadOnly: boolean;
  scopeNameMap?: Map<string, string>;
  onEditDetails: () => void;
  onViewDetails: () => void;
  onDelete: () => void;
}

export function DocumentCard({
  document,
  isReadOnly,
  scopeNameMap,
  onEditDetails,
  onViewDetails,
  onDelete,
}: DocumentCardProps) {
  // Use shared utility to normalize non-standard document types
  const normalizedType = normalizeDocumentType(document.documentType);
  const TypeIcon = TYPE_ICONS[normalizedType];
  const purpose = deriveDocumentPurpose(document.associations || [], document.documentType);
  const purposeLabel = getPurposeLabel(purpose);

  const handleDownload = () => {
    if (document.fileDataUrl) {
      const link = window.document.createElement('a');
      link.href = document.fileDataUrl;
      link.download = document.fileName;
      link.click();
    }
  };

  return (
    <Card 
      className="hover-elevate cursor-pointer"
      onClick={onViewDetails}
      data-testid={`document-card-${document.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 py-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 bg-surface-secondary">
            <TypeIcon className="h-5 w-5 text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-medium truncate" data-testid={`text-doc-title-${document.id}`}>
              {document.title}
            </CardTitle>
            <p className="text-xs mt-1 text-secondary">
              {purposeLabel} · {formatFileSize(document.fileSize)} · {formatDate(document.uploadedAt)}
            </p>
            {document.description && (
              <p className="text-sm mt-2 line-clamp-2 text-secondary" data-testid={`text-doc-desc-${document.id}`}>
                {document.description}
              </p>
            )}
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-doc-menu-${document.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewDetails} data-testid={`button-view-doc-${document.id}`}>
                <FileText className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} data-testid={`button-download-doc-${document.id}`}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              {!isReadOnly && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onEditDetails} data-testid={`button-edit-details-${document.id}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`button-delete-doc-${document.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {(document.tags.length > 0 || document.annotations.length > 0 || document.associations.length > 0) && (
        <CardContent className="pt-0 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {document.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs" data-testid={`badge-tag-${document.id}-${tag}`}>
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {document.annotations.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {document.annotations.length} {document.annotations.length === 1 ? 'note' : 'notes'}
              </Badge>
            )}
            {document.associations.filter(a => a.type === 'scope').map((link, i) => (
              <Badge key={`scope-${link.entityId}-${i}`} variant="default" className="text-xs whitespace-nowrap" data-testid={`badge-card-scope-${document.id}-${i}`}>
                <Link2 className="h-3 w-3 mr-1" />
                {(scopeNameMap?.get(link.entityId)) || link.entityLabel || 'Scope'}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
