import { Photo } from "@/components/marketing/home/photo";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const CHAIN = [
  { stage: "Hazard", event: "Two days of heavy monsoon rain", note: "A measurable weather event at a place and time." },
  { stage: "Exposure", event: "The access road and loading bay take on water", note: "What the hazard can physically reach: site, stock, people, routes." },
  { stage: "Operations", event: "Deliveries stall and a shift is sent home", note: "Output falls even where the building itself stays dry." },
  { stage: "Finance", event: "Sales slip while wages, rent and interest continue", note: "Revenue, cost and cash flow move in different directions." },
  { stage: "Credit relevance", event: "A repayment falls in the same month", note: "A question for informed review, never an automatic answer." },
] as const;

export function ProblemSection() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="cx-section">
      <div className="cx-container">
        <SectionIntro
          id="problem-title"
          index="02"
          label="The problem"
          title={
            <>
              Climate disruption rarely <em>stops at the weather.</em>
            </>
          }
          lede="Most climate information describes the hazard. A business, and anyone financing it, needs to see the path from that hazard to the balance sheet, and where that path can be interrupted."
        />

        <div className="mt-16 grid gap-14 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          <Photo
            slug="chennai-flooded-street"
            alt="A residential street in Chennai under brown floodwater after monsoon rain, with a motorcyclist riding through and pedestrians standing on a raised step beside parked scooters."
            caption="Monsoon flooding on a residential street in Chennai, India."
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="lg:col-span-7"
            frameClassName="aspect-[4/3] rounded-[4px]"
          />

          <div className="lg:col-span-5 lg:pt-2">
          <p data-reveal className="cx-flag mb-8">Illustrative sequence</p>
          <ol aria-label="How a hazard becomes a financial question" className="relative">
            <span aria-hidden className="absolute bottom-8 left-[0.9375rem] top-3 w-px bg-[var(--cx-rule)]" />
            {CHAIN.map((link, index) => (
              <li
                key={link.stage}
                data-reveal
                style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties}
                className="relative grid grid-cols-[2rem_1fr] gap-5 pb-9 last:pb-0"
              >
                <span
                  aria-hidden
                  className="relative z-10 mt-0.5 grid h-[1.875rem] w-[1.875rem] place-items-center rounded-full border border-[var(--cx-rule)] bg-[var(--cx-paper)] text-[0.7rem] font-bold tabular-nums text-[var(--cx-emerald)]"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="cx-label">{link.stage}</p>
                  <p className="mt-1.5 font-display text-[1.3rem] leading-snug tracking-[-0.01em] text-[var(--cx-ink)]">{link.event}</p>
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-[var(--cx-slate)]">{link.note}</p>
                </div>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
