/**
 * RENIX vNext — Application Root
 * 
 * DESKTOP-ONLY Three-Column Grid Layout:
 * 
 * ┌─────────────────────────────────────────────────────────┐
 * │                     HEADER (Row 1)                      │
 * ├──────────┬──────────────────────────┬───────────────────┤
 * │ AI PANE  │      MAIN FRAME          │   NAVIGATION      │
 * │ (LEFT)   │      (CENTER)            │   (RIGHT)         │
 * │ 320-420px│      1fr                 │   240-300px       │
 * └──────────┴──────────────────────────┴───────────────────┘
 * 
 * - No fixed positioning
 * - No overlapping elements  
 * - Collapsible AI and Navigation panes
 */

import { queryClient, setMutationErrorHandler, ApiError } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider, ProtectedRoute, AuthRoute } from "./auth";

import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RenixLoader } from "@/components/RenixLoader";
import { CookieConsent } from "@/components/CookieConsent";

const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SetNewPasswordPage = lazy(() => import("./pages/SetNewPasswordPage"));
const UICatalogPage = lazy(() => import("./pages/UICatalogPage"));
const DesignPreviewPage = lazy(() => import("./pages/DesignPreviewPage"));
const LandingPage = lazy(() => import("./pages/landing"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));

const WorkspaceShell = lazy(() => import("./WorkspaceShell").then(m => ({
  default: m.WorkspaceProviders,
})));
const ProjectsAreaLayout = lazy(() => import("./WorkspaceShell").then(m => ({
  default: m.ProjectsAreaLayout,
})));
const SessionRestoreRedirect = lazy(() => import("./WorkspaceShell").then(m => ({
  default: m.SessionRestoreRedirect,
})));
const ProjectRoute = lazy(() => import("./WorkspaceShell").then(m => ({
  default: m.ProjectRoute,
})));

function AuthAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full">
      {children}
    </div>
  );
}

function PageLoadingFallback() {
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <RenixLoader size="xl" showLabel />
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoadingFallback />}>
    <Switch>
      <Route path="/login">
        <AuthRoute>
          <AuthAreaLayout>
            <LoginPage />
          </AuthAreaLayout>
        </AuthRoute>
      </Route>
      <Route path="/signup">
        <AuthRoute>
          <AuthAreaLayout>
            <SignupPage />
          </AuthAreaLayout>
        </AuthRoute>
      </Route>
      <Route path="/set-new-password">
        <AuthAreaLayout>
          <SetNewPasswordPage />
        </AuthAreaLayout>
      </Route>
      <Route path="/reset-password">
        <AuthRoute>
          <AuthAreaLayout>
            <ResetPasswordPage />
          </AuthAreaLayout>
        </AuthRoute>
      </Route>

      <Route path="/ui-catalog">
        <UICatalogPage />
      </Route>
      <Route path="/design-preview">
        <DesignPreviewPage />
      </Route>

      <Route path="/privacy">
        <PrivacyPolicyPage />
      </Route>
      <Route path="/terms">
        <TermsOfServicePage />
      </Route>

      <Route path="/">
        <LandingPage />
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/projects">
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingFallback />}>
            <WorkspaceShell>
              <SessionRestoreRedirect />
              <ProjectsAreaLayout>
                <ProjectsPage />
              </ProjectsAreaLayout>
            </WorkspaceShell>
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/project/:id">
        {(params) => <Redirect to={`/project/${params.id}/overview`} />}
      </Route>
      <Route path="/project/:id/:frame">
        {(params) => (
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <WorkspaceShell>
                <ProjectRoute id={params.id} frame={params.frame} />
              </WorkspaceShell>
            </Suspense>
          </ProtectedRoute>
        )}
      </Route>

      <Route>
        <ProtectedRoute>
          <Suspense fallback={<PageLoadingFallback />}>
            <WorkspaceShell>
              <ProjectsAreaLayout>
                <ProjectsPage />
              </ProjectsAreaLayout>
            </WorkspaceShell>
          </Suspense>
        </ProtectedRoute>
      </Route>
    </Switch>
    </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Turns failed mutations into a toast. Without this, a rejected write (most
 * visibly a 403 on a closed, read-only project) failed silently and the UI
 * looked as though the change had been saved.
 */
function MutationErrorToaster() {
  const { toast } = useToast();

  useEffect(() => {
    setMutationErrorHandler((error) => {
      if (error instanceof ApiError && error.isProjectClosed) {
        toast({
          title: 'Project is closed',
          description: 'This project is read-only. Reopen it to make changes.',
          variant: 'destructive',
        });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        toast({
          title: 'Signed out',
          description: 'Your session expired. Please sign in again.',
          variant: 'destructive',
        });
        return;
      }
      const description = error instanceof Error ? error.message : 'Something went wrong.';
      toast({ title: "Couldn't save changes", description, variant: 'destructive' });
    });
    return () => setMutationErrorHandler(null);
  }, [toast]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div id="renix-bg" />
          <div id="renix-app">
            <AuthProvider>
              <Router />
            </AuthProvider>
            <MutationErrorToaster />
            <Toaster />
            <CookieConsent />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
