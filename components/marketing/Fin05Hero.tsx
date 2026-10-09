import Link from "next/link";
import { HeroNav, type HeroNavLink } from "@/components/marketing/hero-nav";
import { HeroVideo } from "@/components/marketing/hero-video";
import { BRAND } from "@/lib/brand";
import { marketingNav } from "@/lib/navigation";
import "./fin05-hero.css";

const NAV_LINKS: readonly HeroNavLink[] = marketingNav.map((item) => ({ href: `#${item.section}`, label: item.label }));

const HAZARDS = ["Flood", "Heat", "Drought", "Storm"];

export function Fin05Hero({ nextSectionId }: { nextSectionId: string }) {
  return (
    <section aria-labelledby="fin05-hero-title" className="fin05-hero relative isolate flex min-h-[100svh] flex-col overflow-hidden lg:h-[100svh] lg:min-h-[680px]">
      <HeroVideo src="/videos/fin05-hero.mp4" poster="/videos/fin05-hero-poster.webp" />
      <div aria-hidden className="fin05-hero__wash pointer-events-none absolute inset-0" />
      <div aria-hidden className="fin05-hero__fade pointer-events-none absolute inset-x-0 bottom-0 h-40 lg:h-48" />

      <HeroNav links={NAV_LINKS} />

      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-6 sm:px-10 lg:justify-center lg:px-14">
        <div className="fin05-hero__content max-w-[40rem] pt-6 sm:pt-10 lg:-mt-10 lg:max-w-[min(46vw,44rem)] lg:pt-0">
          <p
            className="fin05-hero__reveal flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--hero-emerald)] sm:text-[0.72rem]"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            <span aria-hidden className="h-px w-8 bg-current opacity-60" />
            {BRAND.tagline}
          </p>

          <h1
            id="fin05-hero-title"
            className="fin05-hero__reveal mt-6 text-balance font-display text-[clamp(2.4rem,1.3rem+3.6vw,4.9rem)] font-medium leading-[1.03] tracking-[-0.03em] text-[var(--hero-ink)] [font-variation-settings:'opsz'_144,'SOFT'_30]"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            Turn climate intelligence into{" "}
            <em className="font-normal text-[var(--hero-emerald)] [font-variation-settings:'opsz'_144,'SOFT'_100]">actionable business resilience.</em>
          </h1>

          <p
            className="fin05-hero__reveal mt-6 max-w-[33rem] text-[0.98rem] leading-[1.7] text-[var(--hero-ink-soft)] sm:text-[1.075rem]"
            style={{ "--delay": "280ms" } as React.CSSProperties}
          >
            {BRAND.description}
          </p>

          <div
            className="fin05-hero__reveal mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8"
            style={{ "--delay": "380ms" } as React.CSSProperties}
          >
            <Link
              href="/businesses"
              className="group inline-flex h-[3.25rem] items-center gap-3 rounded-[10px] bg-[var(--hero-ink)] pl-6 pr-5 text-[0.95rem] font-semibold text-white no-underline shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_14px_30px_-14px_rgb(12_31_36/0.7)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[var(--hero-emerald)] hover:shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_16px_34px_-14px_rgb(18_112_76/0.75)] active:translate-y-px"
            >
              Assess your business
              <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href={`#${nextSectionId}`}
              className="fin05-link fin05-link--static group inline-flex items-center gap-2 pb-1 text-[0.95rem] font-semibold text-[var(--hero-ink)] no-underline"
            >
              Explore our approach
              <span aria-hidden className="text-[var(--hero-emerald)] transition-transform duration-300 ease-out group-hover:translate-y-0.5">↓</span>
            </Link>
          </div>

          <p
            className="fin05-hero__reveal mt-12 hidden text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[var(--hero-ink-soft)]/80 sm:block"
            style={{ "--delay": "480ms" } as React.CSSProperties}
          >
            {HAZARDS.map((hazard, index) => (
              <span key={hazard}>
                {index > 0 ? <span aria-hidden className="mx-3 text-[var(--hero-emerald)]">·</span> : null}
                {hazard}
              </span>
            ))}
          </p>
        </div>

        <div aria-hidden className="min-h-[34svh] flex-1 lg:hidden" />
      </div>

      <a
        href={`#${nextSectionId}`}
        className="group absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[var(--hero-ink-soft)] no-underline transition-colors hover:text-[var(--hero-ink)] xl:flex [@media(max-height:799px)]:!hidden"
      >
        Scroll to explore
        <span aria-hidden className="fin05-cue__line block h-10 w-px" />
      </a>
    </section>
  );
}
