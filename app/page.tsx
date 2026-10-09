import { SiteFooter } from "@/components/layout/public-shell";
import { Fin05Hero } from "@/components/marketing/Fin05Hero";
import { ActionsSection } from "@/components/marketing/home/actions-section";
import { AudiencesSection } from "@/components/marketing/home/audiences-section";
import { ClosingSection } from "@/components/marketing/home/closing-section";
import { CostingSection } from "@/components/marketing/home/costing-section";
import { DependenciesSection } from "@/components/marketing/home/dependencies-section";
import { DynamicSection } from "@/components/marketing/home/dynamic-section";
import { HazardsSection } from "@/components/marketing/home/hazards-section";
import { LocationSection } from "@/components/marketing/home/location-section";
import { MethodologySection } from "@/components/marketing/home/methodology-section";
import { ProblemSection } from "@/components/marketing/home/problem-section";
import { ProcessSection } from "@/components/marketing/home/process-section";
import { RevealObserver } from "@/components/marketing/home/reveal-observer";
import { SatelliteSection } from "@/components/marketing/home/satellite-section";
import { VulnerabilitySection } from "@/components/marketing/home/vulnerability-section";
import "@/components/marketing/home/home.css";

export default function HomePage() {
  return (
    <div className="cx-home">
      <Fin05Hero nextSectionId="problem" />
      <main>
        <ProblemSection />
        <LocationSection />
        <HazardsSection />
        <ProcessSection />
        <VulnerabilitySection />
        <SatelliteSection />
        <DependenciesSection />
        <DynamicSection />
        <ActionsSection />
        <CostingSection />
        <MethodologySection />
        <AudiencesSection />
        <ClosingSection />
      </main>
      <SiteFooter />
      <RevealObserver />
    </div>
  );
}
