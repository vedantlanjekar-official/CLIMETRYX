"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-mark";
import { BRAND } from "@/lib/brand";

type Mode = "signin" | "signup";

const SLIDE_MS = 900;
const slide =
  "transform-gpu will-change-transform transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none";

const captions: Record<Mode, { title: string; body: string }> = {
  signin: {
    title: "Welcome back.",
    body: "Sign in to continue your sites, hazard screening, and resilience reports.",
  },
  signup: {
    title: "Build your resilience profile.",
    body: "Create a workspace to assess climate exposure with every weight and source disclosed.",
  },
};

const videos: Record<Mode, string> = {
  signin: "/media/auth-sign-in.mp4",
  signup: "/media/auth-sign-up.mp4",
};

function ModeSwitch({ mode }: { mode: Mode }) {
  return (
    <div className="relative mx-auto grid w-full grid-cols-2 rounded-xl border border-line bg-canvas p-1 text-sm font-semibold">
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-surface shadow-[0_1px_2px_rgb(15_31_29/0.08),0_4px_12px_-6px_rgb(19_69_64/0.3)] ring-1 ring-line",
          "transform-gpu transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
          mode === "signup" && "translate-x-full",
        )}
      />
      {(["signin", "signup"] as const).map((option) => (
        <Link
          key={option}
          href={option === "signin" ? "/login" : "/signup"}
          aria-current={mode === option ? "page" : undefined}
          className={clsx(
            "relative z-10 rounded-lg py-2 text-center no-underline transition-colors duration-300",
            mode === option ? "text-brand-800" : "text-muted hover:text-ink",
          )}
        >
          {option === "signin" ? "Sign in" : "Sign up"}
        </Link>
      ))}
    </div>
  );
}

function modeForPath(path: string | null): Mode | null {
  if (path === "/signup") return "signup";
  if (path === "/login") return "signin";
  return null;
}

/** Plays only the visible video; the hidden one pauses once the crossfade has finished. */
function useActiveVideo(mode: Mode) {
  const refs = useRef<Partial<Record<Mode, HTMLVideoElement | null>>>({});
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    refs.current[mode]?.play().catch(() => {});
    const timer = window.setTimeout(() => {
      for (const key of Object.keys(refs.current) as Mode[]) {
        if (key !== mode) refs.current[key]?.pause();
      }
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);
  return refs;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ from: string; mode: Mode } | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPending(null);
  }
  const routeMode: Mode = modeForPath(pathname) ?? "signin";
  const mode: Mode = pending && pending.from === pathname ? pending.mode : routeMode;
  const showSwitch = modeForPath(pathname) !== null;
  const videoRefs = useActiveVideo(mode);

  // Start the slide on click instead of waiting for the route to finish loading.
  const onClickCapture = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const anchor = (event.target as HTMLElement).closest("a");
    const target = modeForPath(anchor?.getAttribute("href") ?? null);
    if (target && target !== routeMode) setPending({ from: pathname, mode: target });
  };

  return (
    <main onClickCapture={onClickCapture} className="relative min-h-dvh overflow-hidden bg-brand-950 lg:h-dvh lg:min-h-[640px] lg:bg-white">
      {/* Video panel: 70% wide, edge to edge. Left for sign in, right for sign up. */}
      <section
        aria-hidden
        className={clsx(
          "absolute inset-0 overflow-hidden bg-brand-950 lg:right-auto lg:w-[70%]",
          slide,
          mode === "signup" ? "lg:translate-x-[42.857%]" : "lg:translate-x-0",
        )}
      >
        {(Object.keys(videos) as Mode[]).map((key) => (
          <video
            key={key}
            ref={(node) => {
              videoRefs.current[key] = node;
            }}
            src={videos[key]}
            muted
            loop
            playsInline
            preload="auto"
            className={clsx(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
              mode === key ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 hidden px-10 pb-10 lg:block xl:px-12 xl:pb-12">
          <div className="relative max-w-md">
            {(Object.keys(captions) as Mode[]).map((key) => (
              <div
                key={key}
                className={clsx(
                  "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                  key === "signup" && "absolute inset-x-0 bottom-0",
                  mode === key ? "translate-y-0 opacity-100 delay-500" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                <h2 className="font-display text-3xl font-medium leading-tight text-white xl:text-[2.1rem]">{captions[key].title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{captions[key].body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details panel: 30% wide on white. Right for sign in, left for sign up. */}
      <section
        className={clsx(
          "relative z-10 flex min-h-dvh w-full items-center justify-center px-5 py-10 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-[30%] lg:bg-white lg:px-8 lg:py-6 lg:shadow-[0_0_48px_rgb(0_0_0/0.18)] xl:px-12",
          slide,
          mode === "signup" ? "lg:translate-x-0" : "lg:translate-x-[233.333%]",
        )}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-lift lg:max-h-full lg:overflow-y-auto lg:rounded-none lg:p-0 lg:shadow-none">
          <Link href="/" className="group mx-auto flex w-fit flex-col items-center no-underline">
            <BrandLogo priority className="h-11 w-11 transition-transform duration-300 group-hover:scale-105" />
            <span className="mt-3 font-display text-xl font-semibold tracking-[0.04em] text-ink">{BRAND.name}</span>
            <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-brand-600">{BRAND.tagline}</span>
          </Link>

          {showSwitch ? (
            <div className="mt-7">
              <ModeSwitch mode={mode} />
            </div>
          ) : null}

          <div key={pathname} className="mt-7 animate-auth-in">
            {children}
          </div>

          <Link
            href="/"
            className="group mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-ink no-underline transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50"
          >
            Know more about {BRAND.name}
            <ArrowUpRight aria-hidden className="h-4 w-4 text-brand-600 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>

          <p className="mt-8 inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-brand-600" />
            Protected by Supabase Auth
          </p>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
            Decision support for review and preparedness. Not a probability of default.
          </p>
        </div>
      </section>
    </main>
  );
}
