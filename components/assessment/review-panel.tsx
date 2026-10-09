"use client";

import { useState, useTransition } from "react";
import { previewAssessmentAnswers, type PreviewResult } from "@/lib/actions/assessment";
import type { ReportModel } from "@/lib/reports/model";
import { rowTitle } from "@/components/assessment/step-form";
import type { StepProgress } from "@/lib/questionnaire/completeness";
import { contextFor, geopointKeys, isQuestionVisible, isSectionVisible, questionAnswered } from "@/lib/questionnaire/engine";
import type { AnswerValue, AssessmentAnswers, QuestionDefinition, StepDefinition } from "@/lib/questionnaire/types";

function display(question: QuestionDefinition, values: Record<string, AnswerValue>): string {
  if (question.type === "geopoint") {
    const keys = geopointKeys(question.key);
    const lat = values[keys.lat];
    const lon = values[keys.lon];
    return typeof lat === "number" && typeof lon === "number" ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : "—";
  }
  const value = values[question.key];
  const label = (item: string) => question.options?.find((option) => option.value === item)?.label ?? item;
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return `${value.toLocaleString("en-IN")}${question.unit ? ` ${question.unit}` : question.type === "percentage" ? "%" : ""}`;
  if (typeof value === "string") return question.type === "tristate" ? ({ yes: "Yes", no: "No", unknown: "Not sure" } as Record<string, string>)[value] ?? value : label(value);
  return "—";
}

function StepSummary({ step, answers }: { step: StepDefinition; answers: AssessmentAnswers }) {
  const context = contextFor(answers);
  const lines: Array<{ label: string; value: string }> = [];
  for (const section of step.sections) {
    if (!isSectionVisible(section, context)) continue;
    for (const question of section.questions ?? []) {
      if (question.sensitivity === "restricted_financial" && question.type === "currency") continue;
      if (isQuestionVisible(question, context) && questionAnswered(question, answers.values)) lines.push({ label: question.label, value: display(question, answers.values) });
    }
    if (section.group) {
      const rows = answers.groups[section.group.key] ?? [];
      if (rows.length) lines.push({ label: section.group.label, value: rows.map((row, index) => rowTitle(section.group!, row, index)).join("; ") });
    }
  }
  if (step.id === "financials" && answers.values["fin.include"] === "yes") lines.push({ label: "Financial figures", value: "Entered (not repeated here)" });
  if (!lines.length) return <p className="ax-help mt-1">No answers yet.</p>;
  return (
    <dl className="ax-kv">
        {lines.slice(0, 6).map((line, index) => (
          <div key={`${index}-${line.label}`} className="contents">
          <dt>{line.label}</dt>
          <dd className="break-words">{line.value}</dd>
        </div>
      ))}
      {lines.length > 6 ? (
        <>
          <dt />
          <dd className="text-[var(--ax-muted)]">and {lines.length - 6} more</dd>
        </>
      ) : null}
    </dl>
  );
}

export function ReviewPanel({
  steps,
  progress,
  answers,
  onEdit,
  submitIssueCount,
  onPreview,
}: {
  steps: StepDefinition[];
  progress: StepProgress[];
  answers: AssessmentAnswers;
  onEdit: (id: string) => void;
  submitIssueCount: number;
  onPreview: (report: ReportModel | null) => void;
}) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(progress.map((item) => [item.stepId, item]));
  return (
    <>
      <section className="ax-section">
        <p className="ax-section-title">Summary</p>
        <p className="ax-section-desc">
          {submitIssueCount === 0 ? "All required answers are complete." : `${submitIssueCount} required answer${submitIssueCount === 1 ? "" : "s"} or consent${submitIssueCount === 1 ? "" : "s"} still open before submission.`}
        </p>
        <div className="mt-2">
          {steps.filter((step) => step.id !== "review").map((step) => {
            const item = byId.get(step.id);
            return (
              <div key={step.id} className="ax-review-row">
                <span className="ax-nav-num pt-0.5">{String(step.number).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{step.title}</p>
                  <p className={item?.issues ? "ax-error" : "ax-help"}>
                    {item?.issues ? `${item.issues} to fix · ` : ""}
                    {item?.required ? `${item.answered} of ${item.required} required answered` : "No required answers"}
                  </p>
                  <StepSummary step={step} answers={answers} />
                </div>
                <button type="button" className="ax-link-btn" onClick={() => onEdit(step.id)}>Edit</button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="ax-section">
        <p className="ax-section-title">Preview without saving</p>
        <p className="ax-section-desc">
          Runs the full analysis for the primary site: live forecast, local climatology, official alerts, World Bank flood exposure, river discharge, climate projections and Sentinel-2 imagery, then a summary grounded in that evidence. Nothing is stored. Submission runs every site and keeps the results.
        </p>
        <button
          type="button"
          className="ax-btn ax-btn-secondary mt-4"
          disabled={pending || submitIssueCount > 0}
          onClick={() =>
            startTransition(async () => {
              const result = await previewAssessmentAnswers(answers);
              setPreview(result);
              onPreview(result.report ?? null);
            })
          }
        >
          {pending ? "Retrieving data and analysing (up to a minute)" : "Run detailed preview"}
        </button>
        {preview ? (
          <div className={preview.ok ? "ax-notice" : "ax-notice ax-warn"} role="status">
            <p>{preview.message}</p>
            {preview.ok ? (
              <a className="ax-link-btn mt-2 inline-block" href="#assessment-report">
                Read the detailed result below
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
