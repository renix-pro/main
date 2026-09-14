import { AnimatedSection } from './AnimatedSection';
import { PAGES } from './data';

export function PagesGrid() {
  return (
    <AnimatedSection>
      <section className="max-w-5xl mx-auto px-6 py-20" data-testid="section-pages">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            10 purpose-built pages
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Every aspect of your project lives in a dedicated page — structured, searchable, and always in sync.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {PAGES.map(({ icon: Icon, name, desc }, i) => (
            <AnimatedSection key={name} delay={i * 0.05}>
              <div
                className={`renix-surface p-4 flex flex-col items-center text-center gap-2 transition-shadow hover:shadow-md h-full ${i === 0 ? 'col-span-2 sm:col-span-1 border-2 border-foreground/10' : ''}`}
                data-testid={`card-page-${name.toLowerCase()}`}
              >
                <Icon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>
    </AnimatedSection>
  );
}
