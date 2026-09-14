import { Button } from '@/components/ui/button';
import { AnimatedSection } from './AnimatedSection';
import { FEATURE_DEEPDIVES } from './data';
import { ScopePreview, BudgetPreview, QuotesPreview } from './FeaturePreviews';

const PREVIEW_COMPONENTS: Record<string, () => JSX.Element> = {
  scope: ScopePreview,
  budget: BudgetPreview,
  quotes: QuotesPreview,
};

interface FeatureDeepDivesProps {
  onImageClick: (img: { src: string; label: string }) => void;
}

export function FeatureDeepDives({ onImageClick }: FeatureDeepDivesProps) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20" id="features" data-testid="section-features">
      <AnimatedSection className="text-center mb-16">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          See RENIX in action
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          A glimpse into the tools that keep your renovation on track and on budget.
        </p>
      </AnimatedSection>

      <div className="space-y-20">
        {FEATURE_DEEPDIVES.map(({ src, preview, title, desc, badge, imgClass }, i) => {
          const PreviewComponent = preview ? PREVIEW_COMPONENTS[preview] : null;

          return (
            <AnimatedSection key={title} delay={0.1}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className={`space-y-4 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                    {badge}
                  </span>
                  <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                  {PreviewComponent ? (
                    <div data-testid={`feature-preview-${i}`}>
                      <PreviewComponent />
                    </div>
                  ) : src ? (
                    <Button
                      variant="ghost"
                      className="renix-surface overflow-hidden w-full h-auto p-0 text-left cursor-pointer"
                      onClick={() => onImageClick({ src, label: title })}
                      data-testid={`feature-preview-${i}`}
                    >
                      <img
                        src={src}
                        alt={title}
                        className={imgClass || "w-full aspect-video object-cover"}
                        loading="lazy"
                        decoding="async"
                      />
                    </Button>
                  ) : null}
                </div>
              </div>
            </AnimatedSection>
          );
        })}
      </div>
    </section>
  );
}
