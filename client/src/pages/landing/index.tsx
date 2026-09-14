import { useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { TrustStrip } from './TrustStrip';
import { StatsStrip } from './StatsStrip';
import { FeatureDeepDives } from './FeatureDeepDives';
import { PagesGrid } from './PagesGrid';
import { HowItWorks } from './HowItWorks';
import { WhyRenix } from './WhyRenix';
import { UseEverywhere } from './UseEverywhere';
import { PricingSection } from './PricingSection';
import { Testimonials } from './Testimonials';
import { BottomCTA } from './BottomCTA';
import { LandingFooter } from './LandingFooter';
import { Lightbox } from './Lightbox';
import { MobileStickyCTA } from './MobileStickyCTA';

export default function LandingPage() {
  const [lightboxImg, setLightboxImg] = useState<{ src: string; label: string } | null>(null);

  return (
    <div className="min-h-screen flex flex-col" data-testid="page-landing">
      <LandingHeader />

      <main className="flex-1">
        <HeroSection />
        <TrustStrip />
        <StatsStrip />
        <FeatureDeepDives onImageClick={setLightboxImg} />
        <PagesGrid />
        <HowItWorks />
        <Testimonials />
        <WhyRenix />
        <UseEverywhere />
        <PricingSection />
        <BottomCTA />
      </main>

      <LandingFooter />
      <MobileStickyCTA />
      <Lightbox image={lightboxImg} onClose={() => setLightboxImg(null)} />
    </div>
  );
}
