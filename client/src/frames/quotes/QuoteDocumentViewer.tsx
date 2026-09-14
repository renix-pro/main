import { FileText, ExternalLink } from 'lucide-react';
import { RenixSpinner, RenixLoader } from '@/components/RenixLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface QuoteDocumentViewerProps {
  documentUrl: string | null;
  documentName: string | null;
  isExtracting: boolean;
  extractionError: string | null;
  hasSourceDocument?: boolean;
  isReadOnly?: boolean;
  onDocumentUploaded?: (url: string, name: string) => void;
  hasExtractedData?: boolean;
}

export function QuoteDocumentViewer({
  documentUrl,
  documentName,
  isExtracting,
  extractionError,
  hasSourceDocument = false,
}: QuoteDocumentViewerProps) {
  return (
    <div className="space-y-4">
      {documentUrl ? (
        <div className="border border-subtle rounded-lg overflow-hidden">
          <div className="aspect-[16/9] max-h-[300px] flex items-center justify-center bg-surface-elevated">
            {documentUrl.endsWith('.pdf') || documentUrl.includes('/objects/') ? (
              <iframe
                src={documentUrl}
                className="w-full h-full"
                title="Document Preview"
                data-testid="document-iframe"
              />
            ) : (
              <img
                src={documentUrl}
                alt={documentName || 'Document'}
                className="max-w-full max-h-full object-contain"
                data-testid="document-image"
              />
            )}
          </div>
          <div className="p-3 border-t border-subtle flex items-center justify-between gap-2 bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted flex-shrink-0" />
              <span className="text-sm truncate" data-testid="text-document-name">
                {documentName || 'Document'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isExtracting && (
                <Badge variant="outline" className="text-xs border-subtle">
                  <RenixSpinner className="mr-1" />
                  Extracting...
                </Badge>
              )}
              {extractionError && (
                <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                  Error
                </Badge>
              )}
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-subtle" asChild>
                  <span>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open
                  </span>
                </Button>
              </a>
            </div>
          </div>
        </div>
      ) : hasSourceDocument ? (
        <div
          className="border border-subtle rounded-lg p-8 flex flex-col items-center justify-center gap-3"
          data-testid="document-viewer-loading"
        >
          <RenixLoader size="md" />
          <p className="text-sm text-muted text-center">Loading source document...</p>
        </div>
      ) : (
        <div
          className="border border-dashed border-subtle rounded-lg p-8 flex flex-col items-center justify-center gap-3"
          data-testid="document-viewer-placeholder"
        >
          <FileText className="w-10 h-10 text-muted" />
          <p className="text-sm text-muted text-center">No document attached</p>
        </div>
      )}
    </div>
  );
}
