/**
 * RENIX vNext — Desktop Workspace Layout
 * 
 * RENIX Pane Interaction Contract implementation.
 * Desktop-only three-column layout with width-based pane animations.
 * Both AI (left) and Nav (right) panes collapse to icon-width strips.
 */

import { useState, useCallback, useRef, useEffect, createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const AI_PANE_DEFAULT_WIDTH = 360;
const AI_PANE_MIN_WIDTH = 280;
const AI_PANE_MAX_WIDTH = 600;
const AI_COLLAPSED_WIDTH = 48;
const NAV_EXPANDED_WIDTH = 160;
const NAV_COLLAPSED_WIDTH = 48;
const AI_WIDTH_STORAGE_KEY = 'renix-ai-pane-width';

interface DesktopLayoutContextValue {
  aiCollapsed: boolean;
  navCollapsed: boolean;
  aiWidth: number;
  toggleAICollapsed: () => void;
  toggleNavCollapsed: () => void;
  setAICollapsed: (collapsed: boolean) => void;
  setNavCollapsed: (collapsed: boolean) => void;
  setAIWidth: (width: number) => void;
}

const DesktopLayoutContext = createContext<DesktopLayoutContextValue | null>(null);

export function useDesktopLayout(): DesktopLayoutContextValue {
  const context = useContext(DesktopLayoutContext);
  if (!context) {
    throw new Error('useDesktopLayout must be used within DesktopWorkspaceLayout');
  }
  return context;
}

export function useDesktopLayoutSafe(): DesktopLayoutContextValue | null {
  return useContext(DesktopLayoutContext);
}

interface DesktopWorkspaceLayoutProps {
  header: ReactNode;
  aiPane: ReactNode;
  mainContent: ReactNode;
  navigationPane: ReactNode;
  defaultShowAI?: boolean;
  defaultShowNavigation?: boolean;
  showNavigationToggle?: boolean;
  hideNavigation?: boolean;
}

export function DesktopWorkspaceLayout({
  header,
  aiPane,
  mainContent,
  navigationPane,
  defaultShowAI = true,
  defaultShowNavigation = true,
  hideNavigation = false,
}: DesktopWorkspaceLayoutProps) {
  const [aiCollapsed, setAICollapsed] = useState(!defaultShowAI);
  const [navCollapsed, setNavCollapsed] = useState(!defaultShowNavigation);
  const [aiWidth, setAIWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(AI_WIDTH_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= AI_PANE_MIN_WIDTH && parsed <= AI_PANE_MAX_WIDTH) return parsed;
      }
    } catch {}
    return AI_PANE_DEFAULT_WIDTH;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    try { localStorage.setItem(AI_WIDTH_STORAGE_KEY, String(aiWidth)); } catch {}
  }, [aiWidth]);

  const toggleAICollapsed = useCallback(() => setAICollapsed(prev => !prev), []);
  const toggleNavCollapsed = useCallback(() => setNavCollapsed(prev => !prev), []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = aiWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      const newWidth = Math.min(AI_PANE_MAX_WIDTH, Math.max(AI_PANE_MIN_WIDTH, dragStartWidth.current + delta));
      setAIWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [aiWidth]);

  const contextValue: DesktopLayoutContextValue = {
    aiCollapsed,
    navCollapsed,
    aiWidth,
    toggleAICollapsed,
    toggleNavCollapsed,
    setAICollapsed,
    setNavCollapsed,
    setAIWidth,
  };

  return (
    <DesktopLayoutContext.Provider value={contextValue}>
      <div 
        ref={containerRef}
        className="h-screen w-screen overflow-hidden flex flex-col relative"
        data-testid="desktop-workspace-layout"
      >
        {/* Header - full width */}
        <div data-testid="layout-header">
          {header}
        </div>

        {/* Main workspace area - flex row with padding for floating cards */}
        <div className="flex-1 flex overflow-hidden p-3 gap-3 bg-muted/30">
          {/* AI Pane container - floating card, collapses to icon width */}
          <div className="relative flex-shrink-0">
            <div 
              className={cn(
                "overflow-hidden rounded-xl bg-background/80 backdrop-blur-sm shadow-sm h-full",
                !isResizing && "transition-[width] duration-200 ease-out"
              )}
              style={{ width: aiCollapsed ? AI_COLLAPSED_WIDTH : aiWidth }}
              data-testid="layout-ai-pane"
            >
              <div className="h-full">
                {aiPane}
              </div>
            </div>
            {!aiCollapsed && (
              <div
                className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-50 group"
                onMouseDown={handleResizeStart}
                data-testid="ai-pane-resize-handle"
              >
                <div className="absolute right-0 top-0 w-[2px] h-full bg-transparent group-hover:bg-primary/30 transition-colors duration-150" />
              </div>
            )}
          </div>

          {/* Frame Pane - always visible, flex-1, floating card */}
          <div 
            className="flex-1 overflow-hidden flex flex-col bg-background/80 backdrop-blur-sm rounded-xl shadow-sm"
            data-testid="layout-main-content"
          >
            {mainContent}
          </div>

          {!hideNavigation && (
            <div 
              className="overflow-hidden transition-[width] duration-200 ease-out rounded-xl bg-background/80 backdrop-blur-sm shadow-sm"
              style={{ width: navCollapsed ? NAV_COLLAPSED_WIDTH : NAV_EXPANDED_WIDTH }}
              data-testid="layout-navigation-pane"
            >
              <div className="h-full">
                {navigationPane}
              </div>
            </div>
          )}
        </div>
      </div>
    </DesktopLayoutContext.Provider>
  );
}

/**
 * Neutral Global Header wrapper
 */
interface DesktopHeaderProps {
  children?: ReactNode;
}

export function DesktopHeader({ children }: DesktopHeaderProps) {
  return (
    <header 
      className="h-14 w-full flex items-center px-4 border-b border-border/30 bg-muted/30"
      data-testid="desktop-header"
    >
      {children}
    </header>
  );
}

/**
 * Navigation Pane content wrapper
 */
interface NavigationPaneContentProps {
  children: ReactNode;
}

export function NavigationPaneContent({ children }: NavigationPaneContentProps) {
  return (
    <div className="h-full flex flex-col bg-muted/20">
      {children}
    </div>
  );
}

/**
 * AI Pane content wrapper
 */
interface AIPaneContentProps {
  children: ReactNode;
}

export function AIPaneContent({ children }: AIPaneContentProps) {
  return (
    <div className="h-full flex flex-col bg-muted/20">
      {children}
    </div>
  );
}

export default DesktopWorkspaceLayout;
