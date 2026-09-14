/**
 * RENIX vNext — Frame Navigation
 * 
 * AUTHORITATIVE IMPLEMENTATION (SIMPLIFIED)
 * 
 * Frame Navigation is CORE INFRASTRUCTURE.
 * It must be simple, explicit, and work identically across all viewports.
 * 
 * PRINCIPLES:
 * - Navigation must be obvious and recoverable at all times
 * - Hide / unhide is a single click or tap
 * - Desktop and mobile behavior is IDENTICAL
 * - No hidden gestures, no clever discovery mechanics
 * - Reliability beats novelty
 * 
 * FRAME GROUPS:
 * - CORE: Overview, Vision, Scope
 * - FINANCIALS: Budget, Quotes, Financing, Invoices
 * - DELIVERY: Execution, Documents
 * 
 * BEHAVIOR:
 * - Single toggle controls visibility (in Project Context Bar)
 * - Same behavior on desktop, tablet, and mobile
 * - Navigation visible by default on all viewports
 * 
 * EXPLICIT NON-GOALS:
 * - Pull-out lips
 * - Edge gestures
 * - Special mobile drawers
 * - Icon-only rails
 */

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useProject } from '../context/ProjectContext';
import { FRAME_METADATA, type CanonicalFrame } from '../spine/appSpine';
import { isFrameVisible } from '../navigation/visibility';
import { cn } from '@/lib/utils';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 640) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

interface FrameGroup {
  id: string;
  label: string;
  frames: CanonicalFrame[];
}

const FRAME_GROUPS: FrameGroup[] = [
  { id: 'core', label: 'Core', frames: ['overview', 'vision', 'scope'] },
  { id: 'financials', label: 'Financials', frames: ['budget', 'quotes', 'financing', 'invoices'] },
  { id: 'delivery', label: 'Delivery', frames: ['execution', 'documents'] },
];

interface NavigationContextValue {
  isVisible: boolean;
  viewportSize: ViewportSize;
  showNavigation: () => void;
  hideNavigation: () => void;
  toggleNavigation: () => void;
  hideOnSmallScreen: () => void;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

export function useNavigationSafe(): NavigationContextValue | null {
  return useContext(NavigationContext);
}

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getViewportSize);
  // Navigation visible by default on ALL viewports
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize(getViewportSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showNavigation = useCallback(() => setIsVisible(true), []);
  const hideNavigation = useCallback(() => setIsVisible(false), []);
  const toggleNavigation = useCallback(() => setIsVisible(prev => !prev), []);
  
  // Auto-hide on small screens (tablet/mobile) after frame selection
  const hideOnSmallScreen = useCallback(() => {
    if (viewportSize !== 'desktop') {
      setIsVisible(false);
    }
  }, [viewportSize]);

  return (
    <NavigationContext.Provider value={{ isVisible, viewportSize, showNavigation, hideNavigation, toggleNavigation, hideOnSmallScreen }}>
      {children}
    </NavigationContext.Provider>
  );
}

function NavigationContent() {
  const { activeFrame, setActiveFrame, projectStatus, isReadOnly, projectName } = useProject();
  const { hideOnSmallScreen } = useNavigation();
  const [, setLocation] = useLocation();

  const handleFrameClick = (frame: CanonicalFrame, isDisabled: boolean) => {
    if (isDisabled) return;
    setActiveFrame(frame);
    hideOnSmallScreen();
  };

  return (
    <div className="py-4 px-3">
      <button
        onClick={() => setLocation('/projects')}
        className="w-full px-2 pb-3 mb-2 border-b border-divider text-left group hover-elevate active-elevate-2 flex items-center gap-2"
        data-testid="nav-project-name"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground"
        >
          <path
            d="M10 4L6 8L10 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="text-sm font-semibold truncate text-foreground"
          title={projectName}
        >
          {projectName}
        </span>
      </button>

      {FRAME_GROUPS.map((group, groupIndex) => (
        <div 
          key={group.id}
          className={cn(groupIndex > 0 && "mt-4")}
        >
          <span 
            className="block px-2 mb-1 text-[10px] font-medium uppercase tracking-wider select-none text-muted-foreground"
          >
            {group.label}
          </span>
          
          {group.frames.map((frame) => {
            const isVisible = isFrameVisible(frame, projectStatus);
            const isActive = frame === activeFrame;
            const meta = FRAME_METADATA[frame];
            const isDisabled = false;

            if (!isVisible) return null;

            return (
              <button
                key={frame}
                onClick={() => handleFrameClick(frame, isDisabled)}
                disabled={isDisabled}
                className={cn(
                  "w-full px-2 py-1.5 text-left text-sm transition-colors duration-75",
                  "flex items-center gap-2",
                  isActive && "font-medium text-primary",
                  !isActive && !isDisabled && "hover-elevate text-secondary",
                  isDisabled && "opacity-40 cursor-not-allowed text-muted-foreground"
                )}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`nav-frame-${frame}`}
              >
                {isActive && (
                  <span 
                    className="w-1 h-1 flex-shrink-0 bg-primary"
                    aria-hidden="true"
                  />
                )}
                <span className={cn(!isActive && "ml-3")}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * FrameNavigationPanel
 * 
 * The navigation panel itself. Renders on the left side.
 * Toggle is now integrated INTO the panel itself (ChatGPT-style).
 * 
 * BEHAVIOR:
 * - When visible: side-by-side layout [Navigation | Content] with toggle at top
 * - When hidden: FloatingNavToggle shows at left edge
 * - Same on all viewports
 */
export function FrameNavigationPanel() {
  const { isVisible, toggleNavigation } = useNavigation();

  // TRUE HIDE: when hidden, return nothing (FloatingNavToggle handles re-opening)
  if (!isVisible) return null;

  return (
    <nav 
      className="w-56 border-r border-divider bg-panel overflow-y-auto transition-all duration-150 flex flex-col"
      style={{
        position: 'fixed',
        top: '88px', // GlobalShellBar (48px) + ProjectContextBar (40px)
        left: 0,
        bottom: 0,
        zIndex: 40
      }}
      aria-label="Frame navigation"
      aria-hidden={!isVisible}
      data-testid="frame-navigation"
    >
      {/* Header with integrated toggle */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-divider flex-shrink-0">
        <span 
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Navigation
        </span>
        <button
          onClick={toggleNavigation}
          className="w-7 h-7 flex items-center justify-center hover-elevate active-elevate-2 text-secondary"
          aria-label="Hide navigation"
          data-testid="button-collapse-navigation"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path 
              d="M10 4L6 8L10 12" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Navigation content */}
      <div className="flex-1 overflow-y-auto">
        <NavigationContent />
      </div>
    </nav>
  );
}

/**
 * FloatingNavToggle
 * 
 * A floating button at the top-right, just below the project context bar.
 * Clicking expands the navigation panel.
 */
export function FloatingNavToggle() {
  const { isVisible, toggleNavigation } = useNavigation();

  // Only show when navigation is hidden
  if (isVisible) return null;

  return (
    <button
      onClick={toggleNavigation}
      className="w-8 h-8 flex items-center justify-center hover-elevate active-elevate-2 text-secondary fixed z-[99998]"
      style={{ 
        top: '8px',
        left: '16px'
      }}
      aria-label="Show navigation"
      data-testid="button-expand-navigation"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path 
          d="M2 4H14M2 8H14M2 12H14" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Legacy NavigationToggle removed - toggle is now integrated into the panel itself
// Use FloatingNavToggle for re-opening when hidden

export default FrameNavigationPanel;
