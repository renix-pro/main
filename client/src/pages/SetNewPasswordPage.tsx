import { useState, useMemo } from 'react';
import { Link, useSearch } from 'wouter';
import { AUTH_ROUTES } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '../components/ThemeToggle';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { motion } from 'framer-motion';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-status-declined' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-[var(--signal-warning)]' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-status-draft' };
  return { score, label: 'Strong', color: 'bg-status-approved' };
}

export function SetNewPasswordPage() {
  const searchString = useSearch();
  const token = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('token');
  }, [searchString]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to reset password');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }

    setIsSubmitting(false);
  };

  if (!token) {
    return (
      <div className="h-full flex" data-testid="page-set-new-password">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 no-underline" data-testid="link-home">
              <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
              <span className="text-sm font-semibold tracking-wide text-foreground">RENIX</span>
            </Link>
            <ThemeToggle />
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm space-y-6">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-md border border-destructive/20 bg-destructive/5 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive" data-testid="text-invalid-link">
                    Invalid reset link. Please request a new password reset.
                  </p>
                </div>
              </motion.div>
              <div className="text-center">
                <Link
                  href={AUTH_ROUTES.resetPassword}
                  className="text-sm font-medium hover:underline inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-request-reset"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Request password reset
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" data-testid="page-set-new-password">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 no-underline" data-testid="link-home">
            <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
            <span className="text-sm font-semibold tracking-wide text-foreground">RENIX</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-sm space-y-6"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Set new password
              </h1>
              <p className="text-sm mt-2 text-muted-foreground">
                Enter your new password below
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-md border border-destructive/20 bg-destructive/5 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-sm text-destructive" data-testid="text-error">{error}</span>
              </motion.div>
            )}

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-md border border-status-approved/20 bg-status-approved/5 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-status-approved shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid="text-success">
                      Your password has been reset successfully.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                      autoFocus
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      data-testid="button-toggle-password"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength.score ? strength.color : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{strength.label}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    autoComplete="new-password"
                    data-testid="input-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-set-password"
                >
                  {isSubmitting ? 'Resetting...' : 'Set new password'}
                </Button>
              </form>
            )}

            <div className="text-center">
              <Link
                href={AUTH_ROUTES.login}
                className="text-sm font-medium hover:underline inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-back-signin"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="hidden lg:flex w-[45%] bg-muted/30 items-center justify-center p-12 border-l border-border/50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-sm text-center space-y-6"
        >
          <div className="w-16 h-16 mx-auto rounded-xl bg-muted flex items-center justify-center">
            <img src={renixLogo} alt="" className="h-8 w-8 dark:invert" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              From vision to completion
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plan scope, track budgets, process quotes, and stay in control
              of every financial decision — all with an AI companion by your side.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default SetNewPasswordPage;
