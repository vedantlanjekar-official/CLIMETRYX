import Link from "next/link";
import { CostingWorksheet } from "@/components/marketing/home/costing-worksheet";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const SITE_CHECKS = [
  ["Your priorities", "Candidates are compared on the cost, resilience and climate weights you set. There is no universal best site."],
  ["Climate evidence", "Attached when an assessment has retrieved it for a candidate, with the same provenance as any other run."],
  ["Local baselines", "Fitted 1991–2020 thresholds currently exist for the Pune, Mumbai, Delhi and Chennai grid cells."],
] as const;

export function CostingSection() {
  return (
    <section id="costing" aria-labelledby="costing-title" className="cx-section">
      <div className="cx-container">
        <SectionIntro
          id="costing-title"
          index="11"
          label="Location feasibility and investment costing"
          title={
            <>
              Compare places, then <em>price the preparation.</em>
            </>
          }
          lede="Before committing to a new site, screen the shortlist against the same evidence. Then cost the measures that would make the chosen site more resilient, using quotes you trust."
        />

        <div className="mt-16 grid gap-14 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p data-reveal className="cx-label">How site feasibility works</p>
            <dl className="mt-5 divide-y divide-[var(--cx-rule)] border-y border-[var(--cx-rule)]">
              {SITE_CHECKS.map(([term, copy], index) => (
                <div key={term} data-reveal style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties} className="py-5">
                  <dt className="font-display text-[1.2rem] text-[var(--cx-ink)]">{term}</dt>
                  <dd className="mt-1.5 text-[0.875rem] leading-relaxed text-[var(--cx-slate)]">{copy}</dd>
                </div>
              ))}
            </dl>
            <p data-reveal className="mt-6 text-[0.875rem] leading-relaxed text-[var(--cx-ink)]">
              CLIMETRYX does not publish prices. Equipment, construction and insurance costs vary by supplier and region, so every figure in a costing comes from the user.
            </p>
            <p data-reveal className="mt-6">
              <Link className="cx-link" href="/businesses">
                Get the Adaptation & Investment Plan for your business <span aria-hidden>→</span>
              </Link>
            </p>
          </div>

          <div data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties} className="rounded-[6px] bg-[var(--cx-mist)] p-6 sm:p-8 lg:col-span-8 lg:p-10">
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-[1.5rem] font-medium tracking-[-0.015em]">Resilience costing worksheet</h3>
              <p className="cx-caption">Enter your own quotes</p>
            </div>
            <CostingWorksheet />
          </div>
        </div>
      </div>
    </section>
  );
}
