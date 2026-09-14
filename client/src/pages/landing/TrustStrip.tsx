import { ShieldCheck, Brain, Lock, Globe } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

const TRUST_SIGNALS = [
  { icon: ShieldCheck, label: 'Your data stays private' },
  { icon: Brain, label: 'AI proposes, you decide' },
  { icon: Lock, label: 'Encrypted & secure' },
  { icon: Globe, label: 'GDPR-aware' },
];

export function TrustStrip() {
  return (
    <section className="bg-muted/30 border-y border-border/30 py-6" data-testid="section-trust-strip">
      <div className="max-w-5xl mx-auto px-6">
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {TRUST_SIGNALS.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center gap-2.5 justify-center"
                data-testid={`trust-signal-${signal.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <signal.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {signal.label}
                </span>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
