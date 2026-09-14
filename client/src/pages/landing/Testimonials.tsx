import { AnimatedSection } from './AnimatedSection';
import { TESTIMONIALS } from './data';
import { Quote, Star } from 'lucide-react';

export function Testimonials() {
  return (
    <section className="border-b border-border/40">
      <div className="max-w-5xl mx-auto px-6 py-20" data-testid="section-testimonials">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Trusted by homeowners and professionals
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            See how RENIX helps people take control of complex renovation projects.
          </p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <AnimatedSection key={t.name} delay={i * 0.1}>
              <div
                className="renix-surface p-6 flex flex-col h-full"
                data-testid={`card-testimonial-${i}`}
              >
                <Quote className="h-5 w-5 text-muted-foreground/30 mb-4 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed flex-1 mb-5" data-testid={`text-testimonial-quote-${i}`}>
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-1 mb-3" data-testid={`rating-testimonial-${i}`}>
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-foreground text-foreground" />
                  ))}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground" data-testid={`text-testimonial-name-${i}`}>{t.name}</span>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-testimonial-role-${i}`}>{t.role}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
