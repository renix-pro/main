import { useQuery } from "@tanstack/react-query";
import { ProjectProvider, useProject } from "./context/ProjectContext";
import { FrameRouter } from "./spine/FrameRouter";
import { AIConversationPane, FrameNavigationContent, FrameContainer, ResponsiveWorkspaceLayout, type MobileFrame } from "./shell";
import { DesktopProjectHeader, ProjectsAreaHeader } from "./components/DesktopHeaders";
import { ProposalProvider } from "./shell/proposals";
import { useAuth } from "./auth";
import { getLastActiveProjectId } from "./persistence/sessionState";
import { AICompanionProvider } from "./shell/AICompanionContext";
import { OnboardingTour } from "./components/OnboardingTour";
import { WelcomeChooser } from "./components/WelcomeChooser";

import { useLocation, Redirect } from "wouter";
import { useCallback, useEffect, useState, type ReactNode } from "react";

let hasRestoredSession = false;
let projectRouteHasLoaded = false;

function ProjectWorkspaceWithAI({ children }: { children: ReactNode }) {
  const { projectName, activeFrame, lastMeaningfulUpdate, projectStatus, setActiveFrame } = useProject();
  const [, setLocation] = useLocation();
  const frameName = activeFrame.charAt(0).toUpperCase() + activeFrame.slice(1);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleTourComplete = useCallback(() => {
    setShowWelcome(true);
  }, []);

  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
  }, []);
  
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes}m ago`;
    if (hours < 24) return `Updated ${hours}h ago`;
    if (days === 1) return 'Updated yesterday';
    if (days < 7) return `Updated ${days} days ago`;
    if (days < 30) return `Updated ${Math.floor(days / 7)} weeks ago`;
    return `Updated ${Math.floor(days / 30)} months ago`;
  };
  
  const metadata = formatRelativeTime(lastMeaningfulUpdate ?? Date.now());

  const handleMobileFrameChange = (frame: MobileFrame) => {
    setActiveFrame(frame);
  };

  return (
    <>
      <ResponsiveWorkspaceLayout
        header={<DesktopProjectHeader />}
        aiPane={
          <AIConversationPane 
            projectName={projectName}
            frameName={frameName}
          />
        }
        mainContent={
          <FrameContainer
            projectName={projectName}
            frameName={frameName}
            metadata={metadata}
          >
            {children}
          </FrameContainer>
        }
        navigationPane={<FrameNavigationContent />}
        showNavigationToggle={false}
        projectName={projectName}
        frameName={frameName}
        activeFrame={activeFrame as MobileFrame}
        projectStatus={projectStatus}
        onFrameChange={handleMobileFrameChange}
      />
      <OnboardingTour onComplete={handleTourComplete} />
      {showWelcome && <WelcomeChooser onDismiss={handleWelcomeDismiss} />}
    </>
  );
}

export function ProjectsAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProposalProvider>
      <ResponsiveWorkspaceLayout
        header={<ProjectsAreaHeader />}
        aiPane={<AIConversationPane />}
        mainContent={
          <div className="h-full overflow-auto">
            {children}
          </div>
        }
        navigationPane={<div />}
        hideNavigation
        defaultShowNavigation={false}
        showNavigationToggle={false}
        projectName="RENIX"
        frameName="Projects"
      />
    </ProposalProvider>
  );
}

export function SessionRestoreRedirect() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: projectIds, isFetched, isError } = useQuery<string[]>({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
    staleTime: 30000,
    select: (data: unknown): string[] => {
      if (Array.isArray(data)) {
        return data.map((p: { id: string }) => p.id);
      }
      if (data && typeof data === 'object' && 'projects' in data) {
        const projects = (data as { projects: Array<{ id: string }> }).projects;
        return Array.isArray(projects) ? projects.map(p => p.id) : [];
      }
      return [];
    },
  });

  useEffect(() => {
    if (hasRestoredSession) return;
    if (authLoading) return;
    if (!isAuthenticated) {
      hasRestoredSession = true;
      return;
    }
    if (!isFetched) return;
    hasRestoredSession = true;
    if (isError || !projectIds || projectIds.length === 0) return;
    const lastProjectId = getLastActiveProjectId(user?.id);
    if (!lastProjectId) return;
    if (projectIds.includes(lastProjectId)) {
      setLocation(`/project/${lastProjectId}/overview`);
    }
  }, [isAuthenticated, authLoading, isFetched, isError, projectIds, setLocation, user]);

  return null;
}

export function ProjectRoute({ id, frame }: { id: string; frame: string }) {
  const isDirectEntry = !projectRouteHasLoaded;
  projectRouteHasLoaded = true;

  if (isDirectEntry && frame !== 'overview') {
    return (
      <Redirect to={`/project/${id}/overview`} />
    );
  }
  
  return (
    <ProjectProvider initialProject={{ projectId: id, activeFrame: frame as any }}>
      <ProposalProvider>
        <ProjectWorkspaceWithAI>
          <FrameRouter />
        </ProjectWorkspaceWithAI>
      </ProposalProvider>
    </ProjectProvider>
  );
}

export function WorkspaceProviders({ children }: { children: ReactNode }) {
  return (
    <AICompanionProvider>
      {children}
    </AICompanionProvider>
  );
}
