import { AnimatedSection } from './AnimatedSection';
import { DIFFERENTIATORS } from './data';

export function WhyRenix() {
  return (
    <AnimatedSection>
      <section className="max-w-5xl mx-auto px-6 py-20" data-testid="section-why-renix">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Why RENIX, not a spreadsheet?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Generic project tools weren't designed for construction. RENIX was.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DIFFERENTIATORS.map(({ icon: Icon, title, desc }, i) => (
            <AnimatedSection key={title} delay={i * 0.08}>
              <div className="renix-surface p-6 h-full" data-testid={`card-why-${i}`}>
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>
    </AnimatedSection>
  );
}
