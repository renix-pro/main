/**
 * RENIX vNext — Message Input Component
 * 
 * Input area with send button and file attachment support.
 */

import { type ChangeEvent, type FormEvent, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AttachedFile } from './types';

interface MessageInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  pendingAttachment: AttachedFile | null;
  onClearAttachment: () => void;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

export function MessageInput({
  inputValue,
  onInputChange,
  onSubmit,
  isLoading,
  isUploading,
  uploadProgress,
  pendingAttachment,
  onClearAttachment,
  onFileSelect,
  inputRef,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [inputRef]);

  useEffect(() => {
    autoResize();
  }, [inputValue, autoResize]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((inputValue.trim() || pendingAttachment) && !isLoading && !isUploading) {
        onSubmit(e as unknown as FormEvent);
      }
    }
  };

  return (
    <div className="p-4 border-t border-border/30 flex-shrink-0">
      {isUploading && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}
      
      {pendingAttachment && !isUploading && (
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {pendingAttachment.name.length > 25 
              ? pendingAttachment.name.slice(0, 22) + '...' 
              : pendingAttachment.name}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onClearAttachment}
            data-testid="button-clear-attachment"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      <form onSubmit={onSubmit} className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx"
          onChange={onFileSelect}
        />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isUploading}
          data-testid="button-attach-file"
          aria-label="Attach file"
        >
          <Paperclip className="w-4 h-4 text-muted-foreground" />
        </Button>
        
        <Textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          className="flex-1 min-h-[36px] max-h-[160px] resize-none py-2"
          rows={1}
          disabled={isLoading || isUploading}
          data-testid="input-ai-message"
        />
        
        <Button
          type="submit"
          size="icon"
          disabled={(!inputValue.trim() && !pendingAttachment) || isLoading || isUploading}
          data-testid="button-send-message"
          aria-label="Send message"
        >
          {isLoading ? (
            <RenixSpinner />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
