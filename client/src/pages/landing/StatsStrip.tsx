import { AnimatedSection } from './AnimatedSection';
import { STATS } from './data';

export function StatsStrip() {
  return (
    <AnimatedSection>
      <section className="border-y border-border/40 bg-muted/20" data-testid="section-stats">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="text-3xl font-bold text-foreground">{value}</div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </AnimatedSection>
  );
}
