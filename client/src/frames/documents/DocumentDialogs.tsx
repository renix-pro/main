/**
 * RENIX vNext — Document Dialogs
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Dialogs for managing document metadata, tags, and annotations.
 * Non-destructive operations only.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Tag, MessageSquare, FileText, Image, Film, File, Download, Minimize2, Sparkles, Link2, Pencil, Building2, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RenixLoader, RenixSpinner } from '@/components/RenixLoader';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DocumentAsset, DocumentType } from './useDocumentsData';
import { normalizeDocumentType } from './utils';

/**
 * Compress an image file using Canvas API
 * @param file - Original image file
 * @param maxWidth - Maximum width (default 1920px)
 * @param maxHeight - Maximum height (default 1080px)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Compressed file
 */
async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          
          // Create new file with same name (use globalThis.File to avoid conflict with lucide File icon)
          const compressedFile = new globalThis.File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if file is an image
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

const TYPE_ICONS: Record<DocumentType, typeof FileText> = {
  document: FileText,
  image: Image,
  media: Film,
  other: File,
};

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'document', label: 'Document' },
  { value: 'image', label: 'Image' },
  { value: 'media', label: 'Media' },
  { value: 'other', label: 'Other' },
];

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, title?: string, description?: string, documentType?: DocumentType) => Promise<void>;
}

export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [isUploading, setIsUploading] = useState(false);
  const [compressEnabled, setCompressEnabled] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current file is an image
  const fileIsImage = file ? isImageFile(file) : false;

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setDescription('');
      setDocumentType('other');
      setIsUploading(false);
      setCompressEnabled(false);
      setCompressedFile(null);
      setIsCompressing(false);
    }
  }, [open]);

  // Compress image when enabled
  const performCompression = useCallback(async (sourceFile: File) => {
    if (!isImageFile(sourceFile)) return;
    
    setIsCompressing(true);
    try {
      const compressed = await compressImage(sourceFile);
      setCompressedFile(compressed);
    } catch (err) {
      console.error('Compression failed:', err);
      setCompressedFile(null);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  useEffect(() => {
    if (file && fileIsImage && compressEnabled) {
      performCompression(file);
    } else {
      setCompressedFile(null);
    }
  }, [file, fileIsImage, compressEnabled, performCompression]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
      // Auto-detect document type for images
      if (isImageFile(selectedFile)) {
        setDocumentType('image');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    // Use compressed file if compression is enabled and available
    const fileToUpload = (compressEnabled && compressedFile) ? compressedFile : file;
    
    await onUpload(fileToUpload, title || undefined, description || undefined, documentType);
    setIsUploading(false);
    onOpenChange(false);
  };

  // Calculate size reduction percentage
  const sizeReduction = (file && compressedFile) 
    ? Math.round((1 - compressedFile.size / file.size) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a document, image, or media file to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
            {file ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 border bg-surface-secondary/50">
                  {fileIsImage ? (
                    <Image className="h-5 w-5 text-secondary" />
                  ) : (
                    <FileText className="h-5 w-5 text-secondary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{file.name}</span>
                    <span className="text-xs text-secondary">
                      {formatFileSize(file.size)}
                      {compressEnabled && compressedFile && (
                        <span className="ml-2">
                          → {formatFileSize(compressedFile.size)} ({sizeReduction}% smaller)
                        </span>
                      )}
                      {compressEnabled && isCompressing && (
                        <span className="ml-2">Compressing...</span>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setFile(null)}
                    data-testid="button-clear-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {fileIsImage && (
                  <div className="flex items-center gap-2 p-3 border bg-muted/30">
                    <Checkbox
                      id="compress-image"
                      checked={compressEnabled}
                      onCheckedChange={(checked) => setCompressEnabled(checked === true)}
                      data-testid="checkbox-compress-image"
                    />
                    <Label 
                      htmlFor="compress-image" 
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Minimize2 className="h-4 w-4" />
                      Reduce file size
                    </Label>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-file"
              >
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="upload-title">Title</Label>
            <Input
              id="upload-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Document title"
              data-testid="input-upload-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="upload-type">Category</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
              <SelectTrigger id="upload-type" data-testid="select-upload-type">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="upload-description">Description (optional)</Label>
            <Textarea
              id="upload-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this document"
              data-testid="input-upload-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading || isCompressing}
            data-testid="button-confirm-upload"
          >
            {isUploading ? 'Uploading...' : isCompressing ? 'Compressing...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentAsset | null;
  onSave: (title: string, description?: string, documentType?: DocumentType) => void;
}

export function MetadataDialog({ open, onOpenChange, document, onSave }: MetadataDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');

  useEffect(() => {
    if (open && document) {
      setTitle(document.title);
      setDescription(document.description || '');
      setDocumentType(document.documentType);
    }
  }, [open, document]);

  const handleSave = () => {
    onSave(title, description || undefined, documentType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Metadata</DialogTitle>
          <DialogDescription>
            Update the title, category, and description of this document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="metadata-title">Title</Label>
            <Input
              id="metadata-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Document title"
              data-testid="input-metadata-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata-type">Category</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
              <SelectTrigger id="metadata-type" data-testid="select-metadata-type">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata-description">Description</Label>
            <Textarea
              id="metadata-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description"
              data-testid="input-metadata-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()} data-testid="button-save-metadata">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentAsset | null;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function TagsDialog({ open, onOpenChange, document, onAddTag, onRemoveTag }: TagsDialogProps) {
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (open) {
      setNewTag('');
    }
  }, [open]);

  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !document?.tags.includes(trimmed)) {
      onAddTag(trimmed);
      setNewTag('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Add or remove tags to organize this document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a tag..."
              data-testid="input-new-tag"
            />
            <Button onClick={handleAddTag} disabled={!newTag.trim()} data-testid="button-add-tag">
              <Tag className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {document && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {document.tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center gap-1"
                  data-testid={`badge-edit-tag-${tag}`}
                >
                  {tag}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:text-destructive"
                    onClick={() => onRemoveTag(tag)}
                    data-testid={`button-remove-tag-${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {document && document.tags.length === 0 && (
            <p className="text-sm text-center py-4 text-secondary">
              No tags yet. Add some to help organize this document.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentAsset | null;
  onSave: (title: string, description?: string, documentType?: DocumentType) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function EditDetailsDialog({ open, onOpenChange, document, onSave, onAddTag, onRemoveTag }: EditDetailsDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (open && document) {
      setTitle(document.title);
      setDescription(document.description || '');
      setDocumentType(document.documentType);
      setNewTag('');
    }
  }, [open, document]);

  const handleSave = () => {
    onSave(title, description || undefined, documentType);
    onOpenChange(false);
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !document?.tags.includes(trimmed)) {
      onAddTag(trimmed);
      setNewTag('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-edit-details">
        <DialogHeader>
          <DialogTitle>Edit Details</DialogTitle>
          <DialogDescription>
            Update document information and organize with tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-details-title">Title</Label>
            <Input
              id="edit-details-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Document title"
              data-testid="input-metadata-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-details-type">Category</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
              <SelectTrigger id="edit-details-type" data-testid="select-metadata-type">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-details-description">Description</Label>
            <Textarea
              id="edit-details-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description"
              data-testid="input-metadata-description"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h4>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                data-testid="input-new-tag"
              />
              <Button onClick={handleAddTag} disabled={!newTag.trim()} data-testid="button-add-tag">
                <Tag className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {document && document.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {document.tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                    data-testid={`badge-edit-tag-${tag}`}
                  >
                    {tag}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:text-destructive"
                      onClick={() => onRemoveTag(tag)}
                      data-testid={`button-remove-tag-${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {document && document.tags.length === 0 && (
              <p className="text-sm text-center py-2 text-secondary">
                No tags yet.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()} data-testid="button-save-metadata">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (content: string) => void;
}

export function AnnotationDialog({ open, onOpenChange, onAdd }: AnnotationDialogProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (open) {
      setContent('');
    }
  }, [open]);

  const handleAdd = () => {
    if (content.trim()) {
      onAdd(content.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Annotation</DialogTitle>
          <DialogDescription>
            Add a note or observation about this document. Annotations are append-only.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Your annotation..."
            rows={4}
            data-testid="input-annotation-content"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!content.trim()} data-testid="button-save-annotation">
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Annotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderMarkdownText(text: string): React.ReactNode {
  if (!text) return null;

  const renderInlineMarkdown = (line: string, keyPrefix: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`${keyPrefix}-t${partIndex++}`}>{line.slice(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={`${keyPrefix}-b${partIndex++}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(<span key={`${keyPrefix}-t${partIndex++}`}>{line.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? <>{parts}</> : <>{line}</>;
  };

  const paragraphs = text.split(/\n\n+/);

  return (
    <>
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split('\n');

        const bulletLines = lines.filter(l => /^\s*- /.test(l));
        if (bulletLines.length === lines.length && bulletLines.length > 0) {
          return (
            <ul key={`p${pIdx}`} className="list-disc list-inside space-y-0.5">
              {lines.map((line, lIdx) => (
                <li key={`p${pIdx}-l${lIdx}`}>
                  {renderInlineMarkdown(line.replace(/^\s*- /, ''), `p${pIdx}-l${lIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        const orderedLines = lines.filter(l => /^\s*\d+\.\s/.test(l));
        if (orderedLines.length === lines.length && orderedLines.length > 0) {
          return (
            <ol key={`p${pIdx}`} className="list-decimal list-inside space-y-0.5">
              {lines.map((line, lIdx) => (
                <li key={`p${pIdx}-l${lIdx}`}>
                  {renderInlineMarkdown(line.replace(/^\s*\d+\.\s/, ''), `p${pIdx}-l${lIdx}`)}
                </li>
              ))}
            </ol>
          );
        }

        const mixed: React.ReactNode[] = [];
        let currentBullets: string[] = [];
        let currentOrdered: string[] = [];

        const flushBullets = () => {
          if (currentBullets.length > 0) {
            const key = `p${pIdx}-ul${mixed.length}`;
            mixed.push(
              <ul key={key} className="list-disc list-inside space-y-0.5">
                {currentBullets.map((b, i) => (
                  <li key={`${key}-${i}`}>{renderInlineMarkdown(b, `${key}-${i}`)}</li>
                ))}
              </ul>
            );
            currentBullets = [];
          }
        };

        const flushOrdered = () => {
          if (currentOrdered.length > 0) {
            const key = `p${pIdx}-ol${mixed.length}`;
            mixed.push(
              <ol key={key} className="list-decimal list-inside space-y-0.5">
                {currentOrdered.map((o, i) => (
                  <li key={`${key}-${i}`}>{renderInlineMarkdown(o, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
            currentOrdered = [];
          }
        };

        lines.forEach((line, lIdx) => {
          if (/^\s*- /.test(line)) {
            flushOrdered();
            currentBullets.push(line.replace(/^\s*- /, ''));
          } else if (/^\s*\d+\.\s/.test(line)) {
            flushBullets();
            currentOrdered.push(line.replace(/^\s*\d+\.\s/, ''));
          } else {
            flushBullets();
            flushOrdered();
            mixed.push(<p key={`p${pIdx}-t${lIdx}`}>{renderInlineMarkdown(line, `p${pIdx}-t${lIdx}`)}</p>);
          }
        });

        flushBullets();
        flushOrdered();

        if (mixed.length === 1) {
          return <div key={`p${pIdx}`}>{mixed[0]}</div>;
        }

        return <div key={`p${pIdx}`} className="space-y-1">{mixed}</div>;
      })}
    </>
  );
}

interface DetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentAsset | null;
  scopeNameMap?: Map<string, string>;
  onEditDetails?: () => void;
  onAddAnnotation?: (content: string) => void;
  isReadOnly?: boolean;
}

export function DetailsDialog({ open, onOpenChange, document, scopeNameMap, onEditDetails, onAddAnnotation, isReadOnly }: DetailsDialogProps) {
  const [showFullText, setShowFullText] = useState(false);
  const [annotationInput, setAnnotationInput] = useState('');

  if (!document) return null;

  const normalizedType = normalizeDocumentType(document.documentType);
  const TypeIcon = TYPE_ICONS[normalizedType];

  const handleDownload = () => {
    if (document.fileDataUrl) {
      const link = window.document.createElement('a');
      link.href = document.fileDataUrl;
      link.download = document.fileName;
      link.click();
    }
  };

  const extractedTextPreview = document.extractedText && document.extractedText.length > 500 && !showFullText
    ? document.extractedText.slice(0, 500) + '...'
    : document.extractedText;

  const getAssociationLabel = (assoc: DocumentAsset['associations'][number]) => {
    if (assoc.type === 'scope' && scopeNameMap) {
      return scopeNameMap.get(assoc.entityId) || assoc.entityLabel;
    }
    return assoc.entityLabel;
  };

  const getAssociationBadgeLabel = (type: string) => {
    switch (type) {
      case 'quote': return 'Quote';
      case 'invoice': return 'Invoice';
      case 'scope': return 'Scope';
      case 'execution': return 'Execution';
      default: return type;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="drawer-document-details">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5" />
            {document.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {document.documentType === 'image' && document.fileDataUrl && (
              <div className="overflow-hidden border">
                <img
                  src={document.fileDataUrl}
                  alt={document.title}
                  className="w-full h-auto max-h-64 object-contain bg-surface-secondary"
                />
              </div>
            )}

            {document.summary && (
              <div className="rounded-md border p-4 space-y-2" data-testid="details-summary">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Summary
                </h4>
                <div className="bg-muted/30 p-4 rounded-md space-y-2 text-xs">
                  {renderMarkdownText(document.summary)}
                </div>
              </div>
            )}

            {document.associations.length > 0 && (
              <div className="rounded-md border p-4 space-y-2" data-testid="details-associations">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Linked Entities
                </h4>
                <div className="space-y-1">
                  {document.associations.map(assoc => (
                    <div key={assoc.id} className="flex items-start gap-2.5 py-1.5">
                      <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">
                        {getAssociationBadgeLabel(assoc.type)}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-xs">{getAssociationLabel(assoc)}</div>
                        {assoc.vendorName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{assoc.vendorName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {document.description && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
                <p className="text-xs text-secondary">{document.description}</p>
              </div>
            )}

            {document.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {document.extractedText && (
              <div className="rounded-md border p-4 space-y-2" data-testid="details-extracted-text">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Extracted Text
                </h4>
                <div className="font-mono text-xs bg-muted/10 p-4 rounded-md whitespace-pre-wrap leading-relaxed border border-dashed">
                  {extractedTextPreview}
                </div>
                {document.extractedText.length > 500 && (
                  <button
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() => setShowFullText(!showFullText)}
                  >
                    {showFullText ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-md border p-4 space-y-2 text-xs" data-testid="details-file-info">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <File className="h-3.5 w-3.5" />
                File Information
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-0.5">{document.mimeType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Size</dt>
                  <dd className="mt-0.5">{(document.fileSize / 1024).toFixed(1)} KB</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Uploaded</dt>
                  <dd className="mt-0.5">{new Date(document.uploadedAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Uploaded by</dt>
                  <dd className="mt-0.5 truncate">{document.uploadedBy}</dd>
                </div>
              </div>
            </div>

            <div data-testid="details-annotations">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Annotations</h4>
              {document.annotations.length > 0 ? (
                <div className="space-y-2">
                  {document.annotations.map(annotation => (
                    <div
                      key={annotation.id}
                      className="p-3 text-xs bg-surface-secondary/50 rounded-md"
                    >
                      <p>{annotation.content}</p>
                      <p className="text-xs mt-1 text-secondary">
                        {new Date(annotation.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondary text-xs">No annotations yet</p>
              )}
              {!isReadOnly && onAddAnnotation && (
                <div className="flex gap-2 mt-2">
                  <Textarea
                    value={annotationInput}
                    onChange={e => setAnnotationInput(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1"
                    data-testid="input-inline-annotation"
                  />
                  <Button
                    size="sm"
                    disabled={!annotationInput.trim()}
                    onClick={() => {
                      onAddAnnotation(annotationInput.trim());
                      setAnnotationInput('');
                    }}
                    data-testid="button-inline-add-annotation"
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

        <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t flex-wrap">
          <div className="flex flex-wrap gap-2">
            {!isReadOnly && onEditDetails && (
              <Button variant="outline" size="sm" onClick={onEditDetails} data-testid="button-edit-details">
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Details
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface DocumentLink {
  associationId?: string;
  entityId: string;
  entityLabel: string;
}

interface ScopeBacklink {
  scopeId: string;
  scopeName: string;
  allocationPercentage: number;
  referenceId: string;
  documentRowId: string;
}

interface AllLinksResponse {
  scopeBacklinks: ScopeBacklink[];
  quoteLinks: DocumentLink[];
  invoiceLinks: DocumentLink[];
  hasLinks: boolean;
}

interface UnlinkResponse {
  success: boolean;
  unlinkedQuotes: number;
  unlinkedInvoices: number;
  unlinkedScopes: number;
}

type DeleteStep = 'loading' | 'review-links' | 'unlinking' | 'unlinked' | 'confirm-delete';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  documentId?: string;
  projectId?: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ 
  open, 
  onOpenChange, 
  documentTitle, 
  documentId,
  projectId,
  onConfirm 
}: DeleteConfirmDialogProps) {
  const [step, setStep] = useState<DeleteStep>('loading');
  const [linksData, setLinksData] = useState<AllLinksResponse | null>(null);
  const [unlinkResult, setUnlinkResult] = useState<UnlinkResponse | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && documentId && projectId) {
      setStep('loading');
      setLinksData(null);
      setUnlinkResult(null);

      fetch(`/api/projects/${projectId}/documents/${documentId}/all-links`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      })
        .then(res => res.json())
        .then((data: AllLinksResponse) => {
          setLinksData(data);
          setStep(data.hasLinks ? 'review-links' : 'confirm-delete');
        })
        .catch(() => {
          setLinksData(null);
          setStep('confirm-delete');
        });
    }
  }, [open, documentId, projectId]);

  const handleClose = (openState: boolean) => {
    if (!openState) {
      setStep('loading');
      setLinksData(null);
      setUnlinkResult(null);
    }
    onOpenChange(openState);
  };

  const handleUnlink = async () => {
    if (!documentId || !projectId) return;
    setStep('unlinking');
    try {
      const res = await apiRequest('POST', `/api/projects/${projectId}/documents/${documentId}/unlink`);
      const result: UnlinkResponse = await res.json();
      setUnlinkResult(result);
      setStep('unlinked');
    } catch {
      toast({
        title: 'Unlink failed',
        description: 'Could not remove document connections. Please try again.',
        variant: 'destructive',
      });
      setStep('review-links');
    }
  };

  const handleDelete = () => {
    onConfirm();
    handleClose(false);
  };

  if (step === 'loading') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>Checking document connections...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <RenixLoader size="sm" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'review-links' || step === 'unlinking') {
    const scopeBacklinks = linksData?.scopeBacklinks || [];
    const quoteLinks = linksData?.quoteLinks || [];
    const invoiceLinks = linksData?.invoiceLinks || [];

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This document has connections to other parts of your project. Review them before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 px-4 bg-destructive/10 border border-destructive/20 rounded-md space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Connected Resources</span>
            </div>

            {scopeBacklinks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-sm font-medium">Scope Allocations</span>
                </div>
                <ul className="text-xs text-secondary space-y-0.5 pl-5">
                  {scopeBacklinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0" />
                      {link.scopeName} ({link.allocationPercentage}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {quoteLinks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-sm font-medium">Linked Quotes</span>
                </div>
                <ul className="text-xs text-secondary space-y-0.5 pl-5">
                  {quoteLinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0" />
                      {link.entityLabel}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {invoiceLinks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-sm font-medium">Linked Invoices</span>
                </div>
                <ul className="text-xs text-secondary space-y-0.5 pl-5">
                  {invoiceLinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0" />
                      {link.entityLabel}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-destructive/80">
              Unlinking will permanently remove these connections and delete the associated quotes and invoices.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={step === 'unlinking'}
              data-testid="button-unlink-continue"
            >
              {step === 'unlinking' && <RenixSpinner className="mr-2" />}
              Unlink &amp; Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'unlinked') {
    const quotes = unlinkResult?.unlinkedQuotes ?? 0;
    const invoices = unlinkResult?.unlinkedInvoices ?? 0;
    const scopes = unlinkResult?.unlinkedScopes ?? 0;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              The document is now safe to delete. This will permanently remove the file and all its traces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-status-approved">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">All connections have been removed successfully.</span>
            </div>
            <p className="text-xs text-secondary pl-7" data-testid="text-unlink-summary">
              {quotes} quote{quotes !== 1 ? 's' : ''}, {invoices} invoice{invoices !== 1 ? 's' : ''}, and {scopes} scope allocation{scopes !== 1 ? 's' : ''} were unlinked.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} data-testid="button-confirm-delete">
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{documentTitle}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} data-testid="button-confirm-delete">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Duplicate Document Dialog
// ============================================================================

export interface DuplicateInfo {
  existingId: string;
  existingFileName: string;
  existingUploadedAt: string;
  newFileName: string;
}

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateInfo: DuplicateInfo | null;
  onKeepBoth: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export function DuplicateDialog({
  open,
  onOpenChange,
  duplicateInfo,
  onKeepBoth,
  onReplace,
  onCancel,
}: DuplicateDialogProps) {
  if (!duplicateInfo) return null;

  const existingDate = new Date(duplicateInfo.existingUploadedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate Document Detected</DialogTitle>
          <DialogDescription>
            A document with identical content already exists in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted/30 rounded-md space-y-2">
            <div className="text-xs">
              <span className="text-secondary">Existing:</span>{' '}
              <span className="font-medium">{duplicateInfo.existingFileName}</span>
              <span className="text-xs text-secondary ml-2">({existingDate})</span>
            </div>
            <div className="text-xs">
              <span className="text-secondary">New:</span>{' '}
              <span className="font-medium">{duplicateInfo.newFileName}</span>
            </div>
          </div>

          <p className="text-xs text-secondary">
            What would you like to do?
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel} data-testid="button-duplicate-cancel">
            Cancel Upload
          </Button>
          <Button variant="secondary" onClick={onKeepBoth} data-testid="button-duplicate-keep-both">
            Keep Both
          </Button>
          <Button onClick={onReplace} data-testid="button-duplicate-replace">
            Replace Existing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
