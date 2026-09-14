import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { HeroDemo } from './HeroDemo';

export function HeroSection() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;

  return (
    <section id="hero-section" className="max-w-7xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="hero-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">AI-powered renovation management</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Your renovation,
            <br />
            <span className="text-muted-foreground">finally under control</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
            One AI-powered workspace for scope, budget, quotes, invoices, and every
            financial decision in your €200K+ renovation. AI does the heavy lifting —
            you stay in control.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {showAuthed ? (
              <Link href="/projects">
                <Button size="lg" className="gap-2" data-testid="button-hero-projects">
                  Go to My Projects <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href={AUTH_ROUTES.signup}>
                  <Button size="lg" className="gap-2" data-testid="button-hero-signup">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={AUTH_ROUTES.login}>
                  <Button variant="outline" size="lg" data-testid="button-hero-login">
                    Sign in
                  </Button>
                </Link>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">Free forever for one project. No credit card required.</p>
        </div>

        <div className="hero-fade-scale" style={{ animationDelay: '0.2s' }}>
          <HeroDemo />
        </div>
      </div>

      <style>{`
        .hero-fade-up {
          animation: heroFadeUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .hero-fade-scale {
          animation: heroFadeScale 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFadeScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-fade-up, .hero-fade-scale {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
