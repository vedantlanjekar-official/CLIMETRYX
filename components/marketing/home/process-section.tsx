import { SectionIntro } from "@/components/marketing/home/section-intro";

const STAGES = [
  {
    title: "Describe the business",
    copy: "Sites, operations, suppliers, utilities and, with consent, a simple financial profile, entered through a guided wizard.",
    output: "A structured business profile",
  },
  {
    title: "Confirm the location",
    copy: "A searched place name is only a candidate. Every site needs an explicit pin confirmation before it is assessed.",
    output: "Confirmed coordinates per site",
  },
  {
    title: "Retrieve evidence",
    copy: "Forecasts, a 30-year local baseline and satellite catalogue results are fetched, each recorded with its source, time and licence.",
    output: "Provenance for every input",
  },
  {
    title: "Assess vulnerability",
    copy: "Hazard modules meet the business profile. Components without evidence are excluded and the remaining weights renormalised.",
    output: "Indicator with completeness",
  },
  {
    title: "Report and revisit",
    copy: "A saved run, its explanation and an exportable report. Re-run when conditions or the business change.",
    output: "PDF and CSV a reviewer can reopen",
  },
] as const;

export function ProcessSection() {
  return (
    <section id="platform" aria-labelledby="platform-title" className="cx-section">
      <div className="cx-container">
        <SectionIntro
          id="platform-title"
          index="05"
          label="How it works"
          title={
            <>
              From a business description to <em>an assessment you can question.</em>
            </>
          }
          lede="Five stages, each leaving a record of what was used, when it was retrieved, and what is still missing."
        />

        <ol className="relative mt-16 grid gap-0 lg:mt-24 lg:grid-cols-5 lg:gap-8">
          <span aria-hidden className="absolute bottom-6 left-[0.6875rem] top-2 w-px bg-[var(--cx-rule)] lg:inset-x-0 lg:bottom-auto lg:left-0 lg:top-[0.6875rem] lg:h-px lg:w-auto" />
          {STAGES.map((stage, index) => (
            <li
              key={stage.title}
              data-reveal
              style={{ "--reveal-delay": `${index * 110}ms` } as React.CSSProperties}
              className="relative grid grid-cols-[1.375rem_1fr] gap-6 pb-12 last:pb-0 lg:flex lg:flex-col lg:gap-0 lg:pb-0"
            >
              <span aria-hidden className="relative z-10 mt-0.5 block h-[1.375rem] w-[1.375rem] rounded-full border-[5px] border-[var(--cx-paper)] bg-[var(--cx-emerald)] ring-1 ring-[var(--cx-emerald)]/40" />
              <div className="lg:mt-8 lg:flex lg:flex-1 lg:flex-col lg:pr-2">
                <p className="text-[0.7rem] font-bold tabular-nums tracking-[0.2em] text-[var(--cx-slate)]">STAGE 0{index + 1}</p>
                <h3 className="mt-3 font-display text-[1.4rem] font-medium leading-tight tracking-[-0.015em]">{stage.title}</h3>
                <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--cx-slate)] lg:mb-6">{stage.copy}</p>
                <p className="mt-5 border-t border-[var(--cx-rule)] pt-3 text-[0.8rem] font-semibold text-[var(--cx-ink)] lg:mt-auto lg:min-h-[3.4rem]">
                  <span className="text-[var(--cx-emerald)]">→ </span>
                  {stage.output}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
