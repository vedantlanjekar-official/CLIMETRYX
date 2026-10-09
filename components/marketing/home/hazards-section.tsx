import { Photo } from "@/components/marketing/home/photo";
import { SectionIntro } from "@/components/marketing/home/section-intro";

type HazardCopy = {
  name: string;
  title: string;
  impact: string;
  screens: string;
  limit: string;
};

const FLOOD: HazardCopy = {
  name: "Flood",
  title: "Water at the gate stops a business long before it reaches the machines.",
  impact: "Closed access roads, wet stock, staff who cannot travel, and customers who stay home. Disruption often begins with the route, not the roof.",
  screens: "Forecast rainfall over 24 and 72 hours against fixed screens and the site's own wet-day 99th percentile, 3-day 99th percentile and empirical 10-year daily level.",
  limit: "Heavy rainfall is not flood depth. Without a loaded flood-hazard raster, CLIMETRYX does not say whether a specific building will flood.",
};

const HEAT: HazardCopy = {
  name: "Heat",
  title: "Heat arrives as slower hands, spoiled goods and higher power bills.",
  impact: "Outdoor and poorly ventilated work slows, cold chains strain, and cooling demand rises at the same time as grid stress.",
  screens: "Daily maximum temperature against a sector screening threshold and the local 95th and 99th percentiles, plus forecast wet-bulb maxima.",
  limit: "Air temperature is not a worker heat-stress index. Radiant heat, clothing and workload are not combined.",
};

const DROUGHT: HazardCopy = {
  name: "Drought",
  title: "Drought is slow, and it reaches a business through its inputs.",
  impact: "Raw materials cost more, water arrives by tanker, and rural customers spend less. The effect builds over months, not days.",
  screens: "Rainfall deficits over 30 and 90 days as a Standardised Precipitation Index against a 1991–2020 fit, read on the WMO dryness scale. Forecast water balance is shown as context only.",
  limit: "A dry spell is not a water outage. CLIMETRYX has no utility supply feed and does not infer one.",
};

const STORM: HazardCopy = {
  name: "Storm",
  title: "A storm is brief. The repair list and the missed orders are not.",
  impact: "Roof and signage damage, power cuts, closed ports and roads, and supply delays that ripple for weeks after landfall.",
  screens: "Forecast wind gusts against 20 and 25 m/s screens and the local 99th percentile and 10-year level. High convective energy (CAPE ≥ 2,500 J/kg) is flagged as context.",
  limit: "A gust forecast is not an official cyclone warning. Warnings appear only from a configured authority feed.",
};

function HazardText({ hazard, index, tone = "light" }: { hazard: HazardCopy; index: number; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div>
      <p data-reveal className={dark ? "cx-label !text-[var(--cx-teal)]" : "cx-label !text-[var(--cx-emerald)]"}>
        <span className="tabular-nums">0{index}</span>
        <span className="mx-2 opacity-50">/</span>
        {hazard.name}
      </p>
      <h3
        data-reveal
        style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
        className={`mt-4 font-display text-[clamp(1.6rem,1.1rem+1.4vw,2.35rem)] font-medium leading-[1.12] tracking-[-0.02em] ${dark ? "!text-white" : ""}`}
      >
        {hazard.title}
      </h3>
      <p data-reveal style={{ "--reveal-delay": "140ms" } as React.CSSProperties} className={`mt-5 leading-relaxed ${dark ? "text-white/75" : "text-[var(--cx-slate)]"}`}>
        {hazard.impact}
      </p>
      <dl data-reveal style={{ "--reveal-delay": "200ms" } as React.CSSProperties} className={`mt-8 space-y-5 border-t pt-6 text-[0.9rem] leading-relaxed ${dark ? "border-white/15" : "border-[var(--cx-rule)]"}`}>
        <div>
          <dt className={`cx-label ${dark ? "!text-white/50" : ""}`}>What CLIMETRYX screens</dt>
          <dd className={`mt-1.5 ${dark ? "text-white/85" : "text-[var(--cx-ink)]"}`}>{hazard.screens}</dd>
        </div>
        <div>
          <dt className={`cx-label ${dark ? "!text-white/50" : ""}`}>What it does not tell you</dt>
          <dd className={`mt-1.5 ${dark ? "text-white/85" : "text-[var(--cx-ink)]"}`}>{hazard.limit}</dd>
        </div>
      </dl>
    </div>
  );
}

export function HazardsSection() {
  return (
    <section id="hazards" aria-labelledby="hazards-title" className="cx-section pb-0">
      <div className="cx-container">
        <SectionIntro
          id="hazards-title"
          index="04"
          label="Four hazards"
          title={
            <>
              Four hazards. <em>Four different ways</em> a business is interrupted.
            </>
          }
          lede="Each hazard is screened by its own module, against disclosed thresholds, with its limits written beside the result."
        />

        <article aria-label="Flood" className="mt-20 grid gap-12 lg:mt-28 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-5">
            <HazardText hazard={FLOOD} index={1} />
          </div>
          <Photo
            slug="chennai-flooded-two-wheelers"
            alt="Motorbikes and bicycles parked in knee-deep floodwater outside houses in Chennai, with residents standing on a dry step behind them."
            caption="Two-wheelers parked in floodwater, Chennai."
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="lg:col-span-7"
            frameClassName="aspect-[4/3] rounded-[4px]"
          />
        </article>

        <article aria-label="Heat" className="mt-28 grid gap-12 lg:mt-40 lg:grid-cols-12 lg:items-start lg:gap-16">
          <Photo
            slug="mumbai-dharavi-workshop"
            alt="Workers in a crowded Dharavi workshop cleaning used metal tins over steaming tanks, surrounded by stacks of tin containers."
            caption="Labour-intensive workshop, Dharavi, Mumbai."
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="lg:col-span-5"
            frameClassName="aspect-[4/5] rounded-[4px] [&_img]:object-[38%_50%]"
          />
          <div className="lg:col-span-6 lg:col-start-7 lg:pt-16">
            <HazardText hazard={HEAT} index={2} />
            <p data-reveal className="mt-10 border-l-2 border-[var(--cx-emerald)] pl-5 font-display text-[1.2rem] leading-snug text-[var(--cx-ink)]">
              Humid heat is screened separately: a forecast wet-bulb maximum of 31&nbsp;°C, the limit measured for young, healthy adults at low workload (Vecellio et al., 2022).
            </p>
          </div>
        </article>
      </div>

      <article aria-label="Drought" className="mt-28 lg:mt-40">
        <Photo
          slug="dried-river-india"
          alt="A wide, dry riverbed in India with cracked sandy soil and sparse grass, a small pool of remaining water and pylons on the hazy horizon."
          caption="A dried riverbed in India."
          sizes="100vw"
          frameClassName="aspect-[16/9] max-h-[78svh] w-full lg:aspect-[21/9]"
          captionClassName="cx-container"
        />
        <div className="cx-container mt-12 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <HazardText hazard={DROUGHT} index={3} />
          </div>
        </div>
      </article>

      <article aria-label="Storm" className="mt-28 bg-[var(--cx-night)] py-20 text-white lg:mt-40 lg:py-28">
        <div className="cx-container grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-5">
            <HazardText hazard={STORM} index={4} tone="dark" />
          </div>
          <Photo
            slug="cyclone-yaas-modis"
            alt="True-colour satellite view of Tropical Cyclone Yaas, a broad white spiral of cloud over the Bay of Bengal, approaching India's eastern coast."
            caption="Tropical Cyclone Yaas approaching India, MODIS, 25 May 2021."
            creditLabel="Image"
            tone="dark"
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="lg:col-span-7"
            frameClassName="aspect-[1600/1370] rounded-[4px]"
          />
        </div>
      </article>
    </section>
  );
}
