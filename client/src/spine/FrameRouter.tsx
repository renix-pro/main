/**
 * RENIX vNext — Frame Router
 * 
 * Canon v1.4 Compliant
 * 
 * Navigation ONLY. This component:
 * - Switches frames
 * - Enforces Overview as default
 * - Respects read-only state
 * - Lazy-loads each frame for per-frame code splitting (OPP-047)
 * - Background-preloads all frame chunks after initial render (OPP-047 enhancement)
 * - Priority-prefetches adjacent frames on navigation (OPP-047 enhancement)
 * 
 * This component does NOT:
 * - Suggest next steps
 * - Block frames
 * - Encode readiness logic
 * - Encode workflow logic
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { type CanonicalFrame } from './appSpine';
import { RenixLoader } from '../components/RenixLoader';
import { ErrorBoundary } from '../components/ErrorBoundary';

const OverviewFrame = lazy(() => import('../frames/overview/index'));
const VisionFrame = lazy(() => import('../frames/vision/index'));
const ScopeFrame = lazy(() => import('../frames/scope/index'));
const BudgetFrame = lazy(() => import('../frames/budget/index'));
const QuotesFrame = lazy(() => import('../frames/quotes/index'));
const InvoicesFrame = lazy(() => import('../frames/invoices/index'));
const FinancingFrame = lazy(() => import('../frames/financing/index'));
const ExecutionFrame = lazy(() => import('../frames/execution/index'));
const DocumentsFrame = lazy(() => import('../frames/documents/index'));

const FRAME_COMPONENTS: Record<CanonicalFrame, React.LazyExoticComponent<React.ComponentType>> = {
  overview: OverviewFrame,
  vision: VisionFrame,
  scope: ScopeFrame,
  budget: BudgetFrame,
  quotes: QuotesFrame,
  invoices: InvoicesFrame,
  financing: FinancingFrame,
  execution: ExecutionFrame,
  documents: DocumentsFrame,
};

const FRAME_IMPORTERS: Record<CanonicalFrame, () => Promise<unknown>> = {
  overview: () => import('../frames/overview/index'),
  vision: () => import('../frames/vision/index'),
  scope: () => import('../frames/scope/index'),
  budget: () => import('../frames/budget/index'),
  quotes: () => import('../frames/quotes/index'),
  invoices: () => import('../frames/invoices/index'),
  financing: () => import('../frames/financing/index'),
  execution: () => import('../frames/execution/index'),
  documents: () => import('../frames/documents/index'),
};

const ADJACENT_FRAMES: Record<CanonicalFrame, CanonicalFrame[]> = {
  overview: ['scope', 'budget', 'vision'],
  vision: ['overview', 'scope', 'documents'],
  scope: ['budget', 'quotes', 'overview'],
  budget: ['quotes', 'financing', 'scope'],
  quotes: ['invoices', 'budget', 'scope'],
  invoices: ['quotes', 'financing', 'budget'],
  financing: ['budget', 'invoices', 'execution'],
  execution: ['scope', 'budget', 'documents'],
  documents: ['vision', 'overview', 'quotes'],
};

const loadedFrames = new Set<CanonicalFrame>();
let preloadScheduled = false;

function preloadFrames() {
  if (preloadScheduled) return;
  preloadScheduled = true;

  const doPreload = () => {
    const frames = Object.keys(FRAME_IMPORTERS) as CanonicalFrame[];
    frames.forEach((frame) => {
      if (loadedFrames.has(frame)) return;
      FRAME_IMPORTERS[frame]()
        .then(() => { loadedFrames.add(frame); })
        .catch(() => {});
    });
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(doPreload, { timeout: 3000 });
  } else {
    setTimeout(doPreload, 200);
  }
}

function prefetchAdjacentFrames(current: CanonicalFrame) {
  const adjacent = ADJACENT_FRAMES[current];
  if (!adjacent) return;
  adjacent.forEach((frame) => {
    if (loadedFrames.has(frame)) return;
    FRAME_IMPORTERS[frame]()
      .then(() => { loadedFrames.add(frame); })
      .catch(() => {});
  });
}

const SPINNER_DELAY_MS = 150;

function FrameLoadingFallback() {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!showSpinner) {
    return <div className="h-full min-h-[200px]" data-testid="frame-loading" />;
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[200px]" data-testid="frame-loading">
      <RenixLoader size="xl" showLabel />
    </div>
  );
}

export function FrameRouter() {
  const { activeFrame } = useProject();
  
  useEffect(() => {
    preloadFrames();
  }, []);

  useEffect(() => {
    prefetchAdjacentFrames(activeFrame);
  }, [activeFrame]);

  const FrameComponent = FRAME_COMPONENTS[activeFrame] || OverviewFrame;
  
  return (
    <ErrorBoundary key={activeFrame}>
      <Suspense fallback={<FrameLoadingFallback />}>
        <FrameComponent />
      </Suspense>
    </ErrorBoundary>
  );
}

export default FrameRouter;
