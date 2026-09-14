import { Link } from 'wouter';
import { AUTH_ROUTES, useAuth } from '../../auth';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { PRICING_PLANS } from './data';
import { Check, Minus } from 'lucide-react';

export function PricingSection() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const showAuthed = isAuthenticated && !authLoading;

  return (
    <section className="border-b border-border/40" id="pricing">
      <div className="max-w-4xl mx-auto px-6 py-20" data-testid="section-pricing">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Start free, upgrade when you need more. No hidden fees, no surprises.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            €9.99/month to manage a €200K project = 0.005% of your renovation cost.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1" data-testid="text-pricing-comparison">
            That's less than a single hour with a project manager — and RENIX works 24/7.
          </p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {PRICING_PLANS.map((plan, i) => (
            <AnimatedSection key={plan.name} delay={i * 0.1}>
              <div
                className={`renix-surface p-6 flex flex-col h-full relative ${plan.highlighted ? 'ring-2 ring-foreground/20 shadow-lg' : ''}`}
                data-testid={`card-pricing-${plan.name.toLowerCase()}`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full">
                    Best value
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.desc}</p>
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.features.map(({ text, included }) => (
                    <li key={text} className="flex items-start gap-2.5">
                      {included ? (
                        <Check className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <span className={`text-sm ${included ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-border/40">
                  {showAuthed ? (
                    <Link href="/projects">
                      <Button
                        variant={plan.highlighted ? 'default' : 'outline'}
                        className="w-full"
                        data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                      >
                        Go to Projects
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`${AUTH_ROUTES.signup}?plan=${plan.planId}`}>
                      <Button
                        variant={plan.highlighted ? 'default' : 'outline'}
                        className="w-full"
                        data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                      >
                        {plan.price === '€0' ? 'Start free' : 'Get started'}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
