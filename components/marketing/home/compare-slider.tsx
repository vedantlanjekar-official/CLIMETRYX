"use client";

import { useState } from "react";
import Image from "next/image";

type Frame = { src: string; alt: string; label: string };

export function CompareSlider({ before, after, width, height }: { before: Frame; after: Frame; width: number; height: number }) {
  const [position, setPosition] = useState(50);

  return (
    <div className="cx-compare rounded-[4px] bg-[var(--cx-night)]" style={{ "--pos": `${position}%` } as React.CSSProperties}>
      <Image src={before.src} alt={before.alt} width={width} height={height} sizes="(min-width: 1024px) 66vw, 100vw" className="block h-auto w-full" />
      <div className="cx-compare__after">
        <Image src={after.src} alt={after.alt} width={width} height={height} sizes="(min-width: 1024px) 66vw, 100vw" className="block h-auto w-full" />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[var(--cx-night)]/80 px-3 py-1 text-[0.7rem] font-semibold text-white sm:left-4 sm:top-4">
        {before.label}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--cx-night)]/80 px-3 py-1 text-[0.7rem] font-semibold text-white sm:right-4 sm:top-4">
        {after.label}
      </span>

      <div aria-hidden className="cx-compare__handle">
        <span className="cx-compare__knob">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 4.5 2 9l4.5 4.5M11.5 4.5 16 9l-4.5 4.5" />
          </svg>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`Comparison position: ${before.label} on the left, ${after.label} on the right`}
        aria-valuetext={`${position}% ${before.label}, ${100 - position}% ${after.label}`}
      />
    </div>
  );
}
