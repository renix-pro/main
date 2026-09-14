import { useState } from 'react';
import { Link } from 'wouter';
import { useAuth, AUTH_ROUTES } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '../components/ThemeToggle';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { motion } from 'framer-motion';

export function ResetPasswordPage() {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await requestPasswordReset(email);

    if (result.success) {
      setSuccess(true);
      setSuccessMessage(result.message || null);
    } else {
      setError(result.error || 'Request failed');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="h-full flex" data-testid="page-reset-password">
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
                Reset password
              </h1>
              <p className="text-sm mt-2 text-muted-foreground">
                Enter your email to request a password reset
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

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-md border border-status-approved/20 bg-status-approved/5 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-status-approved shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid="text-reset-message">
                      {successMessage || 'If an account exists with that email, we\'ve sent a password reset link. Check your inbox.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
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
                    autoFocus
                    data-testid="input-email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-reset"
                >
                  {isSubmitting ? 'Submitting...' : 'Request reset'}
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

export default ResetPasswordPage;
