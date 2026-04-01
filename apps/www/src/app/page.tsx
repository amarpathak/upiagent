import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ProductFlow } from "@/components/product-flow";
import { TrustStats } from "@/components/trust-stats";
import { HowItWorks } from "@/components/how-it-works";
import { LiveDemoSection } from "@/components/live-demo-section";
import { QuickStartSecurity } from "@/components/quick-start-security";
import { PricingCta } from "@/components/pricing-cta";
import { FooterNew } from "@/components/footer-new";

export default function Home() {
  return (
    <main id="main-content" className="flex flex-col">
      <Nav />
      <Hero />
      <ProductFlow />
      <TrustStats />
      <HowItWorks />
      <LiveDemoSection />
      <QuickStartSecurity />
      <PricingCta />
      <FooterNew />
    </main>
  );
}
