/**
 * RENIX vNext — Frame Navigation Content
 * 
 * Matches reference design: Clean navigation with icons, pill-shaped active states
 * Supports collapsed mode (icon-only) with X/hamburger toggle.
 * Icons stay in a fixed-width column so collapse/expand only clips the label text.
 */

import { 
  LayoutDashboard, 
  Lightbulb, 
  ListChecks, 
  DollarSign, 
  FileText, 
  Landmark, 
  Hammer, 
  Receipt, 
  FolderOpen,
  X,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useProject } from '../context/ProjectContext';
import { FRAME_METADATA, type CanonicalFrame } from '../spine/appSpine';
import { isFrameVisible } from '../navigation/visibility';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDesktopLayoutSafe } from './DesktopWorkspaceLayout';

const ICON_COL_WIDTH = 48;

const FRAME_ICONS: Record<CanonicalFrame, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  vision: Lightbulb,
  scope: ListChecks,
  budget: DollarSign,
  quotes: FileText,
  financing: Landmark,
  execution: Hammer,
  invoices: Receipt,
  documents: FolderOpen,
};

interface FrameNavigationContentProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function FrameNavigationContent({ collapsed: collapsedProp, onToggleCollapse: onToggleProp }: FrameNavigationContentProps) {
  const { activeFrame, setActiveFrame, projectStatus, isReadOnly, projectName } = useProject();
  const layoutContext = useDesktopLayoutSafe();
  const [, setLocation] = useLocation();
  
  const collapsed = collapsedProp ?? layoutContext?.navCollapsed ?? false;
  const onToggleCollapse = onToggleProp ?? layoutContext?.toggleNavCollapsed;

  const handleFrameClick = (frame: CanonicalFrame, isDisabled: boolean) => {
    if (isDisabled) return;
    setActiveFrame(frame);
  };

  const frames: CanonicalFrame[] = [
    'overview', 'vision', 'scope', 'budget', 'quotes', 
    'financing', 'execution', 'invoices', 'documents'
  ];

  const projectNameButton = (
    <button
      onClick={() => setLocation('/projects')}
      className={cn(
        "w-full text-left rounded-xl mb-1 transition-colors",
        "flex items-center overflow-hidden group",
        "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
      )}
      title={collapsed ? projectName : `Back to projects — ${projectName}`}
      data-testid="nav-project-name"
    >
      <div
        className="flex items-center justify-center flex-shrink-0 py-2"
        style={{ width: ICON_COL_WIDTH - 8 }}
      >
        <ChevronLeft className="w-4 h-4 text-foreground/40 group-hover:text-foreground/70 transition-colors" />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
        {projectName}
      </span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-muted/20">
      <div className="h-12 flex items-center border-b border-border/30 flex-shrink-0">
        <div className="flex items-center w-full">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: ICON_COL_WIDTH }}
          >
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="flex items-center justify-center w-7 h-7 rounded-md text-foreground/60 hover:text-foreground transition-colors"
                title={collapsed ? "Expand navigation" : "Collapse navigation"}
                data-testid="button-toggle-nav-collapse"
              >
                {collapsed ? (
                  <Menu className="w-4 h-4" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <span className="text-sm font-medium text-foreground whitespace-nowrap overflow-hidden">
            Navigation
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-1">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {projectNameButton}
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              {projectName}
            </TooltipContent>
          </Tooltip>
        ) : (
          projectNameButton
        )}
        <div className="mx-2 my-1.5 border-b border-border/30" />
        {frames.map((frame) => {
          const isVisible = isFrameVisible(frame, projectStatus);
          const isActive = frame === activeFrame;
          const meta = FRAME_METADATA[frame];
          const isDisabled = false;
          const Icon = FRAME_ICONS[frame];

          if (!isVisible) return null;

          const button = (
            <button
              key={frame}
              onClick={() => handleFrameClick(frame, isDisabled)}
              disabled={isDisabled}
              className={cn(
                "w-full text-left rounded-xl mb-1 transition-colors",
                "flex items-center overflow-hidden",
                isActive && "bg-foreground text-background shadow-sm",
                !isActive && !isDisabled && "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                isDisabled && "opacity-40 cursor-not-allowed"
              )}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`nav-frame-${frame}`}
            >
              <div
                className="flex items-center justify-center flex-shrink-0 py-2.5"
                style={{ width: ICON_COL_WIDTH - 8 }}
              >
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-background" : "text-foreground/50"
                )} />
              </div>
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                {meta.label}
              </span>
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={frame} delayDuration={0}>
                <TooltipTrigger asChild>
                  {button}
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  {meta.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </div>
  );
}

export default FrameNavigationContent;
