/**
 * RENIX vNext — AI Companion Panel
 * 
 * Slide-in panel anchored to RIGHT edge of screen.
 * 
 * BEHAVIOR:
 * - Opens when AI button in Global Shell Bar is clicked
 * - Closes only via explicit user action
 * - Never modal, NEVER blocks navigation
 * - Persists across frame changes
 * 
 * PROPERTIES:
 * - Fixed width (320px)
 * - Overlays content (does not push)
 * - Context-aware (frame + project) when inside project
 * 
 * CONTENT (PLACEHOLDER ONLY):
 * - Header: "AI Companion"
 * - Sections: Context, Analysis, Options
 * 
 * DO NOT implement:
 * - Chat behavior, intelligence, auto-suggestions, notifications
 * 
 * This is placement, persistence, and structure ONLY.
 */

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AICompanionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  frameName?: string;
}

export function AICompanionPanel({ isOpen, onClose, projectName, frameName }: AICompanionPanelProps) {
  return (
    <aside
      className={cn(
        "fixed top-12 right-0 bottom-0 w-80 bg-panel border-l border-divider z-50",
        "transform transition-transform duration-200 ease-out shadow-lg",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      aria-label="AI Companion"
      aria-hidden={!isOpen}
      data-testid="ai-companion-panel"
    >
      <div className="h-full flex flex-col">
        <header className="h-12 px-4 flex items-center justify-between border-b border-divider flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent-primary" />
            <span 
              className="text-sm font-medium text-foreground"
            >
              AI Companion
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={onClose}
            data-testid="button-close-ai-panel"
          >
            <X className="w-4 h-4" />
          </Button>
        </header>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <section>
              <h3 
                className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground"
              >
                Context
              </h3>
              <div 
                className="text-sm space-y-1 text-secondary"
              >
                <div className="flex justify-between">
                  <span>Project</span>
                  <span className="text-foreground">
                    {projectName || 'No project selected'}
                  </span>
                </div>
                {frameName && (
                  <div className="flex justify-between">
                    <span>Frame</span>
                    <span className="text-foreground">{frameName}</span>
                  </div>
                )}
              </div>
            </section>
            
            <section>
              <h3 
                className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground"
              >
                Analysis
              </h3>
              <p 
                className="text-sm text-secondary"
              >
                {projectName 
                  ? 'Frame-specific analysis will appear here based on current context and data state.'
                  : 'Select a project to enable contextual analysis.'}
              </p>
            </section>
            
            <section>
              <h3 
                className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground"
              >
                Options
              </h3>
              <p 
                className="text-sm text-secondary"
              >
                Available AI actions and proposals will be listed here.
              </p>
            </section>
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

export default AICompanionPanel;
