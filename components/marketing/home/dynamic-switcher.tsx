"use client";

import { useId, useRef, useState } from "react";
import { clsx } from "clsx";

type Mode = {
  id: string;
  label: string;
  trigger: string;
  effect: string;
  kept: string;
  series: number[];
  previous?: number[];
  eventAt: number;
  eventLabel: string;
};

const MODES: readonly Mode[] = [
  {
    id: "environment",
    label: "Environmental change",
    trigger: "A new forecast shows rainfall above the site's local 99th-percentile wet day.",
    effect: "The hazard component rises for that run. The business profile is unchanged.",
    kept: "The forecast, its retrieval time and the threshold it crossed are saved with the run.",
    series: [38, 40, 39, 53, 55, 47],
    eventAt: 3,
    eventLabel: "Heavy-rain screen reached",
  },
  {
    id: "business",
    label: "Business input change",
    trigger: "The owner reports a backup generator and a second water source.",
    effect: "The adaptive-capacity gap narrows, so the indicator falls in the next run.",
    kept: "Each saved run keeps its own components and explanation, so the before and after can be compared.",
    series: [52, 51, 52, 42, 41, 41],
    eventAt: 3,
    eventLabel: "Resilience measures reported",
  },
  {
    id: "operations",
    label: "Operational exposure",
    trigger: "A new single-source supplier is added for a critical input.",
    effect: "Supply-chain vulnerability increases until an alternate supplier is recorded.",
    kept: "The run's explanation names the supply-chain component and the answers behind it.",
    series: [40, 41, 48, 49, 48, 43],
    eventAt: 2,
    eventLabel: "Single-source supplier added",
  },
  {
    id: "revision",
    label: "Assessment revision",
    trigger: "The methodology is updated, for example to add a humid-heat screen.",
    effect: "New runs use the new version. Earlier results are not overwritten.",
    kept: "Every run stores the methodology version that produced it.",
    series: [45, 46, 45, 48, 48, 49],
    previous: [45, 46, 45, 45, 45, 46],
    eventAt: 3,
    eventLabel: "New methodology version",
  },
];

const W = 640;
const H = 300;
const PAD = { top: 24, right: 24, bottom: 40, left: 40 };
const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / 5;
const y = (v: number) => PAD.top + ((100 - v) / 100) * (H - PAD.top - PAD.bottom);
const path = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

export function DynamicSwitcher() {
  const [active, setActive] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const mode = MODES[active];

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + MODES.length) % MODES.length;
    setActive(next);
    tabsRef.current[next]?.focus();
  };

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
      <div role="tablist" aria-label="Kinds of change" aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col border-t border-[var(--cx-rule)] lg:col-span-4">
        {MODES.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabsRef.current[index] = node;
              }}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={clsx(
                "group flex items-center justify-between gap-4 border-b border-[var(--cx-rule)] py-5 text-left transition-colors duration-200",
                selected ? "text-[var(--cx-ink)]" : "text-[var(--cx-slate)] hover:text-[var(--cx-ink)]",
              )}
            >
              <span className="flex items-baseline gap-4">
                <span className="text-[0.7rem] font-bold tabular-nums tracking-[0.18em] text-[var(--cx-emerald)]">0{index + 1}</span>
                <span className="font-display text-[1.3rem] tracking-[-0.01em]">{item.label}</span>
              </span>
              <span aria-hidden className={clsx("h-px bg-[var(--cx-emerald)] transition-all duration-300", selected ? "w-8" : "w-0 group-hover:w-4")} />
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${mode.id}`} className="lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="cx-flag">Illustrative values · not assessment output</p>
          {mode.previous ? (
            <p className="flex items-center gap-4 text-[0.75rem] text-[var(--cx-slate)]">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-5 bg-[var(--cx-emerald)]" /> Current version
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-[#9fb5ad]" /> Previous version
              </span>
            </p>
          ) : null}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Illustrative indicator across six runs. ${mode.eventLabel} at run ${mode.eventAt + 1}.`} className="mt-6 h-auto w-full">
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#dce5de" strokeWidth="1" />
              <text x={PAD.left - 10} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#536471">
                {tick}
              </text>
            </g>
          ))}
          {mode.series.map((_, i) => (
            <text key={i} x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="#536471">
              Run {i + 1}
            </text>
          ))}
          <line x1={x(mode.eventAt)} x2={x(mode.eventAt)} y1={PAD.top} y2={H - PAD.bottom} stroke="#0b896b" strokeWidth="1" strokeDasharray="3 4" />
          <text x={x(mode.eventAt) + 8} y={PAD.top + 12} fontSize="12" fontWeight="600" fill="#0b1d29">
            {mode.eventLabel}
          </text>
          {mode.previous ? <path d={path(mode.previous)} fill="none" stroke="#9fb5ad" strokeWidth="2" strokeDasharray="5 5" /> : null}
          <path key={mode.id} d={path(mode.series)} fill="none" stroke="#0b896b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="cx-draw" pathLength={1} />
          {mode.series.map((v, i) => (
            <circle key={`${mode.id}-${i}`} cx={x(i)} cy={y(v)} r={i === mode.eventAt ? 5.5 : 3.5} fill={i === mode.eventAt ? "#0b896b" : "#fafbf8"} stroke="#0b896b" strokeWidth="2" />
          ))}
        </svg>

        <dl className="mt-8 grid gap-6 border-t border-[var(--cx-rule)] pt-6 text-[0.9rem] leading-relaxed sm:grid-cols-3">
          {[
            ["What triggers it", mode.trigger],
            ["What changes", mode.effect],
            ["What is kept", mode.kept],
          ].map(([term, value]) => (
            <div key={term}>
              <dt className="cx-label">{term}</dt>
              <dd className="mt-2 text-[var(--cx-ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
