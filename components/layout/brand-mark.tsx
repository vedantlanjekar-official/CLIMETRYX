import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { BRAND } from "@/lib/brand";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={BRAND.logo}
      alt=""
      aria-hidden
      width={512}
      height={512}
      priority={priority}
      sizes="48px"
      className={clsx("shrink-0 select-none object-contain", className)}
    />
  );
}

export function BrandMark({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <Link href="/" className={clsx("group inline-flex items-center gap-2.5", className)}>
      <BrandLogo className="h-9 w-9 transition-transform duration-300 group-hover:scale-105" />
      <span className="leading-tight">
        <span className={clsx("block font-display text-lg font-semibold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>{BRAND.name}</span>
        <span className={clsx("block text-[0.62rem] font-semibold uppercase tracking-[0.2em]", tone === "light" ? "text-brand-200/70" : "text-muted")}>
          Climate signals · Clearer decisions
        </span>
      </span>
    </Link>
  );
}
