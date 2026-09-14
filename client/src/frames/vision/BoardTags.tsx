import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface BoardTagsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  disabled: boolean;
}

export function BoardTags({
  tags,
  onAdd,
  onRemove,
  disabled,
}: BoardTagsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleAdd = () => {
    if (newTag.trim()) {
      onAdd(newTag.trim());
      setNewTag('');
    }
    setIsAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      <span className="text-sm mr-1 text-secondary">Tags:</span>
      {tags.length > 0 ? (
        tags.map((tag, i) => (
          <span key={tag} className="flex items-center">
            <button
              onClick={() => !disabled && onRemove(tag)}
              className={`text-sm text-secondary ${disabled ? 'cursor-default' : 'hover:text-foreground hover:line-through cursor-pointer'} transition-colors`}
              disabled={disabled}
              data-testid={`tag-${tag}`}
            >
              {tag}
            </button>
            {i < tags.length - 1 && <span className="mx-1.5 text-muted">·</span>}
          </span>
        ))
      ) : (
        <span className="text-sm italic mr-1 text-muted">none</span>
      )}

      {!disabled && !isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-primary hover:underline ml-2"
          data-testid="button-add-tag"
        >
          + Add tag
        </button>
      )}

      {isAdding && (
        <div className="flex items-center gap-1 ml-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="warm, calm..."
            className="text-sm h-7 w-28"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setNewTag(''); setIsAdding(false); }
            }}
            data-testid="input-new-tag"
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleAdd}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
