import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { ArrowRight } from 'lucide-react';

export function BottomCTA() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;

  return (
    <AnimatedSection>
      <section id="bottom-cta" className="max-w-3xl mx-auto px-6 py-20 text-center" data-testid="section-cta">
        <div className="renix-surface p-10 md:p-14">
          {showAuthed ? (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Welcome back{user?.name ? `, ${user.name}` : ''}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Pick up where you left off and keep your projects on track.
              </p>
              <Link href="/projects">
                <Button size="lg" className="gap-2" data-testid="button-cta-projects">
                  Go to My Projects <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Ready to take control of your project?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Create your free account and start managing your renovation today. No credit card required.
              </p>
              <Link href={AUTH_ROUTES.signup}>
                <Button size="lg" className="gap-2" data-testid="button-cta-signup">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>
    </AnimatedSection>
  );
}
