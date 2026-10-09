"use client";

import type { DimensionCoverage, EvidenceSummary, MissingItem } from "@/lib/questionnaire/completeness";
import { DIMENSION_LABELS, type StepDefinition } from "@/lib/questionnaire/types";
import type { SiteForAnalysis } from "@/lib/questionnaire/mapping";

const COVERAGE_LABEL: Record<DimensionCoverage["coverage"], string> = {
  well_covered: "Well covered",
  partly_covered: "Partly covered",
  limited: "Limited",
  not_applicable: "Not shared",
};

const EVIDENCE_LABEL: Record<EvidenceSummary["label"], string> = {
  document_supported: "Mostly document-supported",
  mixed: "Mixed: some records, mostly self-reported",
  self_reported: "Self-reported",
};

export function ContextRail({
  step,
  coverage,
  evidence,
  missing,
  sites,
  siteCount,
  onJump,
}: {
  step: StepDefinition;
  coverage: DimensionCoverage[];
  evidence: EvidenceSummary;
  missing: MissingItem[];
  sites: SiteForAnalysis[];
  siteCount: number;
  onJump: (stepId: string) => void;
}) {
  const unanswered = missing.filter((item) => item.reason === "unanswered");
  const unknown = missing.filter((item) => item.reason === "unknown");
  const primary = sites[0];
  return (
    <aside className="ax-rail" aria-label="Context for this step">
      <section className="ax-rail-block">
        <h3>Why this is asked</h3>
        <p>{step.why}</p>
      </section>
      <section className="ax-rail-block">
        <h3>Informs</h3>
        <ul className="space-y-0.5">
          {step.dimensions.map((dimension) => (
            <li key={dimension}>{DIMENSION_LABELS[dimension]}</li>
          ))}
        </ul>
      </section>
      <section className="ax-rail-block">
        <h3>Data retrieved after submission</h3>
        {step.external.length ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {step.external.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--ax-muted)]">No external source for this step. Answers come from you.</p>
        )}
      </section>
      <section className="ax-rail-block">
        <h3>Input completeness</h3>
        <p className="text-[var(--ax-muted)]">Share of applicable questions answered with a known value. This is not a risk score.</p>
        <ul className="mt-3 space-y-2.5">
          {coverage.map((item) => {
            const known = item.answered - item.unknown;
            const share = item.applicable ? Math.round((known / item.applicable) * 100) : 0;
            return (
              <li key={item.dimension}>
                <div className="flex justify-between gap-2">
                  <span>{DIMENSION_LABELS[item.dimension]}</span>
                  <span className="text-[var(--ax-muted)]">{COVERAGE_LABEL[item.coverage]}</span>
                </div>
                {item.coverage !== "not_applicable" ? (
                  <div className="ax-meter" aria-hidden>
                    <span style={{ width: `${share}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="ax-rail-block">
        <h3>Unresolved</h3>
        {unanswered.length === 0 && unknown.length === 0 ? (
          <p>Nothing unresolved.</p>
        ) : (
          <>
            <p>
              {unanswered.length} required answer{unanswered.length === 1 ? "" : "s"} missing · {unknown.length} marked not sure
            </p>
            <ul className="mt-2 space-y-1">
              {unanswered.slice(0, 5).map((item) => (
                <li key={`${item.groupKey}-${item.rowId}-${item.key}`}>
                  <button type="button" className="ax-link-btn text-left font-medium" onClick={() => onJump(item.stepId)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="ax-rail-block">
        <h3>Evidence quality</h3>
        <p>{EVIDENCE_LABEL[evidence.label]}</p>
        <p className="text-[var(--ax-muted)]">
          {evidence.documentSupported} answers backed by records · {evidence.documents} document{evidence.documents === 1 ? "" : "s"} uploaded · {evidence.assumptions} stated assumptions
        </p>
      </section>
      <section className="ax-rail-block">
        <h3>Location context</h3>
        {primary ? (
          <>
            <p className="font-semibold">{primary.label}</p>
            <p className="tabular-nums text-[var(--ax-muted)]">
              {primary.latitude.toFixed(4)}, {primary.longitude.toFixed(4)}
            </p>
            <p>{primary.userConfirmed ? "Pin confirmed" : primary.acceptedLowPrecision ? "Approximate position accepted" : "Pin not yet confirmed"}</p>
            <p className="text-[var(--ax-muted)]">
              {sites.filter((site) => site.userConfirmed || site.acceptedLowPrecision).length} of {siteCount} site{siteCount === 1 ? "" : "s"} ready for analysis
            </p>
          </>
        ) : (
          <p className="text-[var(--ax-muted)]">No site position yet. Add one in step 3.</p>
        )}
      </section>
    </aside>
  );
}
