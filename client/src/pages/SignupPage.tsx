import { useState, useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useAuth, AUTH_ROUTES } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '../components/ThemeToggle';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AlertCircle, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { motion } from 'framer-motion';

const PLAN_INFO: Record<string, { name: string; price: string; perks: string[] }> = {
  pro: {
    name: 'Pro',
    price: '$29/mo',
    perks: ['Unlimited projects', 'Full AI companion', 'Advanced insights'],
  },
  team: {
    name: 'Team',
    price: '$79/mo',
    perks: ['Everything in Pro', 'Priority support', 'Dedicated account help'],
  },
};

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

export function SignupPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { signup, googleLogin } = useAuth();

  const selectedPlan = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const planId = params.get('plan');
    return planId && PLAN_INFO[planId] ? { id: planId, ...PLAN_INFO[planId] } : null;
  }, [searchString]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    const result = await signup(email, password, password, name);

    if (result.success) {
      setLocation(AUTH_ROUTES.projects);
    } else {
      setError(result.error || 'Signup failed');
    }

    setIsSubmitting(false);
  };

  const handleGoogleSignup = async (credential: string) => {
    setError(null);
    setIsSubmitting(true);
    const result = await googleLogin(credential);
    if (result.success) {
      setLocation(AUTH_ROUTES.projects);
    } else {
      setError(result.error || 'Google signup failed');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="h-full flex" data-testid="page-signup">
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
            {selectedPlan && (
              <div className="p-4 rounded-lg border border-border bg-muted/30 mb-2" data-testid="plan-indicator">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selected plan</span>
                  <span className="text-sm font-semibold text-foreground">{selectedPlan.name} — {selectedPlan.price}</span>
                </div>
                <ul className="space-y-1">
                  {selectedPlan.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-foreground shrink-0" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Create your account
              </h1>
              <p className="text-sm mt-2 text-muted-foreground">
                {selectedPlan ? `Sign up to start your ${selectedPlan.name} plan` : 'Set up your workspace to start managing projects'}
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

            <GoogleSignInButton onCredential={handleGoogleSignup} text="signup_with" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Your name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                  data-testid="input-name"
                />
              </div>

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
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
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

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isSubmitting}
                data-testid="button-signup"
              >
                {isSubmitting ? 'Creating account...' : (
                  <>Create account <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </form>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Already have an account?{' '}
              </span>
              <Link
                href={AUTH_ROUTES.login}
                className="text-sm font-medium hover:underline text-foreground"
                data-testid="link-signin"
              >
                Sign in
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

export default SignupPage;
