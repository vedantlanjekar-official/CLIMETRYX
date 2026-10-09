import { Photo } from "@/components/marketing/home/photo";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const HORIZONS = [
  {
    name: "Now",
    note: "Before the next forecast event",
    items: [
      {
        finding: "Access road sits inside the same heavy-rain screen as the site.",
        action: "Raise finished stock off the floor and agree an alternate delivery route with key customers.",
      },
      {
        finding: "Perishable stock depends on uninterrupted cooling.",
        action: "Set a written transfer plan for chilled goods during power cuts.",
      },
    ],
  },
  {
    name: "This season",
    note: "Within the coming months",
    items: [
      {
        finding: "Production relies on a single reported grid feeder.",
        action: "Size backup power for critical loads only, and price it in the costing worksheet.",
      },
      {
        finding: "Hot days above the local 95th percentile cluster in May.",
        action: "Move heavy work to early shifts and improve ventilation in the packing area.",
      },
    ],
  },
  {
    name: "Longer term",
    note: "Investment and planning decisions",
    items: [
      {
        finding: "A critical input comes from one supplier.",
        action: "Qualify a second supplier in a different district and record its confirmed location.",
      },
      {
        finding: "Expansion is planned and the shortlist is open.",
        action: "Screen candidate sites against the same local baselines before committing.",
      },
    ],
  },
] as const;

export function ActionsSection() {
  return (
    <section id="actions" aria-labelledby="actions-title" className="cx-section bg-[var(--cx-mist)]">
      <div className="cx-container">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-14">
          <SectionIntro
            id="actions-title"
            index="10"
            label="From findings to action"
            className="lg:col-span-7"
            title={
              <>
                Every finding should point to <em>something a business can do.</em>
              </>
            }
            lede="Results are translated into practical steps, ordered by when they matter. The owner decides; CLIMETRYX shows the reasoning."
          />
          <Photo
            slug="mehsana-rooftop-solar"
            alt="Rooftops of a dense residential neighbourhood in Mehsana, Gujarat, with a small array of solar panels mounted on a terrace in the foreground."
            caption="Rooftop solar panels, Mehsana, Gujarat."
            sizes="(min-width: 1024px) 38vw, 100vw"
            className="lg:col-span-5"
            frameClassName="aspect-[4/3] rounded-[4px] [&_img]:object-[50%_80%]"
          />
        </div>

        <div className="mt-16 lg:mt-24">
          <p data-reveal className="cx-flag">Example findings for an illustrative business</p>
          <div className="mt-8 grid border-t border-[var(--cx-ink)] lg:grid-cols-3">
            {HORIZONS.map((horizon, index) => (
              <div
                key={horizon.name}
                data-reveal
                style={{ "--reveal-delay": `${index * 120}ms` } as React.CSSProperties}
                className="border-b border-[var(--cx-rule)] py-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <p className="font-display text-[1.6rem] tracking-[-0.015em] text-[var(--cx-ink)]">{horizon.name}</p>
                <p className="cx-label mt-1">{horizon.note}</p>
                <ul className="mt-8 space-y-8">
                  {horizon.items.map((item) => (
                    <li key={item.finding}>
                      <p className="text-[0.85rem] leading-relaxed text-[var(--cx-slate)]">{item.finding}</p>
                      <p className="mt-2 flex gap-2.5 text-[0.95rem] font-medium leading-relaxed text-[var(--cx-ink)]">
                        <span aria-hidden className="text-[var(--cx-emerald)]">→</span>
                        {item.action}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
