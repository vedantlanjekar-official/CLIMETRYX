"use client";

import { Plus, Trash2 } from "lucide-react";
import { QuestionField } from "@/components/assessment/question-field";
import { isQuestionVisible, isSectionVisible, type EvalContext } from "@/lib/questionnaire/engine";
import { COUNTRIES } from "@/lib/questionnaire/builders";
import type { AnswerValue, AssessmentAnswers, GroupDefinition, Option, RepeatRow, StepDefinition } from "@/lib/questionnaire/types";

export type IssueMap = Map<string, string>;
export const issueKey = (groupKey: string | null, rowId: string | null, key: string) => `${groupKey ?? ""}|${rowId ?? ""}|${key}`;

export interface StepHandlers {
  setValue: (key: string, value: AnswerValue) => void;
  setRowValues: (groupKey: string, rowId: string, patch: Record<string, AnswerValue>) => void;
  addRow: (groupKey: string) => void;
  removeRow: (groupKey: string, rowId: string) => void;
}

function optionLabel(options: Option[] | undefined, value: AnswerValue | undefined): string | null {
  return typeof value === "string" ? (options?.find((option) => option.value === value)?.label ?? null) : null;
}

export function rowTitle(group: GroupDefinition, row: RepeatRow, index: number): string {
  const values = row.values;
  const text = (key: string) => (typeof values[key] === "string" && (values[key] as string).trim() ? (values[key] as string).trim() : null);
  const question = (key: string) => group.questions.find((item) => item.key === key);
  const fallback = `${group.itemLabel} ${index + 1}`;
  switch (group.key) {
    case "sites":
      return text("label") ?? fallback;
    case "prospects":
    case "suppliers":
      return text("name") ?? fallback;
    case "incidents":
      return [optionLabel(question("hazard")?.options, values.hazard), text("occurred_on")].filter(Boolean).join(" · ") || fallback;
    case "assets":
      return text("description") ?? fallback;
    case "measures_other":
      return text("name") ?? fallback;
    case "costs":
      return [optionLabel(question("item")?.options, values.item), text("description")].filter(Boolean).join(" · ") || fallback;
    case "documents":
      return text("filename") ?? fallback;
    default:
      return fallback;
  }
}

export function siteOptionsFor(answers: AssessmentAnswers, includeProspects: boolean): Option[] {
  const sites = (answers.groups.sites ?? []).map((row, index) => ({
    value: row.id,
    label: typeof row.values.label === "string" && row.values.label.trim() ? row.values.label.trim() : `Site ${index + 1}`,
  }));
  if (!includeProspects || answers.values["prospects.planning"] !== "yes") return sites;
  return [
    ...sites,
    ...(answers.groups.prospects ?? []).map((row, index) => ({
      value: row.id,
      label: `Candidate: ${typeof row.values.name === "string" && row.values.name.trim() ? row.values.name.trim() : `Candidate ${index + 1}`}`,
    })),
  ];
}

function currencyFor(answers: AssessmentAnswers, row: Record<string, AnswerValue> | null): string | null {
  const candidates = row ? [row.currency, row.loss_currency, row.budget_currency] : [];
  for (const candidate of [...candidates, answers.values["fin.currency"]]) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return null;
}

function searchHintFor(row: Record<string, AnswerValue>): string {
  const city = typeof row.city === "string" ? row.city.trim() : "";
  const country = typeof row.country === "string" ? (COUNTRIES.find((option) => option.value === row.country)?.label ?? row.country) : "";
  return [city, country].filter(Boolean).join(", ");
}

export function StepForm({ step, answers, context, issues, handlers }: { step: StepDefinition; answers: AssessmentAnswers; context: EvalContext; issues: IssueMap; handlers: StepHandlers }) {
  return (
    <>
      {step.sections.map((section) => {
        if (!isSectionVisible(section, context)) return null;
        const group = section.group;
        const visibleQuestions = (section.questions ?? []).filter((question) => isQuestionVisible(question, context));
        if (!group && visibleQuestions.length === 0) return null;
        return (
          <fieldset key={section.key} className="ax-section">
            <legend className="contents">
              <span className="ax-section-title block">{section.title}</span>
            </legend>
            {section.description ? <p className="ax-section-desc">{section.description}</p> : null}
            {visibleQuestions.length ? (
              <div className="ax-grid">
                {visibleQuestions.map((question) => (
                  <QuestionField
                    key={question.key}
                    question={question}
                    values={answers.values}
                    idPrefix={step.id}
                    error={issues.get(issueKey(null, null, question.key))}
                    siteOptions={siteOptionsFor(answers, false)}
                    currency={currencyFor(answers, null)}
                    onChange={handlers.setValue}
                    onPatch={(patch) => Object.entries(patch).forEach(([key, value]) => handlers.setValue(key, value))}
                  />
                ))}
              </div>
            ) : null}
            {group ? <GroupEditor group={group} answers={answers} context={context} issues={issues} handlers={handlers} /> : null}
          </fieldset>
        );
      })}
    </>
  );
}

function GroupEditor({ group, answers, context, issues, handlers }: { group: GroupDefinition; answers: AssessmentAnswers; context: EvalContext; issues: IssueMap; handlers: StepHandlers }) {
  const rows = answers.groups[group.key] ?? [];
  const groupError = issues.get(issueKey(group.key, null, group.key));
  const crossErrors = [...issues.entries()].filter(([key]) => key.startsWith(`${group.key}||`) && !key.endsWith(`|${group.key}`)).map(([, message]) => message);
  const siteOptions = siteOptionsFor(answers, group.key === "costs");
  return (
    <div>
      {group.description ? <p className="ax-section-desc">{group.description}</p> : null}
      {rows.length === 0 && !group.managed ? <p className="ax-help mt-3">No {group.itemLabel.toLowerCase()} added yet.</p> : null}
      {rows.map((row, index) => {
        const rowContext = { ...context, row: row.values };
        return (
          <div key={row.id} className="ax-row">
            <div className="ax-row-head">
              <p className="ax-row-title">{rowTitle(group, row, index)}</p>
              <button
                type="button"
                className="ax-link-btn ax-danger"
                onClick={() => handlers.removeRow(group.key, row.id)}
                aria-label={`Remove ${rowTitle(group, row, index)}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </button>
            </div>
            <div className="ax-grid">
              {group.questions
                .filter((question) => isQuestionVisible(question, rowContext))
                .filter((question) => !(group.managed && (question.key === "asset_id" || question.key === "filename")))
                .map((question) => (
                  <QuestionField
                    key={question.key}
                    question={question}
                    values={row.values}
                    idPrefix={`${group.key}-${row.id.slice(0, 8)}`}
                    error={issues.get(issueKey(group.key, row.id, question.key))}
                    siteOptions={siteOptions}
                    currency={currencyFor(answers, row.values)}
                    searchHint={searchHintFor(row.values)}
                    onChange={(key, value) => handlers.setRowValues(group.key, row.id, { [key]: value })}
                    onPatch={(patch) => handlers.setRowValues(group.key, row.id, patch)}
                  />
                ))}
            </div>
          </div>
        );
      })}
      {groupError ? <p className="ax-error mt-3">{groupError}</p> : null}
      {crossErrors.map((message) => (
        <p key={message} className="ax-error mt-3">{message}</p>
      ))}
      {!group.managed ? (
        <button type="button" className="ax-link-btn ax-add" onClick={() => handlers.addRow(group.key)} disabled={rows.length >= group.maxItems}>
          <Plus className="h-4 w-4" aria-hidden /> Add {group.itemLabel.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}
