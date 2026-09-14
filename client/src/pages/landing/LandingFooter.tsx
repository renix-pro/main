import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { ArrowRight } from 'lucide-react';
import { clearCookieConsent } from '@/components/CookieConsent';

export function LandingFooter() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;

  return (
    <footer className="border-t border-border/40 bg-muted/10" data-testid="footer">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
              <span className="text-sm font-semibold text-foreground">RENIX</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Construction and renovation management, powered by AI.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-features">Features</a></li>
              <li><a href="#pricing" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-pricing">Pricing</a></li>
              <li><a href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-how-it-works">How it works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-privacy">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-terms">Terms of Service</Link></li>
              <li><button onClick={clearCookieConsent} className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="footer-link-cookie-settings">Cookie Settings</button></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RENIX. All rights reserved.
          </span>
          {!showAuthed && (
            <Link href={AUTH_ROUTES.signup}>
              <Button variant="ghost" size="sm" className="gap-2 text-xs" data-testid="footer-cta-signup">
                Get started free <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
