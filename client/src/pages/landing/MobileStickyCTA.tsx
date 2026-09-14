import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function MobileStickyCTA() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;
  const [pastHero, setPastHero] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);
  const everShown = useRef(false);

  const shouldShow = pastHero && !nearBottom;
  if (shouldShow) everShown.current = true;

  useEffect(() => {
    const hero = document.getElementById('hero-section');
    const bottomCta = document.getElementById('bottom-cta');
    if (!hero || !bottomCta) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 }
    );

    const bottomObserver = new IntersectionObserver(
      ([entry]) => setNearBottom(entry.isIntersecting),
      { threshold: 0 }
    );

    heroObserver.observe(hero);
    bottomObserver.observe(bottomCta);

    return () => {
      heroObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, []);

  if (!everShown.current && !shouldShow) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/40 bg-background ${
        shouldShow ? 'mobile-sticky-cta-in' : 'mobile-sticky-cta-out pointer-events-none'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-sticky-cta"
      aria-hidden={!shouldShow}
    >
      <div className="px-4 py-3">
        {showAuthed ? (
          <Link href="/projects">
            <Button className="w-full gap-2" data-testid="button-sticky-cta">
              Go to My Projects <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={AUTH_ROUTES.signup}>
            <Button className="w-full gap-2" data-testid="button-sticky-cta">
              Start free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      <style>{`
        .mobile-sticky-cta-in {
          animation: stickySlideUp 0.3s ease-out both;
        }
        .mobile-sticky-cta-out {
          animation: stickySlideDown 0.2s ease-in both;
        }
        @keyframes stickySlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes stickySlideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mobile-sticky-cta-in,
          .mobile-sticky-cta-out {
            animation: none !important;
          }
          .mobile-sticky-cta-in {
            transform: translateY(0);
            opacity: 1;
          }
          .mobile-sticky-cta-out {
            transform: translateY(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
