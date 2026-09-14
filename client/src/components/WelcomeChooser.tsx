import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Target, MessageSquareText, Wallet } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useAICompanion } from '@/shell/AICompanionContext';
import type { CanonicalFrame } from '../spine/appSpine';

const STORAGE_KEY_PREFIX = 'renix-welcome-shown';

function getStorageKey(projectId: string) {
  return `${STORAGE_KEY_PREFIX}-${projectId}`;
}

const CHOICES = [
  {
    id: 'scope',
    icon: Target,
    title: 'Define your scope',
    description: 'Pick a template or start from scratch to outline what your renovation includes.',
    frame: 'scope' as CanonicalFrame,
    testId: 'welcome-choice-scope',
  },
  {
    id: 'quote',
    icon: MessageSquareText,
    title: 'Upload a quote to AI',
    description: 'The AI reads your contractor quotes, extracts every line item, and lets you confirm.',
    frame: null,
    testId: 'welcome-choice-quote',
  },
  {
    id: 'budget',
    icon: Wallet,
    title: 'Set a budget',
    description: 'Define your target budget so RENIX can track costs and alert you early.',
    frame: 'budget' as CanonicalFrame,
    testId: 'welcome-choice-budget',
  },
];

export function WelcomeChooser({ onDismiss }: { onDismiss: () => void }) {
  const { projectId, setActiveFrame } = useProject();
  const { open: openAI } = useAICompanion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = getStorageKey(projectId);
    const shown = localStorage.getItem(key);
    if (!shown) {
      setVisible(true);
    }
  }, [projectId]);

  const handleChoice = useCallback((choice: typeof CHOICES[0]) => {
    const key = getStorageKey(projectId);
    localStorage.setItem(key, 'true');
    setVisible(false);

    if (choice.frame) {
      setActiveFrame(choice.frame);
    } else {
      openAI();
    }
    onDismiss();
  }, [projectId, setActiveFrame, openAI, onDismiss]);

  const handleDismiss = useCallback(() => {
    const key = getStorageKey(projectId);
    localStorage.setItem(key, 'true');
    setVisible(false);
    onDismiss();
  }, [projectId, onDismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-6"
        onClick={handleDismiss}
        data-testid="welcome-chooser-overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full md:max-w-lg bg-background border border-border rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden"
          data-testid="welcome-chooser-panel"
        >
          <div className="p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-lg md:text-xl font-semibold text-foreground" data-testid="text-welcome-title">
                Where would you like to start?
              </h2>
              <p className="text-sm text-muted-foreground" data-testid="text-welcome-body">
                Pick one to dive in — you can always do the others later.
              </p>
            </div>

            <div className="space-y-3">
              {CHOICES.map((choice) => {
                const Icon = choice.icon;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleChoice(choice)}
                    className="w-full renix-surface p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer"
                    data-testid={choice.testId}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{choice.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{choice.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
                data-testid="button-welcome-dismiss"
              >
                I'll explore on my own
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
