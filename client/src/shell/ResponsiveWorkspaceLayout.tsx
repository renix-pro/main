/**
 * RENIX vNext — Responsive Workspace Layout
 * 
 * Wrapper component that renders:
 * - DesktopWorkspaceLayout for viewports ≥768px
 * - MobileWorkspaceLayout for viewports <768px
 * 
 * This ensures the desktop experience remains completely unchanged
 * while providing an optimized mobile experience.
 */

import { type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { DesktopWorkspaceLayout } from './DesktopWorkspaceLayout';
import { MobileWorkspaceLayout } from './MobileWorkspaceLayout';
import type { MobileFrame } from './MobileBottomDock';

interface ResponsiveWorkspaceLayoutProps {
  // Desktop props
  header: ReactNode;
  aiPane: ReactNode;
  mainContent: ReactNode;
  navigationPane: ReactNode;
  defaultShowAI?: boolean;
  defaultShowNavigation?: boolean;
  showNavigationToggle?: boolean;
  hideNavigation?: boolean;
  
  // Mobile props
  projectName?: string;
  frameName?: string;
  activeFrame?: MobileFrame;
  projectStatus?: 'open' | 'closed';
  onFrameChange?: (frame: MobileFrame) => void;
}

export function ResponsiveWorkspaceLayout({
  // Desktop props
  header,
  aiPane,
  mainContent,
  navigationPane,
  defaultShowAI = true,
  defaultShowNavigation = true,
  showNavigationToggle = true,
  hideNavigation = false,
  
  // Mobile props
  projectName,
  frameName,
  activeFrame = 'overview',
  projectStatus = 'open',
  onFrameChange,
}: ResponsiveWorkspaceLayoutProps) {
  const isMobile = useIsMobile();

  // On mobile, render the MobileWorkspaceLayout
  if (isMobile) {
    return (
      <MobileWorkspaceLayout
        projectName={projectName}
        aiPane={aiPane}
        frameContent={mainContent}
        frameName={frameName}
        initialFrame={activeFrame}
        projectStatus={projectStatus}
        onFrameChange={onFrameChange}
      />
    );
  }

  // On desktop, render the DesktopWorkspaceLayout (unchanged)
  return (
    <DesktopWorkspaceLayout
      header={header}
      aiPane={aiPane}
      mainContent={mainContent}
      navigationPane={navigationPane}
      defaultShowAI={defaultShowAI}
      defaultShowNavigation={defaultShowNavigation}
      showNavigationToggle={showNavigationToggle}
      hideNavigation={hideNavigation}
    />
  );
}

export default ResponsiveWorkspaceLayout;
