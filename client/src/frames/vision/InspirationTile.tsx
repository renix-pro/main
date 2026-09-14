import { useState, useEffect, useCallback } from 'react';
import { X, Link as LinkIcon, Pencil, ExternalLink, Move, Plus } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import type { VisionInspiration, VisionMoodboard } from './useVisionData';

interface InspirationTileProps {
  inspiration: VisionInspiration;
  onRemove: () => void;
  onUpdateCaption: (caption: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onMoveToBoard: (boardId: string) => void;
  otherBoards: VisionMoodboard[];
  disabled: boolean;
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const check = () => setIsTouch(window.matchMedia('(pointer: coarse)').matches);
    check();
    const mql = window.matchMedia('(pointer: coarse)');
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);
  return isTouch;
}

export function InspirationTile({
  inspiration,
  onRemove,
  onUpdateCaption,
  onAddTag,
  onRemoveTag,
  onMoveToBoard,
  otherBoards,
  disabled,
}: InspirationTileProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(inspiration.caption || '');
  const [newTag, setNewTag] = useState('');
  const isTouch = useIsTouch();

  const preview = inspiration.preview;
  const displayImage = preview?.image || inspiration.imageUrl;
  const isDataUrl = inspiration.imageUrl.startsWith('data:');

  useEffect(() => {
    setCaptionDraft(inspiration.caption || '');
    setImageLoaded(false);
    setImageError(false);
  }, [inspiration.id]);

  useEffect(() => {
    if (isEditOpen || isDrawerOpen) {
      setCaptionDraft(inspiration.caption || '');
      setNewTag('');
    }
  }, [isEditOpen, isDrawerOpen, inspiration.caption]);

  const handleSaveCaption = useCallback(() => {
    onUpdateCaption(captionDraft.trim() || null);
  }, [captionDraft, onUpdateCaption]);

  const handleAddTag = useCallback(() => {
    if (newTag.trim()) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  }, [newTag, onAddTag]);

  const handleTileTap = useCallback(() => {
    if (disabled) return;
    if (isTouch) {
      setIsDrawerOpen(true);
    }
  }, [disabled, isTouch]);

  const hasMetadata = inspiration.caption || inspiration.tags.length > 0;

  const editContent = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-secondary">Caption</label>
        <Input
          value={captionDraft}
          onChange={(e) => setCaptionDraft(e.target.value)}
          placeholder="Add a caption..."
          className="text-sm h-8"
          onBlur={handleSaveCaption}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveCaption();
          }}
          data-testid={`input-caption-${inspiration.id}`}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-secondary">Tags</label>
        {inspiration.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {inspiration.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-2 py-0.5 gap-1"
                data-testid={`badge-tag-${inspiration.id}-${tag}`}
              >
                {tag}
                <button
                  onClick={() => onRemoveTag(tag)}
                  className="hover:text-destructive"
                  data-testid={`button-remove-tag-${inspiration.id}-${tag}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag..."
            className="text-xs h-7 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTag();
            }}
            data-testid={`input-new-tag-${inspiration.id}`}
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddTag} data-testid={`button-add-tag-${inspiration.id}`}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="group relative h-full overflow-hidden rounded-md bg-card"
        data-testid={`tile-inspiration-${inspiration.id}`}
        onClick={handleTileTap}
      >
        <div className="h-full">
          {inspiration.isLoadingPreview ? (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <RenixSpinner />
            </div>
          ) : imageError && !preview?.image ? (
            <a
              href={inspiration.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center h-full gap-2 transition-colors bg-muted/30 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <LinkIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-primary truncate max-w-full px-2">
                {inspiration.imageUrl.length > 35
                  ? inspiration.imageUrl.slice(0, 35) + '...'
                  : inspiration.imageUrl}
              </span>
            </a>
          ) : (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted/30 animate-pulse rounded-md" />
              )}
              <img
                src={displayImage}
                alt={inspiration.caption || preview?.title || 'Inspiration'}
                className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => { setImageError(true); setImageLoaded(true); }}
              />
            </>
          )}

          {preview && !isDataUrl && preview.siteName && (
            <a
              href={inspiration.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-white/80" />
                <span className="text-[10px] text-white/80">{preview.siteName}</span>
              </div>
            </a>
          )}

          {!disabled && !isTouch && (
            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Popover open={isEditOpen} onOpenChange={setIsEditOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={`p-1.5 bg-background/90 rounded shadow-sm hover-elevate ${hasMetadata ? 'ring-1 ring-primary/30' : ''}`}
                    data-testid={`button-edit-${inspiration.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  {editContent}
                </PopoverContent>
              </Popover>
              {otherBoards.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 bg-background/90 rounded shadow-sm hover-elevate"
                      data-testid={`button-move-${inspiration.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Move className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-xs font-medium text-secondary">
                      Move to board
                    </div>
                    {otherBoards.map((board) => (
                      <DropdownMenuItem
                        key={board.id}
                        onClick={() => onMoveToBoard(board.id)}
                        className="gap-2"
                        data-testid={`menuitem-move-to-${board.id}`}
                      >
                        {board.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1.5 bg-background/90 rounded shadow-sm hover-elevate hover:text-destructive"
                data-testid={`button-remove-${inspiration.id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm">Edit Inspiration</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {displayImage && !imageError && (
              <div className="rounded-lg overflow-hidden bg-muted/20 max-h-[200px]">
                <img
                  src={displayImage}
                  alt={inspiration.caption || 'Inspiration'}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {editContent}

            {otherBoards.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary">Move to board</label>
                <div className="flex flex-wrap gap-1.5">
                  {otherBoards.map((board) => (
                    <Button
                      key={board.id}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1.5"
                      onClick={() => {
                        onMoveToBoard(board.id);
                        setIsDrawerOpen(false);
                      }}
                      data-testid={`button-move-drawer-${board.id}`}
                    >
                      <Move className="w-3 h-3" />
                      {board.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onRemove();
                setIsDrawerOpen(false);
              }}
              data-testid={`button-remove-drawer-${inspiration.id}`}
            >
              <X className="w-3.5 h-3.5" />
              Remove from board
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
