"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Combobox } from "@/components/assessment/combobox";
import { LocationField } from "@/components/assessment/location-field";
import { todayIso } from "@/lib/questionnaire/validation";
import type { AnswerValue, Option, QuestionDefinition } from "@/lib/questionnaire/types";

const TRI_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
];

function NumberField({ id, value, onChange, prefix, suffix, invalid, describedBy }: {
  id: string;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  prefix?: string;
  suffix?: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  return (
    <div className="ax-control ax-affix">
      {prefix ? <span>{prefix}</span> : null}
      <input
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const cleaned = raw.replace(/,/g, "").trim();
          if (!cleaned) onChange(null);
          else onChange(Number.isFinite(Number(cleaned)) ? Number(cleaned) : raw);
        }}
      />
      {suffix ? <span>{suffix}</span> : null}
    </div>
  );
}

export interface FieldProps {
  question: QuestionDefinition;
  values: Record<string, AnswerValue>;
  idPrefix: string;
  error?: string;
  siteOptions: Option[];
  currency: string | null;
  searchHint?: string;
  onChange: (key: string, value: AnswerValue) => void;
  onPatch: (patch: Record<string, AnswerValue>) => void;
}

export function QuestionField({ question, values, idPrefix, error, siteOptions, currency, searchHint, onChange, onPatch }: FieldProps) {
  const id = `${idPrefix}-${question.key.replace(/\./g, "-")}`;
  const helpId = question.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const value = values[question.key];
  const invalid = Boolean(error);
  const set = (next: AnswerValue) => onChange(question.key, next);
  const groupLabelId = `${id}-label`;
  const isGroupControl = ["radio", "multiselect", "tristate", "geopoint"].includes(question.type);

  let control: React.ReactNode;
  switch (question.type) {
    case "text":
      control = <input id={id} className="ax-control" value={typeof value === "string" ? value : ""} maxLength={question.validation?.maxLength} placeholder={question.placeholder} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => set(event.target.value)} />;
      break;
    case "textarea":
      control = <textarea id={id} className="ax-control" value={typeof value === "string" ? value : ""} maxLength={question.validation?.maxLength} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => set(event.target.value)} />;
      break;
    case "number":
      control = <NumberField id={id} value={value} onChange={set} suffix={question.unit} invalid={invalid} describedBy={describedBy} />;
      break;
    case "percentage":
      control = <NumberField id={id} value={value} onChange={set} suffix="%" invalid={invalid} describedBy={describedBy} />;
      break;
    case "currency":
      control = <NumberField id={id} value={value} onChange={set} prefix={currency ?? "Amount"} invalid={invalid} describedBy={describedBy} />;
      break;
    case "date":
      control = <input id={id} type="date" className="ax-control" value={typeof value === "string" ? value : ""} max={question.validation?.notFuture ? todayIso() : undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => set(event.target.value || null)} />;
      break;
    case "select":
    case "site_ref": {
      const options = question.type === "site_ref" ? siteOptions : (question.options ?? []);
      control = (
        <select id={id} className="ax-control" value={typeof value === "string" ? value : ""} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => set(event.target.value || null)}>
          <option value="">{question.type === "site_ref" && !options.length ? "Add a site first" : "Select"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
      break;
    }
    case "combobox":
      control = <Combobox id={id} options={question.options ?? []} value={typeof value === "string" ? value : null} onChange={set} invalid={invalid} describedBy={describedBy} />;
      break;
    case "radio":
      control = (
        <div className="ax-choices" role="radiogroup" aria-labelledby={groupLabelId} aria-describedby={describedBy}>
          {(question.options ?? []).map((option) => (
            <label key={option.value} className="ax-choice">
              <input type="radio" name={id} value={option.value} checked={value === option.value} onChange={() => set(option.value)} />
              <span>
                {option.label}
                {option.help ? <span className="block text-xs text-[var(--ax-muted)]">{option.help}</span> : null}
              </span>
            </label>
          ))}
        </div>
      );
      break;
    case "tristate":
      control = (
        <div className="ax-segment" role="radiogroup" aria-labelledby={groupLabelId} aria-describedby={describedBy}>
          {TRI_OPTIONS.map((option) => (
            <label key={option.value}>
              <input type="radio" name={id} value={option.value} checked={value === option.value} onChange={() => set(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      );
      break;
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      control = (
        <div className={clsx("ax-choices", (question.options?.length ?? 0) > 4 && "sm:grid-cols-2")} role="group" aria-labelledby={groupLabelId} aria-describedby={describedBy}>
          {(question.options ?? []).map((option) => (
            <label key={option.value} className="ax-choice">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) => set(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case "boolean":
      return (
        <div className={clsx("ax-field", question.width === "full" && "ax-full")}>
          <label className="ax-choice">
            <input id={id} type="checkbox" checked={value === true} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => set(event.target.checked)} />
            <span>
              {question.label}
              {question.help ? <span id={helpId} className="ax-help block">{question.help}</span> : null}
            </span>
          </label>
          {error ? <p id={errorId} className="ax-error">{error}</p> : null}
        </div>
      );
    case "geopoint":
      control = <LocationField id={id} fieldKey={question.key} values={values} searchHint={searchHint ?? ""} onPatch={onPatch} error={error} />;
      break;
  }

  return (
    <div className={clsx("ax-field", question.width === "full" && "ax-full")}>
      {isGroupControl ? (
        <span id={groupLabelId} className="ax-label">
          {question.label}
          {question.required ? <span className="ax-req">Required</span> : null}
        </span>
      ) : (
        <label htmlFor={id} id={groupLabelId} className="ax-label">
          {question.label}
          {question.required ? <span className="ax-req">Required</span> : null}
        </label>
      )}
      {question.help ? <p id={helpId} className="ax-help">{question.help}</p> : null}
      {control}
      {error ? <p id={errorId} className="ax-error">{error}</p> : null}
    </div>
  );
}
