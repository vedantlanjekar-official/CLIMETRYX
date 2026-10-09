import Link from "next/link";

export function ClosingSection() {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden bg-[var(--cx-night)] text-white">
      <div className="cx-container py-[clamp(6rem,4rem+8vw,11rem)]">
        <p data-reveal className="cx-index !text-[var(--cx-teal)] [&_span]:!text-white/50">
          <span>14</span>
          Begin
        </p>
        <h2
          id="closing-title"
          data-reveal
          style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          className="cx-display mt-8 max-w-[16ch] !text-[clamp(2.6rem,1.4rem+4.6vw,6rem)] !text-white"
        >
          Build resilience <em className="!text-[var(--cx-teal)]">before disruption arrives.</em>
        </h2>
        <div data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties} className="mt-14 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
          <Link href="/businesses" className="cx-button bg-white text-[var(--cx-night)] hover:bg-[var(--cx-teal)]">
            Assess your business
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="#methodology"
            className="inline-flex items-center gap-2 border-b border-white/30 pb-1 text-[0.95rem] font-semibold text-white no-underline transition-colors hover:border-white"
          >
            Explore the methodology
          </Link>
        </div>
        <p data-reveal style={{ "--reveal-delay": "220ms" } as React.CSSProperties} className="mt-16 max-w-[34rem] text-[0.85rem] leading-relaxed text-white/55">
          CLIMETRYX is decision support. Its indicator is not a probability of default and never makes a lending decision.
        </p>
      </div>
    </section>
  );
}
