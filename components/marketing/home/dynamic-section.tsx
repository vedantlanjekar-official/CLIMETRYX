import { DynamicSwitcher } from "@/components/marketing/home/dynamic-switcher";
import { SectionIntro } from "@/components/marketing/home/section-intro";

export function DynamicSection() {
  return (
    <section id="dynamic" aria-labelledby="dynamic-title" className="cx-section">
      <div className="cx-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionIntro
            id="dynamic-title"
            index="09"
            label="Dynamic assessment"
            className="lg:col-span-7"
            title={
              <>
                An assessment is a record of a moment, <em>not a permanent label.</em>
              </>
            }
          />
          <p data-reveal className="cx-lede lg:col-span-5">
            Forecasts change, businesses adapt and methods improve. Each run is saved with its evidence and its version, so a reviewer can see what moved and why.
          </p>
        </div>
        <div data-reveal className="mt-16 lg:mt-20">
          <DynamicSwitcher />
        </div>
      </div>
    </section>
  );
}
