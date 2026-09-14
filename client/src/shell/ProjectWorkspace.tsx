/**
 * RENIX vNext — Project Workspace
 * 
 * Main workspace layout when inside a project.
 * 
 * STRUCTURE:
 * ┌──────────────────────────────────────────────┐
 * │ GLOBAL SHELL BAR                             │
 * ├──────────────────────────────────────────────┤
 * │ PROJECT CONTEXT BAR                          │
 * ├──────────────────────────────────────────────┤
 * │ FRAME NAV (LEFT) │ ACTIVE FRAME (RIGHT)      │
 * └──────────────────────────────────────────────┘
 * 
 * NAVIGATION BEHAVIOR (ChatGPT-style):
 * - Toggle button integrated into nav panel header
 * - FloatingNavToggle appears at left edge when nav is hidden
 * - Same behavior on all viewports
 * - Navigation visible by default
 * - When hidden: Content expands to full width, no residue
 */

import { GlobalShellBar } from './GlobalShellBar';
import { ProjectContextBar } from './ProjectContextBar';
import { NavigationProvider, FrameNavigationPanel, FloatingNavToggle, useNavigation } from './FrameNavigation';
import type { ReactNode } from 'react';

interface ProjectWorkspaceProps {
  children: ReactNode;
}

/**
 * Inner workspace component that can access navigation context
 */
function WorkspaceContent({ children }: ProjectWorkspaceProps) {
  const { isVisible } = useNavigation();
  
  return (
    <div 
      className="min-h-screen"
      data-testid="project-workspace"
    >
      <GlobalShellBar />
      <ProjectContextBar />
      
      {/* Fixed navigation panel */}
      <FrameNavigationPanel />
      
      {/* Floating nav toggle - rendered at document level for true fixed positioning */}
      <FloatingNavToggle />
      
      {/* Main content area - offset by nav width when nav is visible */}
      <main 
        className="min-h-[calc(100vh-88px)] overflow-auto transition-[margin] duration-150"
        style={{ 
          marginTop: '88px',
          marginLeft: isVisible ? '224px' : '0' // w-56 = 14rem = 224px
        }}
        data-testid="frame-content-area"
      >
        {children}
      </main>
    </div>
  );
}

export function ProjectWorkspace({ children }: ProjectWorkspaceProps) {
  return (
    <NavigationProvider>
      <WorkspaceContent>{children}</WorkspaceContent>
    </NavigationProvider>
  );
}

export default ProjectWorkspace;
