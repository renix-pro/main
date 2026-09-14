import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth, AUTH_ROUTES } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ThemeToggle } from '../components/ThemeToggle';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { motion } from 'framer-motion';

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, googleLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password, remember);

    if (result.success) {
      setLocation(AUTH_ROUTES.projects);
    } else {
      setError(result.error || 'Login failed');
    }

    setIsSubmitting(false);
  };

  const handleGoogleLogin = async (credential: string) => {
    setError(null);
    setIsSubmitting(true);
    const result = await googleLogin(credential);
    if (result.success) {
      setLocation(AUTH_ROUTES.projects);
    } else {
      setError(result.error || 'Google login failed');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="h-full flex" data-testid="page-login">
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
                Welcome back
              </h1>
              <p className="text-sm mt-2 text-muted-foreground">
                Sign in to continue managing your projects
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-md border border-destructive/20 bg-destructive/5 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-sm text-destructive">{error}</span>
              </motion.div>
            )}

            <GoogleSignInButton onCredential={handleGoogleLogin} text="signin_with" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </Label>
                  <Link
                    href={AUTH_ROUTES.resetPassword}
                    className="text-xs hover:underline text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  data-testid="checkbox-remember"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm cursor-pointer text-muted-foreground"
                >
                  Remember me
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isSubmitting}
                data-testid="button-login"
              >
                {isSubmitting ? 'Signing in...' : (
                  <>Sign in <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </form>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Don't have an account?{' '}
              </span>
              <Link
                href={AUTH_ROUTES.signup}
                className="text-sm font-medium hover:underline text-foreground"
                data-testid="link-signup"
              >
                Sign up
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
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { label: 'AI-Powered', desc: 'Document intelligence' },
              { label: '10 Frames', desc: 'Purpose-built views' },
              { label: 'Budget Control', desc: 'Real-time tracking' },
              { label: 'Quote Management', desc: 'Side-by-side comparison' },
            ].map(({ label, desc }) => (
              <div key={label} className="p-3 rounded-md bg-background/60 text-left">
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default LoginPage;
