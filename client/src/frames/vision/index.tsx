import { motion } from 'framer-motion';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Plus, Link as LinkIcon, ImageIcon } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useVisionData } from './useVisionData';
import { fetchLinkPreview, compressDataUrl, compressImage } from './utils';

const BASE_ROW_PX = 8;
const DEFAULT_SPAN = 24;
const GAP_PX = 12;

function computeSpan(aspectRatio: number, colWidth: number): number {
  const imgHeight = colWidth / aspectRatio;
  const span = Math.ceil((imgHeight + GAP_PX) / (BASE_ROW_PX + GAP_PX));
  return Math.max(16, Math.min(span, 40));
}

function useImageSpans(
  inspirations: Array<{ id: string; imageUrl: string; preview?: { image?: string | null } | null }>,
  gridRef: React.RefObject<HTMLDivElement | null>,
) {
  const [spans, setSpans] = useState<Record<string, number>>({});
  const ratiosRef = useRef<Record<string, number>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  const getColWidth = useCallback(() => {
    if (!gridRef.current) return 250;
    const style = getComputedStyle(gridRef.current);
    const cols = style.gridTemplateColumns.split(' ').length || 2;
    const totalGap = GAP_PX * (cols - 1);
    return (gridRef.current.clientWidth - totalGap) / cols;
  }, [gridRef]);

  useEffect(() => {
    for (const insp of inspirations) {
      if (loadedRef.current.has(insp.id)) continue;
      loadedRef.current.add(insp.id);

      const src = (insp.preview?.image ?? null) || insp.imageUrl;
      if (!src) continue;

      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        ratiosRef.current[insp.id] = ratio;
        const span = computeSpan(ratio, getColWidth());
        setSpans(prev => ({ ...prev, [insp.id]: span }));
      };
      img.src = src;
    }
  }, [inspirations, getColWidth]);

  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver(() => {
      const colWidth = getColWidth();
      const updated: Record<string, number> = {};
      for (const [id, ratio] of Object.entries(ratiosRef.current)) {
        updated[id] = computeSpan(ratio, colWidth);
      }
      if (Object.keys(updated).length > 0) {
        setSpans(prev => ({ ...prev, ...updated }));
      }
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [gridRef, getColWidth]);

  return spans;
}

import { MoodboardCarousel } from './MoodboardCarousel';
import { DesireStatement } from './DesireStatement';
import { InspirationTile } from './InspirationTile';
import { AddInspiration } from './AddInspiration';
import { BoardTags } from './BoardTags';
import { EmergingThemes } from './EmergingThemes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VisionSkeleton } from '@/components/FrameSkeleton';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export function VisionFrame() {
  const { projectId, isReadOnly } = useProject();
  const {
    activeBoard,
    activeBoardId,
    setActiveBoardId,
    nonArchivedBoards,
    createBoard,
    renameBoard,
    duplicateBoard,
    archiveBoard,
    deleteBoard,
    updateDesireStatement,
    addInspiration,
    removeInspiration,
    updateInspirationCaption,
    addInspirationTag,
    removeInspirationTag,
    moveInspirationToBoard,
    addBoardTag,
    removeBoardTag,
    updateInspirationPreview,
    isLoading,
    isGeneratingThemes,
  } = useVisionData(projectId, isReadOnly);

  const gridRef = useRef<HTMLDivElement>(null);
  const fabFileRef = useRef<HTMLInputElement>(null);
  const [fabDrawerOpen, setFabDrawerOpen] = useState(false);
  const [fabUrlValue, setFabUrlValue] = useState('');
  const otherBoards = nonArchivedBoards.filter((b) => b.id !== activeBoardId);

  const visibleInspirations = activeBoard ? activeBoard.inspirations.filter((i) => !i.archived) : [];
  const imageSpans = useImageSpans(visibleInspirations, gridRef);

  const handleAddInspiration = useCallback(
    async (urlOrDataUrl: string) => {
      if (isReadOnly) return;

      const inspiration = {
        imageUrl: urlOrDataUrl,
        caption: null,
        tags: [],
        archived: false,
      };
      const id = await addInspiration(inspiration);

      if (id && !urlOrDataUrl.startsWith('data:') && (urlOrDataUrl.startsWith('http://') || urlOrDataUrl.startsWith('https://'))) {
        updateInspirationPreview(id, null, true);
        const preview = await fetchLinkPreview(urlOrDataUrl);
        updateInspirationPreview(id, preview, false);
      }
    },
    [isReadOnly, addInspiration, updateInspirationPreview]
  );

  const handleFabFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          try {
            const compressed = await compressImage(file);
            handleAddInspiration(compressed);
          } catch {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) handleAddInspiration(event.target.result as string);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
    if (e.target) e.target.value = '';
    setFabDrawerOpen(false);
  }, [handleAddInspiration]);

  const handleFabAddUrl = useCallback(() => {
    if (fabUrlValue.trim()) {
      handleAddInspiration(fabUrlValue.trim());
      setFabUrlValue('');
      setFabDrawerOpen(false);
    }
  }, [fabUrlValue, handleAddInspiration]);

  useEffect(() => {
    const handleGlobalPaste = (e: globalThis.ClipboardEvent) => {
      if (isReadOnly) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              if (event.target?.result) {
                try {
                  const compressed = await compressDataUrl(event.target.result as string);
                  handleAddInspiration(compressed);
                } catch {
                  handleAddInspiration(event.target.result as string);
                }
              }
            };
            reader.readAsDataURL(file);
          }
          e.preventDefault();
          return;
        }
      }

      const text = e.clipboardData?.getData('text');
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        handleAddInspiration(text);
        e.preventDefault();
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [isReadOnly, handleAddInspiration]);

  if (isLoading) return <VisionSkeleton />;

  if (!activeBoard) {
    return (
      <div className="p-8 text-center text-secondary max-w-md mx-auto">
        <h3 className="text-lg font-medium text-foreground mb-2">Capture your vision</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Before diving into budgets and quotes, collect the images, links, and ideas that define what you want.
          Moodboards help you communicate your vision to contractors and keep decisions aligned.
        </p>
        <Button onClick={() => createBoard()} className="mt-2" data-testid="button-create-first-board">
          Create your first moodboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 md:space-y-4 relative"
      data-testid="frame-vision"
    >
      <header className="flex flex-col gap-2 md:gap-3">
        <MoodboardCarousel
          boards={nonArchivedBoards}
          activeBoard={activeBoard}
          onSelect={setActiveBoardId}
          onCreateNew={() => createBoard()}
          onRenameBoard={(boardId, title) => renameBoard(boardId, title)}
          onDeleteBoard={(boardId) => {
            deleteBoard(boardId);
            if (boardId === activeBoardId && nonArchivedBoards.length > 1) {
              const nextBoard = nonArchivedBoards.find(b => b.id !== boardId);
              if (nextBoard) setActiveBoardId(nextBoard.id);
            }
          }}
          disabled={isReadOnly}
          canDelete={nonArchivedBoards.length > 1}
        />
      </header>

      <DesireStatement
        value={activeBoard.desireStatement}
        onChange={updateDesireStatement}
        disabled={isReadOnly}
      />

      <div
        ref={gridRef}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 auto-rows-[8px]"
        data-testid="grid-inspiration"
      >
        {visibleInspirations.map((inspiration) => {
          const span = imageSpans[inspiration.id] || DEFAULT_SPAN;
          return (
            <div key={inspiration.id} style={{ gridRow: `span ${span}` }}>
              <InspirationTile
                inspiration={inspiration}
                onRemove={() => removeInspiration(inspiration.id)}
                onUpdateCaption={(caption) => updateInspirationCaption(inspiration.id, caption)}
                onAddTag={(tag) => addInspirationTag(inspiration.id, tag)}
                onRemoveTag={(tag) => removeInspirationTag(inspiration.id, tag)}
                onMoveToBoard={(boardId) => moveInspirationToBoard(inspiration.id, boardId)}
                otherBoards={otherBoards}
                disabled={isReadOnly}
              />
            </div>
          );
        })}
        <div className="hidden sm:block" style={{ gridRow: 'span 22' }}>
          <AddInspiration onAdd={handleAddInspiration} disabled={isReadOnly} />
        </div>
      </div>

      {visibleInspirations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-inspiration">
          <p className="text-sm italic">Your inspiration canvas is empty</p>
          <p className="text-xs mt-1">Drop images, paste links, or add from URL to start building your aesthetic direction.</p>
        </div>
      )}

      <div className="pt-3 mt-2 border-t border-border/30">
        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
          <div className="flex-1 min-w-0">
            <BoardTags 
              tags={activeBoard.tags} 
              onAdd={addBoardTag} 
              onRemove={removeBoardTag} 
              disabled={isReadOnly} 
            />
          </div>
          <div className="md:w-[280px] shrink-0">
            <EmergingThemes themes={activeBoard.themes} isGenerating={isGeneratingThemes} />
          </div>
        </div>
      </div>

      {!isReadOnly && (
        <>
          <input
            ref={fabFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFabFileSelect}
            data-testid="input-fab-file-upload"
          />
          <button
            onClick={() => setFabDrawerOpen(true)}
            className="sm:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-fab-add"
          >
            <Plus className="w-5 h-5" />
          </button>

          <Drawer open={fabDrawerOpen} onOpenChange={setFabDrawerOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="text-sm">Add Inspiration</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-3">
                <Button
                  variant="outline"
                  className="w-full gap-2 justify-start h-11"
                  onClick={() => {
                    fabFileRef.current?.click();
                  }}
                  data-testid="button-fab-upload"
                >
                  <ImageIcon className="w-4 h-4" />
                  Upload from device
                </Button>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={fabUrlValue}
                      onChange={(e) => setFabUrlValue(e.target.value)}
                      placeholder="Paste image or page URL"
                      className="text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFabAddUrl();
                      }}
                      data-testid="input-fab-url"
                    />
                    <Button
                      size="sm"
                      onClick={handleFabAddUrl}
                      disabled={!fabUrlValue.trim()}
                      data-testid="button-fab-add-url"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  You can also paste images anywhere on the page
                </p>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </motion.div>
  );
}

export default VisionFrame;
