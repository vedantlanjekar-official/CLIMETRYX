"use client";

import { AlertCircle, Check, Circle, CircleDashed, CircleDot } from "lucide-react";
import type { StepProgress, StepState } from "@/lib/questionnaire/completeness";
import type { StepDefinition } from "@/lib/questionnaire/types";

const STATE_LABEL: Record<StepState, string> = {
  complete: "Complete",
  in_progress: "In progress",
  attention: "Needs attention",
  not_started: "Not started",
  optional: "Optional",
};

function StateIcon({ state }: { state: StepState }) {
  const common = "h-3.5 w-3.5";
  if (state === "complete") return <Check className={`${common} text-[var(--ax-green)]`} aria-hidden />;
  if (state === "attention") return <AlertCircle className={`${common} text-[var(--ax-red)]`} aria-hidden />;
  if (state === "in_progress") return <CircleDot className={`${common} text-[var(--ax-amber)]`} aria-hidden />;
  if (state === "optional") return <CircleDashed className={`${common} text-[var(--ax-muted)]`} aria-hidden />;
  return <Circle className={`${common} text-[var(--ax-border-strong)]`} aria-hidden />;
}

export function StepNavigator({ steps, progress, current, level, onSelect }: { steps: StepDefinition[]; progress: StepProgress[]; current: string; level: "A" | "B"; onSelect: (id: string) => void }) {
  const byId = new Map(progress.map((item) => [item.stepId, item]));
  const done = progress.filter((item) => item.state === "complete").length;
  return (
    <nav className="ax-nav" aria-label="Assessment steps">
      <p className="ax-nav-heading">Assessment · Level {level}</p>
      <p className="ax-nav-summary mt-2 text-[0.8125rem] text-[var(--ax-muted)]">
        {done} of {steps.length} steps complete
      </p>
      <label className="ax-nav-select mt-2">
        <span className="sr-only">Go to step</span>
        <select className="ax-control" value={current} onChange={(event) => onSelect(event.target.value)}>
          {steps.map((step) => (
            <option key={step.id} value={step.id}>
              {step.number}. {step.short} · {STATE_LABEL[byId.get(step.id)?.state ?? "not_started"]}
            </option>
          ))}
        </select>
      </label>
      <ol className="ax-nav-list">
        {steps.map((step) => {
          const state = byId.get(step.id)?.state ?? "not_started";
          return (
            <li key={step.id}>
              <button type="button" className="ax-nav-item" aria-current={step.id === current ? "step" : undefined} onClick={() => onSelect(step.id)}>
                <span className="ax-nav-num">{String(step.number).padStart(2, "0")}</span>
                <span>
                  {step.short}
                  <span className="sr-only">, {STATE_LABEL[state]}</span>
                </span>
                <StateIcon state={state} />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
