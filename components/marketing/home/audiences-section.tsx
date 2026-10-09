import { Photo } from "@/components/marketing/home/photo";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const AUDIENCES = [
  {
    who: "MSME owners",
    need: "Understand which hazards could stop the business, what that would cost, and which preparations are worth paying for.",
  },
  {
    who: "Lenders and loan officers",
    need: "Add an explainable climate view to a credit conversation, as context for review rather than a reason to refuse.",
  },
  {
    who: "Risk and portfolio analysts",
    need: "Compare businesses on a consistent, versioned method with sources and completeness visible for every result.",
  },
  {
    who: "Expansion and planning teams",
    need: "Screen candidate locations against local climate baselines before a lease or a purchase is signed.",
  },
] as const;

export function AudiencesSection() {
  return (
    <section id="applications" aria-labelledby="applications-title" className="cx-section">
      <div className="cx-container">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <Photo
              slug="vellore-market-street"
              alt="A busy, narrow market street in Vellore, Tamil Nadu, with vegetable sellers seated on the ground under blue tarpaulin awnings and shoppers walking past small shops."
              caption="Market street, Vellore, Tamil Nadu."
              sizes="(min-width: 1024px) 46vw, 100vw"
              frameClassName="aspect-[4/5] rounded-[4px] sm:aspect-[4/3] lg:aspect-[4/5]"
              className="lg:sticky lg:top-10"
            />
          </div>
          <div className="lg:col-span-6 lg:pt-6">
            <SectionIntro
              id="applications-title"
              index="13"
              label="Who it serves"
              title={
                <>
                  Built for the people who keep <em>small businesses running.</em>
                </>
              }
              lede="Micro, small and medium enterprises carry climate disruption with the thinnest buffers. CLIMETRYX gives each person around them the same evidence, framed for the decision they make."
            />
            <dl className="mt-12 border-t border-[var(--cx-ink)]">
              {AUDIENCES.map((audience, index) => (
                <div
                  key={audience.who}
                  data-reveal
                  style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties}
                  className="grid gap-2 border-b border-[var(--cx-rule)] py-6 sm:grid-cols-[13rem_1fr] sm:gap-8"
                >
                  <dt className="font-display text-[1.3rem] leading-tight tracking-[-0.01em] text-[var(--cx-ink)]">{audience.who}</dt>
                  <dd className="text-[0.925rem] leading-relaxed text-[var(--cx-slate)]">{audience.need}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
