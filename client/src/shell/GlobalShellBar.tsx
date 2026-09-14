/**
 * RENIX vNext — Global Shell Bar
 * 
 * Fixed, always-visible top bar. App-level, immutable.
 * Never changes based on frame, project state, or data.
 * 
 * THREE-ZONE LAYOUT:
 * LEFT: Light/Dark mode toggle
 * CENTER: "RENIX" text (centered in viewport)
 * RIGHT: User menu
 * 
 * EXPLICIT EXCLUSIONS:
 * - No project name or switcher
 * - No navigation toggle (moved to Project Context Bar)
 * - No AI controls (AI will be floating element later)
 * - No alerts, badges, progress indicators
 * - No frame navigation, metrics, adaptive content
 * - No icons in center zone
 * 
 * This bar is intentionally restrained.
 * If it becomes informative, it has failed.
 */

import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserDropdownMenu } from '../components/UserDropdownMenu';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';

export function GlobalShellBar() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <header 
      className="h-12 w-full renix-glass renix-global-header"
      data-testid="global-shell-bar"
    >
      <div className="h-full px-4 flex items-center">
        <Link href="/" className="flex items-center gap-1.5 no-underline" data-testid="link-renix-home">
          <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
          <span className="text-sm font-semibold tracking-wide text-foreground">RENIX</span>
        </Link>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <UserDropdownMenu hideNameOnMobile />
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setLocation('/login')}
              data-testid="button-login"
            >
              <User className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default GlobalShellBar;
