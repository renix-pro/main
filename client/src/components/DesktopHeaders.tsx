import { useAuth } from "../auth";
import { Link, useLocation } from "wouter";
import { FolderKanban, LogOut, User } from "lucide-react";
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import { AUTH_ENABLED } from "../auth/config";

export function DesktopProjectHeader() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const userInitials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
  
  return (
    <header 
      className="h-12 w-full renix-glass renix-global-header flex items-center px-4"
      data-testid="desktop-project-header"
    >
      {/* LEFT: Logo area */}
      <Link href="/" className="flex items-center gap-1.5 no-underline" data-testid="link-renix-home">
        <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
        <span className="font-semibold tracking-wide text-foreground text-[18px]">
          RENIX
        </span>
      </Link>
      {/* CENTER: Empty flex */}
      <div className="flex-1" />
      {/* RIGHT: Theme toggle + User menu */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                data-testid="button-user-menu"
              >
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {userInitials}
                </div>
                <span className="text-sm hidden sm:inline text-foreground/80 font-normal">{user.name || user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                className="text-xs text-muted-foreground"
                disabled
              >
                {user.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-xs cursor-pointer"
                onClick={() => setLocation('/projects')}
                data-testid="menu-my-projects"
              >
                <FolderKanban className="w-3.5 h-3.5 mr-2" />
                My Projects
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-xs cursor-pointer"
                onClick={() => setLocation('/profile')}
                data-testid="menu-profile"
              >
                <User className="w-3.5 h-3.5 mr-2" />
                Profile
              </DropdownMenuItem>
              {AUTH_ENABLED && (
                <DropdownMenuItem 
                  onClick={logout}
                  className="text-xs cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    </header>
  );
}

/**
 * Neutral Global Header for Projects Area
 */
export function ProjectsAreaHeader() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const userInitials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
  
  return (
    <header 
      className="h-12 w-full renix-glass renix-global-header flex items-center px-4"
      data-testid="projects-area-header"
    >
      {/* LEFT: Logo area */}
      <Link href="/" className="flex items-center gap-1.5 no-underline" data-testid="link-renix-home">
        <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
        <span className="text-sm font-semibold tracking-wide text-foreground">
          RENIX
        </span>
      </Link>
      {/* CENTER: Empty flex */}
      <div className="flex-1" />
      {/* RIGHT: Theme toggle + User menu */}
      <div className="flex items-center gap-1 text-xs font-light">
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                data-testid="button-user-menu"
              >
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {userInitials}
                </div>
                <span className="text-sm hidden sm:inline text-foreground/80">{user.name || user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                className="text-xs text-muted-foreground"
                disabled
              >
                {user.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-xs cursor-pointer"
                onClick={() => setLocation('/projects')}
                data-testid="menu-my-projects"
              >
                <FolderKanban className="w-3.5 h-3.5 mr-2" />
                My Projects
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-xs cursor-pointer"
                onClick={() => setLocation('/profile')}
                data-testid="menu-profile"
              >
                <User className="w-3.5 h-3.5 mr-2" />
                Profile
              </DropdownMenuItem>
              {AUTH_ENABLED && (
                <DropdownMenuItem 
                  onClick={logout}
                  className="text-xs cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    </header>
  );
}