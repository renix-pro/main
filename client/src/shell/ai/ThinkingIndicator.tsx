import { useState, useEffect, useRef } from 'react';
import { AIAvatar } from './AIAvatar';

export type ThinkingContext = 'document_upload' | 'quote_comparison' | 'project_analysis' | 'general';

const STAGE_SEQUENCES: Record<ThinkingContext, string[]> = {
  document_upload: [
    'Reading your document...',
    'Extracting vendor and line items...',
    'Verifying totals...',
    'Almost ready...',
  ],
  quote_comparison: [
    'Loading quotes...',
    'Aligning line items...',
    'Analyzing differences...',
    'Preparing insights...',
  ],
  project_analysis: [
    'Scanning scope items...',
    'Checking budget allocation...',
    'Reviewing status...',
    'Composing analysis...',
  ],
  general: [
    'Thinking...',
    'Analyzing...',
    'Composing response...',
  ],
};

const STAGE_INTERVAL_MS = 800;

interface ThinkingIndicatorProps {
  context?: ThinkingContext;
}

export function ThinkingIndicator({ context = 'general' }: ThinkingIndicatorProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stages = STAGE_SEQUENCES[context];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStageIndex(0);
    setIsTransitioning(false);
  }, [context]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setStageIndex((prev) => {
          const next = prev + 1;
          return next < stages.length ? next : prev;
        });
        setIsTransitioning(false);
      }, 150);
    }, STAGE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stages.length, context]);

  const currentStage = stages[stageIndex];

  return (
    <div className="flex items-start gap-2.5" data-testid="thinking-indicator">
      <AIAvatar size="xs" className="mt-0.5" />
      <div className="flex items-center gap-1.5 py-0.5 min-h-[1.5rem]">
        <span
          className="text-sm text-muted-foreground transition-all duration-150 ease-in-out"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
          }}
          data-testid="thinking-stage-text"
        >
          {currentStage}
        </span>
        <span className="flex gap-0.5 items-center" data-testid="thinking-dots">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50"
              style={{
                animation: `thinkingDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
      </div>
      <style>{`
        @keyframes thinkingDotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(1); }
          40% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
