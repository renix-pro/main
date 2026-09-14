import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Pencil } from 'lucide-react';

interface DesireStatementProps {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
}

export function DesireStatement({
  value,
  onChange,
  disabled,
}: DesireStatementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const handleSave = () => {
    onChange(draft.trim() || null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative rounded-lg border border-border bg-muted/30 p-3 md:p-5 space-y-2 md:space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--accent-copper)]" />
          <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-[var(--accent-copper)]">Your Vision</span>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="A warm, calm space that feels solid, natural, and easy to live in..."
          className="min-h-[72px] md:min-h-[100px] text-sm md:text-lg leading-relaxed resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 italic text-foreground/80 placeholder:text-muted-foreground/50"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value || '');
              setIsEditing(false);
            }
          }}
          data-testid="input-desire-statement"
        />
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} data-testid="button-save-desire">Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value || ''); setIsEditing(false); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setIsEditing(true)}
      className={`group text-left w-full rounded-lg transition-all ${
        disabled ? '' : 'hover:bg-muted/30 cursor-text'
      } ${value ? 'p-3 md:p-4' : 'p-3 md:p-4 border border-dashed border-border/40'}`}
      disabled={disabled}
      data-testid="button-edit-desire"
    >
      <div className="flex items-start gap-2 md:gap-3">
        <Sparkles className={`w-3.5 h-3.5 md:w-4 md:h-4 mt-0.5 md:mt-1 shrink-0 ${value ? 'text-[var(--accent-copper)]' : 'text-muted-foreground/40'}`} />
        <div className="flex-1 min-w-0">
          {value ? (
            <p className="text-sm md:text-base lg:text-lg italic leading-relaxed text-foreground/80 font-light">
              "{value}"
            </p>
          ) : (
            <p className="italic text-muted-foreground/60 text-sm md:text-base">
              What's the feeling you want this space to create?
            </p>
          )}
        </div>
        {!disabled && (
          <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 mt-1 md:mt-1.5 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
        )}
      </div>
    </button>
  );
}
