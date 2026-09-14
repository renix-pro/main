import { useAuth } from '../auth/AuthContext';
import { AUTH_ENABLED } from '../auth/config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, FolderKanban } from 'lucide-react';
import { useLocation } from 'wouter';

interface UserDropdownMenuProps {
  hideNameOnMobile?: boolean;
}

export function UserDropdownMenu({ hideNameOnMobile = false }: UserDropdownMenuProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const nameClass = hideNameOnMobile
    ? 'text-sm hidden sm:inline text-foreground/80'
    : 'text-sm text-foreground/80';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="button-user-menu"
        >
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            {initials}
          </div>
          <span className={nameClass}>{user.name || user.email}</span>
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
  );
}
