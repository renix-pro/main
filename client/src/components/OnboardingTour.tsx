import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../auth';

interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-testid="nav-frame-overview"]',
    title: 'Navigation Spine',
    description: 'Your project has 9 frames — from scope and budget to quotes and execution. Click any frame to jump there.',
    placement: 'left',
  },
  {
    target: '[data-testid="layout-ai-pane"], [data-testid="mobile-ai-fab"]',
    title: 'AI Companion',
    description: 'Upload contractor quotes or invoices here. The AI reads them, extracts line items and totals, and lets you confirm with one click. It\'s also your thinking partner for any project question.',
    placement: 'right',
  },
  {
    target: '[data-testid="frame-container"]',
    title: 'Work Surface',
    description: 'This is your active frame. You\'re starting in Overview — once you add scope and budget data, this becomes your project command center.',
    placement: 'bottom',
  },
  {
    target: '[data-testid="nav-frame-scope"]',
    title: 'Start with Scope',
    description: 'Define what\'s included in your renovation. Try a template to get started quickly, then customize as you go.',
    placement: 'left',
  },
  {
    target: '[data-testid="nav-frame-documents"]',
    title: 'Reference Library',
    description: 'Store contracts, permits, plans, and reference materials here. The AI can search these for context — but to process quotes and invoices, use the AI chat instead.',
    placement: 'left',
  },
];

const STORAGE_KEY_PREFIX = 'renix-onboarding-completed';

function getStorageKey(userId?: string) {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX;
}

const VP_PAD = 16;

function computeTooltipPosition(
  targetRect: DOMRect,
  placement: string,
  tw: number,
  th: number,
) {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  switch (placement) {
    case 'top':
      top = targetRect.top - gap - th;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      if (top < VP_PAD) {
        top = targetRect.bottom + gap;
      }
      break;
    case 'bottom':
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      if (top + th > vh - VP_PAD) {
        top = targetRect.top - gap - th;
      }
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.left - gap - tw;
      if (left < VP_PAD) {
        left = targetRect.right + gap;
      }
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.right + gap;
      if (left + tw > vw - VP_PAD) {
        left = targetRect.left - gap - tw;
      }
      break;
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
  }

  left = Math.max(VP_PAD, Math.min(left, vw - tw - VP_PAD));
  top = Math.max(VP_PAD, Math.min(top, vh - th - VP_PAD));

  return { top, left };
}

function findTargetElement(step: TourStep): Element | null {
  const selectors = step.target.split(', ');
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

export function OnboardingTour({ onComplete }: { onComplete?: () => void } = {}) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number>(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const storageKey = getStorageKey(user?.id);

  const tryStartTour = useCallback(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;

    const tryActivate = () => {
      attempts++;
      const firstTarget = findTargetElement(TOUR_STEPS[0]);
      if (firstTarget && !cancelled) {
        setCurrentStep(0);
        setIsActive(true);
      } else if (attempts < maxAttempts && !cancelled) {
        setTimeout(tryActivate, 500);
      }
    };

    const timer = setTimeout(tryActivate, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (completed) return;
    return tryStartTour();
  }, [storageKey, tryStartTour]);

  useEffect(() => {
    const unsub = onTourReactivate(() => {
      tryStartTour();
    });
    return unsub;
  }, [tryStartTour]);

  const positionTooltip = useCallback(() => {
    if (!isActive) return;
    const step = TOUR_STEPS[currentStep];
    const el = findTargetElement(step);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 6;
    setHighlightStyle({
      position: 'fixed',
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: '8px',
    });

    const tip = tooltipRef.current;
    const tw = tip ? tip.offsetWidth : 288;
    const th = tip ? tip.offsetHeight : 180;

    setTooltipStyle({
      position: 'fixed',
      ...computeTooltipPosition(rect, step.placement, tw, th),
      zIndex: 10002,
    });
  }, [isActive, currentStep]);

  useLayoutEffect(() => {
    if (!isActive) return;
    positionTooltip();
    requestAnimationFrame(positionTooltip);
  }, [isActive, currentStep, positionTooltip]);

  useEffect(() => {
    if (!isActive) return;
    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(positionTooltip);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, positionTooltip]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(storageKey, 'true');
    onComplete?.();
  }, [storageKey, onComplete]);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  }, [currentStep]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000]" data-testid="onboarding-tour">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={completeTour}
          data-testid="tour-backdrop"
        />

        <div
          className="absolute border-2 border-foreground/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
          style={highlightStyle}
          data-testid="tour-highlight"
        />

        <motion.div
          ref={tooltipRef}
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={tooltipStyle}
          className="w-72 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-lg shadow-xl p-4"
          data-testid={`tour-tooltip-${currentStep}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-foreground shrink-0" />
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
            </div>
            <button
              onClick={completeTour}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="tour-close"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {step.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={prev} className="h-7 px-2 text-xs" data-testid="tour-prev">
                  <ArrowLeft className="h-3 w-3 mr-1" /> Back
                </Button>
              )}
              <Button size="sm" onClick={next} className="h-7 px-3 text-xs" data-testid="tour-next">
                {isLast ? 'Done' : 'Next'} {!isLast && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
          <button
            onClick={completeTour}
            className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground mt-2 transition-colors"
            data-testid="tour-skip"
          >
            Skip tour
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const tourReactivateListeners = new Set<() => void>();

export function onTourReactivate(fn: () => void) {
  tourReactivateListeners.add(fn);
  return () => tourReactivateListeners.delete(fn);
}

export function useResetOnboarding() {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?.id);
  return useCallback(() => {
    localStorage.removeItem(storageKey);
    tourReactivateListeners.forEach(fn => fn());
  }, [storageKey]);
}
