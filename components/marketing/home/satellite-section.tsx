import scenes from "@/public/images/satellite/scenes.json";
import { CompareSlider } from "@/components/marketing/home/compare-slider";
import { SectionIntro } from "@/components/marketing/home/section-intro";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function SatelliteSection() {
  const [before, after] = scenes.scenes;

  return (
    <section id="data-intelligence" aria-labelledby="satellite-title" className="cx-section">
      <div className="cx-container">
        <SectionIntro
          id="satellite-title"
          index="07"
          label="Satellite and Earth observation"
          title={
            <>
              Seeing the land <em>around the business.</em>
            </>
          }
          lede="Satellite imagery shows how a landscape changes between seasons: water in a reservoir, vegetation on surrounding hills, the extent of built land. CLIMETRYX searches the Sentinel-2 archive for each site and records exactly which scene was found."
        />

        <div className="mt-16 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-14">
          <figure data-reveal="fade" className="lg:col-span-8">
            <CompareSlider
              width={1600}
              height={934}
              before={{
                src: before.file,
                label: `${formatDate(before.datetime)} · pre-monsoon`,
                alt: "Sentinel-2 true-colour image of Khadakwasla reservoir and south-west Pune on 28 April 2025: brown, dry hills around a dark green reservoir, with the city to the north-east.",
              }}
              after={{
                src: after.file,
                label: `${formatDate(after.datetime)} · post-monsoon`,
                alt: "The same area on 14 November 2025: the surrounding hills are green with vegetation after the monsoon and the reservoir water appears darker.",
              }}
            />
            <figcaption className="cx-caption mt-3">
              Drag or use the arrow keys to compare. {scenes.attribution}
            </figcaption>
          </figure>

          <div className="lg:col-span-4">
            <p data-reveal className="cx-label">Scene record</p>
            <dl data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties} className="mt-4 divide-y divide-[var(--cx-rule)] border-y border-[var(--cx-rule)] text-[0.85rem]">
              {[
                ["Area", scenes.area.name],
                ["Collection", scenes.collection],
                ["Dates", `${formatDate(before.datetime)} and ${formatDate(after.datetime)}`],
                ["Platform and tile", `${before.platform}, tile ${before.mgrsTile}, orbit ${before.relativeOrbit}, both scenes`],
                ["Resolution", "10 m true-colour bands, resampled for display"],
                ["Cloud cover", "Below 0.01% in both scenes"],
              ].map(([term, value]) => (
                <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3">
                  <dt className="font-semibold text-[var(--cx-ink)]">{term}</dt>
                  <dd className="text-[var(--cx-slate)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties} className="mt-8">
              <p className="cx-label !text-[#9a6a1f]">Limitations</p>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--cx-ink)]">{scenes.limitations}</p>
              <p className="cx-caption mt-4 break-all">
                Items: {before.item}; {after.item}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-6 border-t border-[var(--cx-rule)] pt-10 md:grid-cols-3 lg:mt-20">
          {[
            ["Available now", "Catalogue search for recent, low-cloud Sentinel-2 Level-2A scenes over each confirmed site, stored with the item identifier and date."],
            ["Not yet computed", "Vegetation (NDVI) and surface-water indices. These need band downloads, which this prototype does not perform."],
            ["Never claimed", "Damage, flood depth or loss from imagery alone. A satellite view is context for a reviewer, not a verdict."],
          ].map(([title, copy], index) => (
            <div key={title} data-reveal style={{ "--reveal-delay": `${index * 100}ms` } as React.CSSProperties}>
              <p className="font-display text-[1.25rem] text-[var(--cx-ink)]">{title}</p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--cx-slate)]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
