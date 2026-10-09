import { Photo } from "@/components/marketing/home/photo";
import { SectionIntro } from "@/components/marketing/home/section-intro";

type Evidence = "verified" | "reported" | "inferred" | "hypothetical";

const EVIDENCE: Record<Evidence, { label: string; copy: string; dash?: string; color: string }> = {
  verified: { label: "Verified", copy: "Checked against a record, such as a confirmed map pin.", color: "#0b896b" },
  reported: { label: "User-reported", copy: "Stated by the owner and shown as such. Not independently checked.", color: "#0b1d29" },
  inferred: { label: "Inferred", copy: "Derived from location data, with the rule shown beside it.", dash: "7 6", color: "#35beb4" },
  hypothetical: { label: "Hypothetical", copy: "A what-if used for stress testing. Never presented as an event.", dash: "1.5 6", color: "#8b6a2e" },
};

const NODES: readonly { id: string; label: string; detail: string; x: number; y: number; evidence: Evidence }[] = [
  { id: "warehouse", label: "Finished-goods store", detail: "Second site, pin confirmed", x: 400, y: 70, evidence: "verified" },
  { id: "power", label: "Grid power", detail: "Single feeder, per owner", x: 680, y: 150, evidence: "reported" },
  { id: "water", label: "Municipal water", detail: "Daily supply, per owner", x: 700, y: 370, evidence: "reported" },
  { id: "road", label: "Access road", detail: "Same rainfall screen as site", x: 400, y: 460, evidence: "inferred" },
  { id: "supplier", label: "Packaging supplier", detail: "Second city, pin confirmed", x: 110, y: 370, evidence: "verified" },
  { id: "port", label: "Export port", detail: "Closure scenario", x: 120, y: 150, evidence: "hypothetical" },
];

const CENTRE = { x: 400, y: 265 };

export function DependenciesSection() {
  return (
    <section id="dependencies" aria-labelledby="dependencies-title" className="cx-section bg-[var(--cx-mist)]">
      <div className="cx-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionIntro
            id="dependencies-title"
            index="08"
            label="Dependencies and supply chains"
            className="lg:col-span-7"
            title={
              <>
                A business is only as steady as <em>what it depends on.</em>
              </>
            }
          />
          <p data-reveal className="cx-lede lg:col-span-5">
            Power, water, roads, ports and suppliers each carry their own exposure. CLIMETRYX maps them, and labels how much is actually known about each link.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-14">
          <figure data-reveal="fade" className="lg:col-span-8" aria-labelledby="network-caption">
            <p className="cx-flag">Illustrative example · not a real business</p>
            <svg viewBox="0 0 800 530" role="img" aria-labelledby="network-caption" className="mt-6 hidden h-auto w-full md:block">
              {NODES.map((node) => {
                const style = EVIDENCE[node.evidence];
                return (
                  <line
                    key={`edge-${node.id}`}
                    x1={CENTRE.x}
                    y1={CENTRE.y}
                    x2={node.x}
                    y2={node.y}
                    stroke={style.color}
                    strokeWidth={node.evidence === "verified" ? 2.2 : 1.6}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                );
              })}
              <circle cx={CENTRE.x} cy={CENTRE.y} r="74" fill="#071b2b" />
              <text x={CENTRE.x} y={CENTRE.y - 6} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="600" fontFamily="var(--font-display)">
                Food-processing
              </text>
              <text x={CENTRE.x} y={CENTRE.y + 17} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="600" fontFamily="var(--font-display)">
                unit
              </text>
              {NODES.map((node) => {
                const style = EVIDENCE[node.evidence];
                const labelY = node.y < CENTRE.y ? node.y - 42 : node.y + 32;
                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r="9" fill="#f2f5f2" stroke={style.color} strokeWidth="2.5" strokeDasharray={node.evidence === "hypothetical" ? "2 3" : undefined} />
                    <text x={node.x} y={labelY} textAnchor="middle" fill="#0b1d29" fontSize="16" fontWeight="600">
                      {node.label}
                    </text>
                    <text x={node.x} y={labelY + 20} textAnchor="middle" fill="#536471" fontSize="13">
                      {node.detail}
                    </text>
                  </g>
                );
              })}
            </svg>

            <ul className="mt-6 divide-y divide-[var(--cx-rule)] border-y border-[var(--cx-rule)] md:hidden">
              {NODES.map((node) => (
                <li key={node.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span>
                    <span className="block text-[0.95rem] font-semibold text-[var(--cx-ink)]">{node.label}</span>
                    <span className="text-[0.8rem] text-[var(--cx-slate)]">{node.detail}</span>
                  </span>
                  <span className="shrink-0 text-[0.72rem] font-bold uppercase tracking-[0.12em]" style={{ color: EVIDENCE[node.evidence].color }}>
                    {EVIDENCE[node.evidence].label}
                  </span>
                </li>
              ))}
            </ul>
            <figcaption id="network-caption" className="cx-caption mt-4">
              Dependency map for an illustrative food-processing unit. Line style shows the evidence behind each link.
            </figcaption>
          </figure>

          <div className="lg:col-span-4">
            <p data-reveal className="cx-label">Evidence key</p>
            <dl className="mt-5 space-y-6">
              {(Object.keys(EVIDENCE) as Evidence[]).map((key, index) => {
                const style = EVIDENCE[key];
                return (
                  <div key={key} data-reveal style={{ "--reveal-delay": `${index * 90}ms` } as React.CSSProperties} className="grid grid-cols-[3rem_1fr] gap-4">
                    <dt className="pt-2.5">
                      <svg aria-hidden width="48" height="4" viewBox="0 0 48 4">
                        <line x1="1" y1="2" x2="47" y2="2" stroke={style.color} strokeWidth="2.5" strokeDasharray={style.dash} strokeLinecap="round" />
                      </svg>
                      <span className="sr-only">{style.label}</span>
                    </dt>
                    <dd>
                      <p aria-hidden className="font-semibold text-[var(--cx-ink)]">{style.label}</p>
                      <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--cx-slate)]">{style.copy}</p>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p data-reveal className="mt-10 border-t border-[var(--cx-rule)] pt-6 text-[0.875rem] leading-relaxed text-[var(--cx-ink)]">
              There is no live outage feed for Indian utilities. CLIMETRYX never invents a power cut or a supplier failure; reliability comes from the owner, or from a scenario that is labelled as one.
            </p>
          </div>
        </div>

        <div className="mt-20 grid gap-8 sm:grid-cols-2 lg:mt-28 lg:grid-cols-12 lg:items-end">
          <Photo
            slug="kochi-container-terminal"
            alt="Blue and yellow ship-to-shore container cranes at the Vallarpadam International Container Transshipment Terminal in Kochi under a clear evening sky."
            caption="Container cranes, Vallarpadam terminal, Kochi."
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
            className="lg:col-span-5"
            frameClassName="aspect-[3/2] rounded-[4px]"
          />
          <Photo
            slug="andhra-substation"
            alt="Entrance gate of a 220 kV electricity substation in Andhra Pradesh, with transmission towers and overhead lines behind a white boundary wall."
            caption="220 kV substation, Chillakallu, Andhra Pradesh."
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="lg:col-span-4"
            frameClassName="aspect-[4/3] rounded-[4px]"
          />
          <Photo
            slug="kerala-drinking-water-supply"
            alt="A red panchayat truck carrying white plastic water tanks for drinking-water distribution during a 2017 drought in Kerala."
            caption="Drinking-water distribution during drought, Kerala, 2017."
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="sm:col-span-2 lg:col-span-3"
            frameClassName="aspect-[4/5] rounded-[4px] sm:aspect-[3/2] lg:aspect-[4/5]"
          />
        </div>
      </div>
    </section>
  );
}
