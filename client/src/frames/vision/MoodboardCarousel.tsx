import { useRef, useState } from 'react';
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { VisionMoodboard } from './useVisionData';

interface MoodboardCarouselProps {
  boards: VisionMoodboard[];
  activeBoard: VisionMoodboard;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onRenameBoard: (boardId: string, title: string) => void;
  onDeleteBoard: (boardId: string) => void;
  disabled: boolean;
  canDelete: boolean;
}

export function MoodboardCarousel({
  boards,
  activeBoard,
  onSelect,
  onCreateNew,
  onRenameBoard,
  onDeleteBoard,
  disabled,
  canDelete,
}: MoodboardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleRename = () => {
    if (renameDraft.trim() && isRenaming) {
      onRenameBoard(isRenaming, renameDraft.trim());
    }
    setIsRenaming(null);
  };

  const startRename = (board: VisionMoodboard) => {
    setRenameDraft(board.title);
    setIsRenaming(board.id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      onDeleteBoard(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const getBoardPreviewImage = (board: VisionMoodboard): string | null => {
    const visibleInspirations = board.inspirations.filter(i => !i.archived);
    for (const insp of visibleInspirations) {
      if (insp.preview?.image) return insp.preview.image;
      if (insp.imageUrl.startsWith('data:') || insp.imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
        return insp.imageUrl;
      }
    }
    return null;
  };

  const inspirationCount = activeBoard.inspirations.filter(i => !i.archived).length;
  const activePreviewImage = getBoardPreviewImage(activeBoard);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors text-secondary"
          data-testid="button-toggle-carousel"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span className="text-xs uppercase tracking-wider">Boards</span>
        </button>

        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-muted/40"
            data-testid="button-expand-active-board"
          >
            {activePreviewImage && (
              <div className="w-5 h-5 rounded-sm overflow-hidden shrink-0 bg-muted/20">
                <img src={activePreviewImage} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <span className="truncate max-w-[160px] text-foreground">{activeBoard.title}</span>
            <span className="text-muted-foreground">({inspirationCount})</span>
          </button>
        )}

        <div className="flex-1" />

        {isCollapsed && boards.length > 1 && (
          <span className="text-[10px] text-muted-foreground/50">{boards.length} boards</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="flex gap-2 overflow-x-auto pt-2 pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              style={{ scrollbarWidth: 'thin' }}
            >
              {boards.map((board) => {
                const isActive = board.id === activeBoard.id;
                const previewImage = getBoardPreviewImage(board);
                const boardInspirationCount = board.inspirations.filter(i => !i.archived).length;

                return (
                  <div
                    key={board.id}
                    className={`group relative flex-shrink-0 w-[100px] sm:w-[120px] cursor-pointer transition-all rounded-md overflow-hidden border-2 ${
                      isActive 
                        ? 'border-primary' 
                        : 'border-transparent hover:border-border/50'
                    }`}
                    onClick={() => {
                      onSelect(board.id);
                      setIsCollapsed(true);
                    }}
                    data-testid={`tile-moodboard-${board.id}`}
                  >
                    <div className={`aspect-[4/3] overflow-hidden ${isActive ? 'bg-primary/5' : 'bg-muted/20'}`}>
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={board.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className={`py-1 px-1.5 ${isActive ? 'bg-primary/5' : ''}`}>
                      <p className="text-[11px] font-medium truncate" data-testid={`text-board-title-${board.id}`}>
                        {board.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {boardInspirationCount} {boardInspirationCount === 1 ? 'image' : 'images'}
                      </p>
                    </div>

                    {!disabled && (
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(board);
                          }}
                          className="p-1 bg-background/90 rounded shadow-sm hover-elevate"
                          data-testid={`button-rename-board-${board.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(board.id);
                            }}
                            className="p-1 bg-background/90 rounded shadow-sm hover-elevate hover:text-destructive"
                            data-testid={`button-delete-board-${board.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {!disabled && (
                <div
                  className="flex-shrink-0 w-[100px] sm:w-[120px] cursor-pointer group"
                  onClick={onCreateNew}
                  data-testid="tile-add-moodboard"
                >
                  <div className="aspect-[4/3] border border-dashed border-subtle rounded-md renix-surface group-hover:border-border/60 flex items-center justify-center transition-all">
                    <Plus className="w-5 h-5 transition-colors text-muted-foreground/40" />
                  </div>
                  <div className="py-1 px-1.5">
                    <p className="text-[11px] transition-colors text-muted-foreground">New board</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isRenaming !== null} onOpenChange={() => setIsRenaming(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename moodboard</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            placeholder="Moodboard name"
            className="mt-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(null);
            }}
            data-testid="input-rename-board"
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} data-testid="button-save-rename">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete moodboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this moodboard? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="button-confirm-delete">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
