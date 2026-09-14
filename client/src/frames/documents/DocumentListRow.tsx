/**
 * RENIX vNext — Document List Row
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Displays a document in list view with metadata, linked nodes, and actions.
 * Two-line layout optimized for narrow/mobile screens.
 */

import { FileText, Image, Film, File, MoreHorizontal, Pencil, Trash2, Link2, Download, ExternalLink, Unlink } from 'lucide-react';
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface DocumentListRowProps {
  document: DocumentAsset;
  isReadOnly: boolean;
  scopeNameMap?: Map<string, string>;
  isHighlighted?: boolean;
  onEditDetails: () => void;
  onViewDetails: () => void;
  onDelete: () => void;
}

export function DocumentListRow({
  document,
  isReadOnly,
  scopeNameMap,
  isHighlighted = false,
  onEditDetails,
  onViewDetails,
  onDelete,
}: DocumentListRowProps) {
  const normalizedType = normalizeDocumentType(document.documentType);
  const TypeIcon = TYPE_ICONS[normalizedType];

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.fileDataUrl) {
      const link = window.document.createElement('a');
      link.href = document.fileDataUrl;
      link.download = document.fileName;
      link.click();
    }
  };

  const linkedNodes = document.associations || [];

  const purpose = deriveDocumentPurpose(document.associations || [], document.documentType);
  const purposeLabel = getPurposeLabel(purpose);

  const scopeLinks = linkedNodes.filter(a => a.type === 'scope');

  return (
    <div 
      className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-border/40 hover-elevate cursor-pointer transition-colors duration-700 ${isHighlighted ? 'bg-primary/15 ring-2 ring-primary/40 shadow-sm' : ''}`}
      onClick={onViewDetails}
      data-testid={`document-row-${document.id}`}
      data-highlighted={isHighlighted || undefined}
    >
      <div className="pt-0.5 shrink-0">
        <div className="p-1.5 bg-muted/30 rounded">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-1.5 min-w-0">
          <span 
            className="truncate text-foreground text-[13px] leading-tight font-medium flex-1 min-w-0 pt-0.5" 
            data-testid={`text-doc-title-${document.id}`}
          >
            {document.title}
          </span>
          <div className="flex items-center shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" data-testid={`button-menu-${document.id}`}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {document.fileDataUrl && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(e); }}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                )}
                {!isReadOnly && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditDetails(); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal" data-testid={`badge-purpose-${document.id}`}>
            {purposeLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatFileSize(document.fileSize)}</span>
          <span className="text-muted-foreground/40 text-[10px]">&middot;</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatDate(document.uploadedAt)}</span>
          {scopeLinks.length > 0 ? (
            <>
              <span className="text-muted-foreground/40 text-[10px]">&middot;</span>
              <div className="flex items-center gap-1 min-w-0" data-testid={`doc-links-${document.id}`}>
                <Link2 className="h-3 w-3 text-primary shrink-0" />
                {scopeLinks.slice(0, 1).map((link, i) => (
                  <Badge 
                    key={`scope-${link.entityId}-${i}`} 
                    variant="default" 
                    className="text-[10px] px-1.5 py-0 h-4 font-normal truncate max-w-[140px]"
                    data-testid={`badge-scope-${document.id}-${i}`}
                  >
                    {(scopeNameMap?.get(link.entityId)) || link.entityLabel || 'Scope'}
                  </Badge>
                ))}
                {scopeLinks.length > 1 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                    +{scopeLinks.length - 1}
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/40 text-[10px]">&middot;</span>
              <Unlink className="h-3 w-3 text-muted-foreground/40" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
