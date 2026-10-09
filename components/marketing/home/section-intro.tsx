import { clsx } from "clsx";

type SectionIntroProps = {
  index: string;
  label: string;
  title: React.ReactNode;
  id: string;
  lede?: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
};

export function SectionIntro({ index, label, title, id, lede, className, tone = "light" }: SectionIntroProps) {
  return (
    <header className={clsx("max-w-[46rem]", className)}>
      <p data-reveal className={clsx("cx-index", tone === "dark" && "!text-[var(--cx-teal)] [&_span]:!text-white/50")}>
        <span>{index}</span>
        {label}
      </p>
      <h2 id={id} data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties} className={clsx("cx-display mt-6", tone === "dark" && "!text-white")}>
        {title}
      </h2>
      {lede ? (
        <p data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties} className={clsx("cx-lede mt-6 max-w-[38rem]", tone === "dark" && "!text-white/70")}>
          {lede}
        </p>
      ) : null}
    </header>
  );
}
