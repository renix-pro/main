/**
 * RENIX vNext — Mobile Workspace Layout
 * 
 * AI-First mobile layout:
 * - Full-screen AI conversation as default view
 * - Frames shown as full-screen overlays
 * - Bottom dock for quick frame navigation
 * - Floating AI button when viewing frames
 */

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { ArrowLeft, Sparkles, Menu, FolderKanban, LogOut, Moon, Sun, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { MobileBottomDock, type MobileFrame } from './MobileBottomDock';
import { FRAME_METADATA, type CanonicalFrame } from '../spine/appSpine';
import { useAuth } from '@/auth';
import { useTheme } from '@/components/ThemeProvider';
import { AUTH_ENABLED } from '@/auth/config';
import { Link, useLocation } from 'wouter';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';

interface MobileLayoutContextValue {
  currentView: 'ai' | 'frame';
  activeFrame: MobileFrame;
  showAI: () => void;
  showFrame: (frame: MobileFrame) => void;
  setActiveFrame: (frame: MobileFrame) => void;
}

const MobileLayoutContext = createContext<MobileLayoutContextValue | null>(null);

export function useMobileLayout(): MobileLayoutContextValue {
  const context = useContext(MobileLayoutContext);
  if (!context) {
    throw new Error('useMobileLayout must be used within MobileWorkspaceLayout');
  }
  return context;
}

export function useMobileLayoutSafe(): MobileLayoutContextValue | null {
  return useContext(MobileLayoutContext);
}

interface MobileWorkspaceLayoutProps {
  projectName?: string;
  aiPane: ReactNode;
  frameContent: ReactNode;
  frameName?: string;
  initialFrame?: MobileFrame;
  projectStatus?: 'open' | 'closed';
  onFrameChange?: (frame: MobileFrame) => void;
}

export function MobileWorkspaceLayout({
  projectName = 'Project',
  aiPane,
  frameContent,
  frameName = 'Overview',
  initialFrame = 'overview',
  projectStatus = 'open',
  onFrameChange,
}: MobileWorkspaceLayoutProps) {
  const [currentView, setCurrentView] = useState<'ai' | 'frame'>('frame');
  const [activeFrame, setActiveFrameState] = useState<MobileFrame>(initialFrame);

  const showAI = useCallback(() => {
    setCurrentView('ai');
  }, []);

  const showFrame = useCallback((frame: MobileFrame) => {
    setActiveFrameState(frame);
    setCurrentView('frame');
    onFrameChange?.(frame);
  }, [onFrameChange]);

  const setActiveFrame = useCallback((frame: MobileFrame) => {
    setActiveFrameState(frame);
    onFrameChange?.(frame);
  }, [onFrameChange]);

  const handleFrameChange = useCallback((frame: MobileFrame) => {
    showFrame(frame);
  }, [showFrame]);

  const contextValue: MobileLayoutContextValue = {
    currentView,
    activeFrame,
    showAI,
    showFrame,
    setActiveFrame,
  };

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const userInitials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '';

  return (
    <MobileLayoutContext.Provider value={contextValue}>
      <div 
        className="mobile-viewport-height w-screen overflow-hidden flex flex-col bg-background"
        data-testid="mobile-workspace-layout"
      >
        {/* Mobile Header */}
        <header 
          className="min-h-[3.25rem] flex items-center justify-between px-4 border-b border-border/30 bg-muted shrink-0 safe-area-top"
          data-testid="mobile-header"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href="/" className="shrink-0 no-underline" data-testid="link-renix-home-mobile">
              <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
            </Link>
            {currentView === 'ai' && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2"
                onClick={() => showFrame(activeFrame)}
                data-testid="mobile-back-button"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-sm font-semibold text-foreground truncate">
                {projectName}
              </span>
              {activeFrame in FRAME_METADATA && (
                <>
                  <span className="text-muted-foreground/50 text-xs shrink-0">·</span>
                  <span className="text-xs text-muted-foreground truncate" data-testid="mobile-header-frame">
                    {FRAME_METADATA[activeFrame as CanonicalFrame].label}
                  </span>
                </>
              )}
            </div>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-4 pb-0">
                <SheetTitle className="text-left text-sm font-medium text-muted-foreground">Menu</SheetTitle>
              </SheetHeader>

              {user && (
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border/50 shrink-0">
                    <span className="text-sm font-medium text-foreground">
                      {userInitials || <User className="w-4 h-4" />}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              )}

              <Separator />

              <nav className="flex flex-col py-2">
                <button
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover-elevate transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    setLocation('/projects');
                  }}
                  data-testid="mobile-menu-projects"
                >
                  <FolderKanban className="w-4 h-4 text-muted-foreground" />
                  My Projects
                </button>

                <button
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover-elevate transition-colors"
                  onClick={() => {
                    toggleTheme();
                  }}
                  data-testid="mobile-menu-theme"
                >
                  {theme === 'light' ? (
                    <Moon className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Sun className="w-4 h-4 text-muted-foreground" />
                  )}
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>

                {AUTH_ENABLED && (
                  <>
                    <Separator className="my-2" />
                    <button
                      className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover-elevate transition-colors"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      data-testid="mobile-menu-logout"
                    >
                      <LogOut className="w-4 h-4 text-muted-foreground" />
                      Sign Out
                    </button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Frame Content */}
          <div 
            className={cn(
              "absolute inset-0 transition-transform duration-300 ease-out",
              currentView === 'frame' ? "translate-x-0" : "translate-x-full"
            )}
            data-testid="mobile-frame-content"
          >
            <div className="h-full overflow-auto" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.25rem)' }}>
              {frameContent}
            </div>
          </div>

          {/* AI Pane */}
          <div 
            className={cn(
              "absolute inset-0 transition-transform duration-300 ease-out bg-background",
              currentView === 'ai' ? "translate-x-0" : "-translate-x-full"
            )}
            data-testid="mobile-ai-pane"
          >
            <div className="h-full pb-20">
              {aiPane}
            </div>
          </div>

          {/* Floating AI Button (visible when viewing frame) */}
          {currentView === 'frame' && (
            <Button
              variant="default"
              size="icon"
              className="fixed right-4 h-12 w-12 rounded-full shadow-lg z-40"
              style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
              onClick={showAI}
              data-testid="mobile-ai-fab"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Bottom Dock */}
        <MobileBottomDock
          activeFrame={activeFrame}
          onFrameChange={handleFrameChange}
          projectStatus={projectStatus}
        />
      </div>
    </MobileLayoutContext.Provider>
  );
}

export default MobileWorkspaceLayout;
