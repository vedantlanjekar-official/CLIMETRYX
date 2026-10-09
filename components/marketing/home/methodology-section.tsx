import registry from "@/metadata/source-registry.json";
import { SectionIntro } from "@/components/marketing/home/section-intro";

type Source = (typeof registry.sources)[number];

const GROUPS: readonly { title: string; note: string; statuses: readonly string[]; tone: string }[] = [
  {
    title: "Verified and in use",
    note: "A live response was inspected during implementation.",
    statuses: ["verified"],
    tone: "var(--cx-emerald)",
  },
  {
    title: "Identified, not yet connected",
    note: "Needs a download, credentials, configuration or a licence check.",
    statuses: ["needs_download", "needs_credentials", "needs_configuration", "requires_license_check", "implemented_unverified"],
    tone: "#b07d2a",
  },
  {
    title: "Not available",
    note: "No suitable feed exists, or the reference could not be identified.",
    statuses: ["unavailable"],
    tone: "var(--cx-slate)",
  },
];

const STATUS_TEXT: Record<string, string> = {
  verified: "Verified",
  needs_download: "Needs download",
  needs_credentials: "Needs credentials",
  needs_configuration: "Needs configuration",
  requires_license_check: "Licence check",
  implemented_unverified: "Unverified",
  unavailable: "Unavailable",
};

const LINEAGE = [
  ["Source", "Provider, licence and attribution"],
  ["Retrieval", "Request time and coordinates"],
  ["Normalisation", "Versioned transformation"],
  ["Hazard module", "Thresholds and limitations"],
  ["Indicator", "Weights, completeness"],
  ["Report", "Exportable and reproducible"],
] as const;

function statusText(source: Source) {
  const label = STATUS_TEXT[source.status] ?? source.status;
  const partial = "verification" in source && /partial/i.test(String(source.verification));
  return partial ? `${label} · partial` : label;
}

function uniqueByName(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => (seen.has(source.name) ? false : (seen.add(source.name), true)));
}

export function MethodologySection() {
  const updated = new Date(registry.updated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <section id="methodology" aria-labelledby="methodology-title" className="cx-section bg-[var(--cx-mist)]">
      <div className="cx-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <SectionIntro
            id="methodology-title"
            index="12"
            label="Data and methodology"
            className="lg:col-span-7"
            title={
              <>
                Every number can be traced <em>back to where it came from.</em>
              </>
            }
          />
          <p data-reveal className="cx-lede lg:col-span-5">
            Sources are listed with their real status in this workspace. Anything not yet connected says so, and nothing is filled in to make a result look complete.
          </p>
        </div>

        <ol aria-label="Data lineage" className="mt-16 grid grid-cols-2 gap-y-8 border-y border-[var(--cx-rule)] py-8 sm:grid-cols-3 lg:mt-20 lg:grid-cols-6">
          {LINEAGE.map(([step, note], index) => (
            <li key={step} data-reveal style={{ "--reveal-delay": `${index * 70}ms` } as React.CSSProperties} className="relative pr-6">
              <p className="text-[0.68rem] font-bold tabular-nums tracking-[0.18em] text-[var(--cx-emerald)]">0{index + 1}</p>
              <p className="mt-2 font-display text-[1.15rem] text-[var(--cx-ink)]">{step}</p>
              <p className="mt-1 text-[0.8rem] leading-snug text-[var(--cx-slate)]">{note}</p>
              {index < LINEAGE.length - 1 ? (
                <span aria-hidden className="absolute right-3 top-6 hidden text-[var(--cx-emerald)] lg:block">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-14 lg:grid-cols-3 lg:gap-12">
          {GROUPS.map((group, groupIndex) => {
            const sources = uniqueByName(registry.sources.filter((source) => group.statuses.includes(source.status)));
            return (
              <div key={group.title} data-reveal style={{ "--reveal-delay": `${groupIndex * 110}ms` } as React.CSSProperties}>
                <p className="flex items-center gap-2.5 font-display text-[1.35rem] text-[var(--cx-ink)]">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: group.tone }} />
                  {group.title}
                </p>
                <p className="mt-1.5 text-[0.8rem] text-[var(--cx-slate)]">{group.note}</p>
                <ul className="mt-6 divide-y divide-[var(--cx-rule)] border-t border-[var(--cx-rule)]">
                  {sources.map((source) => (
                    <li key={source.id} className="flex items-baseline justify-between gap-4 py-3">
                      <span className="text-[0.9rem] text-[var(--cx-ink)]">
                        {source.docsUrl ? (
                          <a href={source.docsUrl} target="_blank" rel="noreferrer" className="decoration-[var(--cx-rule)] underline-offset-[3px] hover:underline">
                            {source.name}
                          </a>
                        ) : (
                          source.name
                        )}
                      </span>
                      <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--cx-slate)]">{statusText(source)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="cx-caption mt-14 border-t border-[var(--cx-rule)] pt-8">
          Registry updated {updated}. Weather data by Open-Meteo.com, free API for non-commercial use.
        </p>
      </div>
    </section>
  );
}
