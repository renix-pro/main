import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { AUTH_ENABLED } from '../../auth/config';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { UserDropdownMenu } from '../../components/UserDropdownMenu';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { useState } from 'react';
import { X, Menu } from 'lucide-react';

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <img src={renixLogo} alt="RENIX" className="h-6 w-6 dark:invert" />
          <span className="text-lg font-semibold tracking-tight text-foreground">RENIX</span>
        </div>

        <nav className="hidden md:flex items-center gap-2 bg-muted/50 dark:bg-muted/30 rounded-full px-1.5 py-1">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-1.5 rounded-full hover:bg-background/80" data-testid="nav-features">Features</a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-1.5 rounded-full hover:bg-background/80" data-testid="nav-how-it-works">How it works</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-1.5 rounded-full hover:bg-background/80" data-testid="nav-pricing">Pricing</a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-3">
            {showAuthed ? (
              <>
                <UserDropdownMenu />
                <Link href="/projects">
                  <Button size="sm" data-testid="link-dashboard-header">
                    My Projects
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href={AUTH_ROUTES.login}>
                  <Button variant="ghost" size="sm" data-testid="link-login-header">
                    Sign in
                  </Button>
                </Link>
                <Link href={AUTH_ROUTES.signup}>
                  <Button size="sm" data-testid="link-signup-header">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background header-menu-enter">
          <div className="px-6 py-4 space-y-3">
            <a href="#features" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-features">Features</a>
            <a href="#how-it-works" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-how-it-works">How it works</a>
            <a href="#pricing" className="block text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-nav-pricing">Pricing</a>
            <div className="pt-3 border-t border-border/40 flex flex-col gap-2">
              {showAuthed ? (
                <>
                  <Link href="/projects">
                    <Button size="sm" className="w-full" data-testid="mobile-link-projects">My Projects</Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="ghost" size="sm" className="w-full" data-testid="mobile-link-profile">Profile</Button>
                  </Link>
                  {AUTH_ENABLED && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={logout} data-testid="mobile-button-logout">
                      Sign out
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Link href={AUTH_ROUTES.login}>
                    <Button variant="ghost" size="sm" className="w-full" data-testid="mobile-link-login">Sign in</Button>
                  </Link>
                  <Link href={AUTH_ROUTES.signup}>
                    <Button size="sm" className="w-full" data-testid="mobile-link-signup">Get started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .header-menu-enter {
          animation: menuSlideDown 0.2s ease-out;
        }
        @keyframes menuSlideDown {
          from { opacity: 0; max-height: 0; overflow: hidden; }
          to { opacity: 1; max-height: 400px; overflow: hidden; }
        }
        @media (prefers-reduced-motion: reduce) {
          .header-menu-enter { animation: none !important; }
        }
      `}</style>
    </header>
  );
}
