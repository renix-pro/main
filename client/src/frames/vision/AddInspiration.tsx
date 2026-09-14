import { useState, useRef, DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { compressImage } from './utils';

interface AddInspirationProps {
  onAdd: (urlOrDataUrl: string) => void;
  disabled: boolean;
}

export function AddInspiration({
  onAdd,
  disabled,
}: AddInspirationProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file);
          onAdd(compressed);
        } catch {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) onAdd(event.target.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          try {
            const compressed = await compressImage(file);
            onAdd(compressed);
          } catch {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) onAdd(event.target.result as string);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleAddUrl = () => {
    if (urlValue.trim()) {
      onAdd(urlValue.trim());
      setUrlValue('');
      setShowUrlInput(false);
    }
  };

  if (disabled) return null;

  return (
    <div
      className={`h-full rounded-md transition-all cursor-pointer group ${
        isDragging 
          ? 'bg-primary/10 dark:bg-primary/20 border-2 border-dashed border-primary/30' 
          : 'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-dashed border-border/30'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !showUrlInput && fileInputRef.current?.click()}
      data-testid="drop-zone-inspiration"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-upload"
      />
      <div className="flex flex-col items-center justify-center h-full px-4 gap-3">
        {showUrlInput ? (
          <div className="w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="Paste image or page URL"
              className="text-sm bg-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddUrl();
                if (e.key === 'Escape') {
                  setUrlValue('');
                  setShowUrlInput(false);
                }
              }}
              data-testid="input-inspiration-url"
            />
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={handleAddUrl} data-testid="button-add-url">
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUrlInput(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Plus className="w-5 h-5 transition-colors text-muted-foreground/40" />
            <div className="text-center space-y-0.5">
              <p className="text-xs font-medium transition-colors text-muted-foreground">
                Add inspiration
              </p>
              <p className="text-[10px] text-muted-foreground/40">
                Drop, paste, or click
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlInput(true);
              }}
              className="text-[10px] text-muted-foreground/40 hover:text-primary underline-offset-2 hover:underline transition-colors"
              data-testid="button-add-from-url"
            >
              Add from URL
            </button>
          </>
        )}
      </div>
    </div>
  );
}
