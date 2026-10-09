"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

type Row = { key: number; name: string; upfront: string; annual: string };

const PLACEHOLDERS = ["e.g. Backup power for critical loads", "e.g. Raised racking for stock", "e.g. Second water storage tank"];
const YEARS = 5;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const amount = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export function CostingWorksheet() {
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() => PLACEHOLDERS.map((_, key) => ({ key, name: "", upfront: "", annual: "" })));
  const [avoided, setAvoided] = useState("");
  const [nextKey, setNextKey] = useState(PLACEHOLDERS.length);

  const update = (key: number, field: keyof Omit<Row, "key">, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  const upfront = rows.reduce((sum, row) => sum + amount(row.upfront), 0);
  const annual = rows.reduce((sum, row) => sum + amount(row.annual), 0);
  const avoidedPerYear = amount(avoided);
  const hasCosts = upfront > 0 || annual > 0;
  const netAnnual = avoidedPerYear - annual;
  const payback = upfront > 0 && avoidedPerYear > 0 && netAnnual > 0 ? upfront / netAnnual : null;

  const inputClass =
    "h-11 w-full rounded-[6px] border border-[var(--cx-rule)] bg-white px-3 text-[0.9rem] text-[var(--cx-ink)] placeholder:text-[var(--cx-slate)]/70 focus:border-[var(--cx-emerald)] focus:outline-none focus:ring-2 focus:ring-[var(--cx-emerald)]/20";

  return (
    <div>
      <div className="hidden grid-cols-[1fr_9rem_9rem_2.75rem] gap-3 pb-3 sm:grid">
        <p className="cx-label">Measure</p>
        <p className="cx-label">One-time cost (₹)</p>
        <p className="cx-label">Yearly cost (₹)</p>
        <span />
      </div>
      <ul className="space-y-4 sm:space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="grid grid-cols-2 gap-3 border-b border-[var(--cx-rule)] pb-4 sm:grid-cols-[1fr_9rem_9rem_2.75rem] sm:border-0 sm:pb-0">
            <label className="col-span-2 sm:col-span-1">
              <span className="sr-only">Measure {index + 1}</span>
              <input className={inputClass} value={row.name} placeholder={PLACEHOLDERS[index] ?? "Measure"} onChange={(e) => update(row.key, "name", e.target.value)} />
            </label>
            <label>
              <span className="cx-label mb-1 block sm:sr-only">One-time cost (₹)</span>
              <input className={`${inputClass} tabular-nums`} inputMode="numeric" value={row.upfront} placeholder="0" onChange={(e) => update(row.key, "upfront", e.target.value)} />
            </label>
            <label>
              <span className="cx-label mb-1 block sm:sr-only">Yearly cost (₹)</span>
              <input className={`${inputClass} tabular-nums`} inputMode="numeric" value={row.annual} placeholder="0" onChange={(e) => update(row.key, "annual", e.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              disabled={rows.length === 1}
              className="col-span-2 grid h-11 place-items-center justify-self-end rounded-[6px] px-3 text-[var(--cx-slate)] transition-colors hover:bg-white hover:text-[var(--cx-ink)] disabled:opacity-30 sm:col-span-1 sm:w-11 sm:px-0"
            >
              <X aria-hidden className="h-4 w-4" />
              <span className="sr-only">Remove measure {index + 1}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, name: "", upfront: "", annual: "" }]);
          setNextKey((value) => value + 1);
        }}
        className="mt-4 inline-flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--cx-emerald-deep)] hover:text-[var(--cx-ink)]"
      >
        <Plus aria-hidden className="h-4 w-4" /> Add a measure
      </button>

      <label htmlFor={`${baseId}-avoided`} className="mt-8 block border-t border-[var(--cx-rule)] pt-6">
        <span className="cx-label">Optional · your estimate of disruption cost avoided per year (₹)</span>
        <input
          id={`${baseId}-avoided`}
          className={`${inputClass} mt-2 max-w-xs tabular-nums`}
          inputMode="numeric"
          value={avoided}
          placeholder="0"
          onChange={(e) => setAvoided(e.target.value)}
        />
      </label>

      <dl aria-live="polite" className="mt-8 grid grid-cols-2 gap-6 border-t border-[var(--cx-ink)] pt-6 sm:grid-cols-4">
        {[
          ["One-time total", hasCosts ? inr.format(upfront) : "—"],
          ["Yearly total", hasCosts ? inr.format(annual) : "—"],
          [`${YEARS}-year cost`, hasCosts ? inr.format(upfront + annual * YEARS) : "—"],
          ["Simple payback", payback === null ? "—" : `${payback.toFixed(1)} years`],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="cx-label">{term}</dt>
            <dd className="mt-2 font-display text-[1.45rem] tabular-nums tracking-[-0.01em] text-[var(--cx-ink)]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="cx-caption mt-5">
        Totals use only the figures you enter. Payback appears when an avoided-cost estimate exceeds the yearly cost; it is undiscounted and ignores financing. Nothing here is saved or sent.
      </p>
    </div>
  );
}
