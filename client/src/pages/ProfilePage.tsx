import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { GlobalShellBar } from '../shell/GlobalShellBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  FolderKanban,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfileProject {
  id: string;
  name: string;
  description: string | null;
  lifecycleState: string;
  createdAt: string;
}

interface ProfileData {
  user: { id: string; email: string; name: string };
  projects: ProfileProject[];
}

function getLifecycleBadge(state: string) {
  switch (state) {
    case 'ACTIVE':
      return <Badge variant="outline" className="text-xs" data-testid={`badge-state-${state}`}>Active</Badge>;
    case 'CLOSED':
      return <Badge variant="secondary" className="text-xs" data-testid={`badge-state-${state}`}>Completed</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs" data-testid={`badge-state-${state}`}>{state}</Badge>;
  }
}

export function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [, setLocation] = useLocation();

  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ['api', 'profile'],
  });

  const handleNameSave = async () => {
    if (!name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    setNameError(null);
    setNameSuccess(false);
    setNameSaving(true);

    const result = await updateProfile(name.trim());
    if (result.success) {
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } else {
      setNameError(result.error || 'Failed to update');
    }
    setNameSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError('Both fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordSaving(true);

    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(result.error || 'Failed to change password');
    }
    setPasswordSaving(false);
  };

  const nameChanged = name.trim() !== (user?.name || '');
  const projects = profileData?.projects || [];

  return (
    <div className="min-h-screen flex flex-col" data-testid="page-profile">
      <GlobalShellBar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              data-testid="button-back-projects"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Profile
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your account settings
              </p>
            </div>
          </div>

          <Card data-testid="card-display-name">
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium text-foreground">Display Name</h2>
              <p className="text-xs text-muted-foreground">
                This is how you appear across RENIX
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError(null);
                      setNameSuccess(false);
                    }}
                    placeholder="Your display name"
                    data-testid="input-display-name"
                  />
                </div>
                <Button
                  onClick={handleNameSave}
                  disabled={!nameChanged || nameSaving}
                  data-testid="button-save-name"
                >
                  {nameSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              {nameError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive flex items-center gap-1"
                  data-testid="text-name-error"
                >
                  <AlertCircle className="w-3 h-3" />
                  {nameError}
                </motion.p>
              )}
              {nameSuccess && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-status-approved flex items-center gap-1"
                  data-testid="text-name-success"
                >
                  <Check className="w-3 h-3" />
                  Name updated
                </motion.p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-email">
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium text-foreground">Email</h2>
              <p className="text-xs text-muted-foreground">
                Your login credential
              </p>
            </CardHeader>
            <CardContent>
              <Input
                value={user?.email || ''}
                disabled
                className="opacity-60"
                data-testid="input-email-readonly"
              />
            </CardContent>
          </Card>

          <Card data-testid="card-change-password">
            <CardHeader className="pb-3">
              <h2 className="text-sm font-medium text-foreground">Change Password</h2>
              <p className="text-xs text-muted-foreground">
                Update your account password
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-xs text-muted-foreground">
                    Current password
                  </Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordError(null);
                        setPasswordSuccess(false);
                      }}
                      autoComplete="current-password"
                      className="pr-10"
                      data-testid="input-current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      tabIndex={-1}
                      data-testid="button-toggle-current-password"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs text-muted-foreground">
                    New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError(null);
                        setPasswordSuccess(false);
                      }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="pr-10"
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      tabIndex={-1}
                      data-testid="button-toggle-new-password"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {passwordError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-destructive flex items-center gap-1"
                    data-testid="text-password-error"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {passwordError}
                  </motion.p>
                )}
                {passwordSuccess && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-status-approved flex items-center gap-1"
                    data-testid="text-password-success"
                  >
                    <Check className="w-3 h-3" />
                    Password changed successfully
                  </motion.p>
                )}
                <Button
                  type="submit"
                  disabled={!currentPassword || !newPassword || passwordSaving}
                  data-testid="button-change-password"
                >
                  {passwordSaving ? 'Changing...' : 'Change password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-foreground">My Projects</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Projects you own and manage
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FolderKanban className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-projects">No projects yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setLocation('/projects')}
                    data-testid="button-go-create-project"
                  >
                    Create your first project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {projects.map(project => (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setLocation(`/project/${project.id}`)}
                    data-testid={`card-project-${project.id}`}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {project.name}
                          </span>
                          {getLifecycleBadge(project.lifecycleState)}
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6 truncate">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
