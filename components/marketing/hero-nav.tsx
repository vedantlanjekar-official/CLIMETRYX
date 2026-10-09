"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/layout/brand-mark";

export type HeroNavLink = { href: string; label: string };

export function HeroNav({ links }: { links: readonly HeroNavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between px-6 py-6 sm:px-10 lg:px-14 lg:py-8">
        <Link href="/" aria-label={`${BRAND.name} home`} className="group flex items-center gap-3 text-[var(--hero-ink)] no-underline">
          <BrandLogo priority className="h-10 w-10 transition-transform duration-300 group-hover:scale-105" />
          <span className="font-display text-[1.45rem] font-semibold tracking-[0.04em]">{BRAND.name}</span>
          <span className="hidden text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--hero-ink-soft)] sm:inline">
            Climate signals
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex xl:gap-9">
          <ul className="flex items-center gap-6 text-[0.875rem] font-medium text-[var(--hero-ink-soft)] xl:gap-8">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="fin05-link pb-1 no-underline hover:text-[var(--hero-ink)]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-[10px] px-3 py-2 text-[0.875rem] font-semibold text-[var(--hero-ink)] no-underline transition-colors duration-200 hover:bg-[var(--hero-ink)]/[0.06]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-[10px] bg-[var(--hero-ink)] px-4 py-2 text-[0.875rem] font-semibold text-white no-underline transition-colors duration-200 hover:bg-[var(--hero-emerald)]"
            >
              Get started
            </Link>
          </div>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="relative -mr-2 grid h-11 w-11 place-items-center text-[var(--hero-ink)] lg:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className="relative block h-3 w-6">
            <span className={clsx("absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300", open && "translate-y-1.5 rotate-45")} />
            <span className={clsx("absolute bottom-0 left-0 h-px w-6 bg-current transition-transform duration-300", open && "-translate-y-1.5 -rotate-45")} />
          </span>
        </button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-y border-[var(--hero-ink)]/10 bg-[#f7f9f7]/95 backdrop-blur-md lg:hidden"
      >
        <nav aria-label="Primary mobile" className="mx-auto max-w-[88rem] px-6 py-4 sm:px-10">
          <ul className="divide-y divide-[var(--hero-ink)]/10">
            {[...links, { href: "/login", label: "Sign in" }, { href: "/signup", label: "Get started" }].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center justify-between text-base font-medium text-[var(--hero-ink)] no-underline"
                >
                  {link.label}
                  <span aria-hidden className="text-[var(--hero-ink-soft)]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
