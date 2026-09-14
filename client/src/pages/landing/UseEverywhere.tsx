import { AnimatedSection } from './AnimatedSection';
import { Monitor, Smartphone, Wifi } from 'lucide-react';
import mobileScreenshot from '@assets/image_1771746350320.png';
import previewDesktop from '@assets/image_1772443401789.png';

export function UseEverywhere() {
  return (
    <section className="bg-muted/20 border-y border-border/40">
      <div className="max-w-5xl mx-auto px-6 py-20" data-testid="section-use-everywhere">
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-foreground">
                Your project, everywhere you are
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                RENIX is designed to work seamlessly across all your devices. Review quotes on your phone at the job site,
                manage budgets from your laptop at home, or track progress on your tablet during a meeting. Your project
                data stays in sync, so you're always up to date — no matter where you are.
              </p>
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3" data-testid="device-desktop">
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Monitor className="h-4.5 w-4.5 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Desktop</h4>
                    <p className="text-sm text-muted-foreground">Full three-column layout with AI companion, page navigation, and detailed data views.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="device-mobile">
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4.5 w-4.5 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Mobile</h4>
                    <p className="text-sm text-muted-foreground">Responsive interface that adapts to smaller screens — check budgets, review quotes, and chat with AI on the go.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3" data-testid="device-offline">
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Wifi className="h-4.5 w-4.5 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Always connected</h4>
                    <p className="text-sm text-muted-foreground">Cloud-based and always in sync. Changes made on one device are instantly available on every other.</p>
                  </div>
                </div>
              </div>
            </div>
            <AnimatedSection delay={0.15}>
              <div className="relative flex items-center justify-center">
                <div className="renix-surface p-4 w-[280px] shadow-lg relative z-10" data-testid="device-mockup-phone">
                  <img
                    src={mobileScreenshot}
                    alt="RENIX mobile budget view"
                    className="rounded-md w-full"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="renix-surface p-4 w-[340px] shadow-md absolute -right-4 -top-6 opacity-60 hidden lg:block" data-testid="device-mockup-desktop">
                  <img
                    src={previewDesktop}
                    alt="RENIX desktop view"
                    className="rounded-md w-full aspect-video object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </AnimatedSection>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
