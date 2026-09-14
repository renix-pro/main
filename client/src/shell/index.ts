/**
 * RENIX vNext — Shell Module Exports
 * 
 * Global Application Shell components.
 * Desktop-only three-column grid layout.
 */

export { GlobalShellBar } from './GlobalShellBar';
export { ProjectContextBar } from './ProjectContextBar';
export { ProjectWorkspace } from './ProjectWorkspace';
export { FrameNavigationPanel, NavigationProvider, FloatingNavToggle, useNavigation, useNavigationSafe } from './FrameNavigation';

export { AIConversationPane } from './AIConversationPane';

export { 
  DesktopWorkspaceLayout, 
  DesktopHeader, 
  NavigationPaneContent, 
  AIPaneContent,
  useDesktopLayout,
  useDesktopLayoutSafe
} from './DesktopWorkspaceLayout';

export { FrameNavigationContent } from './FrameNavigationContent';
export { FrameContainer } from './FrameContainer';

export { MobileWorkspaceLayout, useMobileLayout, useMobileLayoutSafe } from './MobileWorkspaceLayout';
export { MobileBottomDock, type MobileFrame } from './MobileBottomDock';
export { ResponsiveWorkspaceLayout } from './ResponsiveWorkspaceLayout';

