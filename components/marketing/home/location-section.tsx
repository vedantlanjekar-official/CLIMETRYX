import chennai from "@/data/models/climatology/chennai.json";
import delhi from "@/data/models/climatology/delhi.json";
import mumbai from "@/data/models/climatology/mumbai.json";
import pune from "@/data/models/climatology/pune.json";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const CITIES = [
  { name: "Delhi", data: delhi },
  { name: "Mumbai", data: mumbai },
  { name: "Pune", data: pune },
  { name: "Chennai", data: chennai },
] as const;

type Model = (typeof CITIES)[number]["data"]["model"];

const METRICS: readonly { label: string; question: string; unit: string; value: (model: Model) => number }[] = [
  {
    label: "Hot day",
    question: "Daily maximum temperature exceeded on 5% of days (95th percentile).",
    unit: "°C",
    value: (model) => model.heat.tmaxP95C,
  },
  {
    label: "Very wet day",
    question: "Rainfall exceeded on 1% of wet days (99th percentile, days with at least 1 mm).",
    unit: "mm",
    value: (model) => model.rain.wetDayP99Mm,
  },
  {
    label: "1-in-10-year day",
    question: "Empirical 10-year level of the wettest day each year. Estimated from 30 annual maxima, so uncertain.",
    unit: "mm",
    value: (model) => model.rain.annualMax1Day10yrMm,
  },
  {
    label: "Strong gust",
    question: "Daily maximum wind gust exceeded on 1% of days (99th percentile).",
    unit: "m/s",
    value: (model) => model.gust.p99Mps,
  },
];

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function LocationSection() {
  const fittedAt = new Date(pune.model.fittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <section id="location" aria-labelledby="location-title" className="cx-section bg-[var(--cx-mist)]">
      <div className="cx-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionIntro
            id="location-title"
            index="03"
            label="Location matters"
            className="lg:col-span-7"
            title={
              <>
                One business category. <em>Different environmental realities.</em>
              </>
            }
          />
          <p data-reveal className="cx-lede lg:col-span-5">
            Place the same small food-processing unit in four Indian cities and the definition of an unusual day changes. CLIMETRYX screens each site against its own local baseline, not one national threshold.
          </p>
        </div>

        <div className="mt-16 grid border-t border-[var(--cx-rule)] md:grid-cols-2 lg:mt-20">
          {METRICS.map((metric, metricIndex) => {
            const values = CITIES.map((city) => metric.value(city.data.model));
            const max = Math.max(...values);
            return (
              <figure
                key={metric.label}
                data-reveal
                style={{ "--reveal-delay": `${(metricIndex % 2) * 100}ms` } as React.CSSProperties}
                className="border-b border-[var(--cx-rule)] py-10 md:odd:border-r md:odd:pr-10 md:even:pl-10 lg:odd:pr-14 lg:even:pl-14"
              >
                <figcaption>
                  <p className="font-display text-[1.55rem] tracking-[-0.015em] text-[var(--cx-ink)]">{metric.label}</p>
                  <p className="mt-2 max-w-[28rem] text-[0.875rem] leading-relaxed text-[var(--cx-slate)]">{metric.question}</p>
                </figcaption>
                <dl className="mt-7 space-y-3.5">
                  {CITIES.map((city, cityIndex) => {
                    const value = values[cityIndex];
                    const highest = value === max;
                    return (
                      <div key={city.name} className="grid grid-cols-[4.75rem_1fr_4.5rem] items-center gap-4">
                        <dt className="text-[0.85rem] font-semibold text-[var(--cx-ink)]">{city.name}</dt>
                        <dd aria-hidden className="h-2 overflow-hidden rounded-full bg-[var(--cx-rule)]/70">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(value / max) * 100}%`, background: highest ? "var(--cx-emerald)" : "#9fb5ad" }}
                          />
                        </dd>
                        <dd className="text-right font-display text-[1.05rem] tabular-nums text-[var(--cx-ink)]">
                          {format(value)}
                          <span className="ml-1 font-sans text-[0.7rem] text-[var(--cx-slate)]">{metric.unit}</span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </figure>
            );
          })}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div data-reveal className="lg:col-span-7">
            <p className="cx-label">What this resolution can and cannot say</p>
            <p className="mt-3 max-w-[40rem] text-[0.95rem] leading-relaxed text-[var(--cx-ink)]">
              These are statistics for 1991–2020 from ERA5 reanalysis, read from the grid cell nearest each city (about 0.25°, or roughly 25–28 km across). They describe the regional climate around a site, not a street or a plot. Whether a particular yard floods depends on drainage, elevation and local flood mapping, which needs a flood-hazard raster that this prototype has not yet loaded.
            </p>
          </div>
          <div data-reveal style={{ "--reveal-delay": "100ms" } as React.CSSProperties} className="cx-caption lg:col-span-5 lg:pt-7">
            <p>
              Grid cells used: Delhi {delhi.grid.latitude}°N {delhi.grid.longitude}°E; Mumbai {mumbai.grid.latitude}°N {mumbai.grid.longitude}°E (a coastal cell
              reported at sea level); Pune {pune.grid.latitude}°N {pune.grid.longitude}°E; Chennai {chennai.grid.latitude}°N {chennai.grid.longitude}°E.
            </p>
            <p className="mt-2">
              Source: {pune.model.source.attribution} Fitted {fittedAt}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
