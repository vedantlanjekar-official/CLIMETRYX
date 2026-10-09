import { z } from "zod";
import { contextFor, geopointKeys, isAnswered, isSectionVisible, questionAnswered, visibleStepItems } from "@/lib/questionnaire/engine";
import { GROUPS, QUESTIONS_BY_KEY, STEPS } from "@/lib/questionnaire/registry";
import type { AnswerValue, AssessmentAnswers, QuestionDefinition, RepeatRow } from "@/lib/questionnaire/types";

const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]);
const answerValue = z.union([scalar, z.array(z.string().max(200)).max(50)]);
const valueRecord = z.record(z.string().regex(/^[a-z][a-z0-9_.]{0,79}$/i), answerValue).refine((record) => Object.keys(record).length <= 600, "Too many answers.");

/** Structural schema shared by the client autosave and every server action. */
export const answersEnvelope = z.object({
  values: valueRecord,
  groups: z.record(
    z.string().regex(/^[a-z_]{1,40}$/),
    z.array(z.object({ id: z.string().min(1).max(64), values: valueRecord })).max(60),
  ),
});

export interface ValidationIssue {
  stepId: string;
  key: string;
  groupKey: string | null;
  rowId: string | null;
  message: string;
}

const AADHAAR_LIKE = /(^|\D)\d{4}[\s-]?\d{4}[\s-]?\d{4}(\D|$)/;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Free text must not carry personal ID or payment card numbers. */
export function containsRestrictedIdentifier(text: string): boolean {
  if (AADHAAR_LIKE.test(text)) return true;
  for (const match of text.matchAll(/(?:\d[ -]?){13,19}/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Type-level check of a single answered value. Returns an error message or null. */
export function checkValue(question: QuestionDefinition, values: Record<string, AnswerValue>, today: string): string | null {
  const rule = question.validation ?? {};
  if (question.type === "geopoint") {
    const keys = geopointKeys(question.key);
    const lat = values[keys.lat];
    const lon = values[keys.lon];
    if (!isAnswered(lat) && !isAnswered(lon)) return null;
    if (typeof lat !== "number" || typeof lon !== "number") return "Enter both latitude and longitude as numbers.";
    if (lat < -90 || lat > 90) return "Latitude must be between −90 and 90.";
    if (lon < -180 || lon > 180) return "Longitude must be between −180 and 180.";
    if (lat === 0 && lon === 0) return "0, 0 is not a site position. Search for the place or enter the coordinates.";
    const confirmation = values[keys.confirmation];
    if (isAnswered(confirmation) && confirmation !== "confirmed_pin" && confirmation !== "accepted_low_precision") return "Unknown confirmation state.";
    return null;
  }
  const value = values[question.key];
  if (!isAnswered(value)) return null;
  switch (question.type) {
    case "text":
    case "textarea":
    case "site_ref": {
      if (typeof value !== "string") return "Enter text.";
      if (rule.maxLength && value.length > rule.maxLength) return `Use at most ${rule.maxLength} characters.`;
      if (rule.pattern && !new RegExp(rule.pattern.regex).test(value.trim())) return rule.pattern.message;
      if (question.type !== "site_ref" && containsRestrictedIdentifier(value)) {
        return "This looks like a personal ID or card number. Remove it; these are never collected.";
      }
      return null;
    }
    case "number":
    case "currency":
    case "percentage": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number.";
      if (rule.integer && !Number.isInteger(value)) return "Enter a whole number.";
      if (rule.min !== undefined && value < rule.min) return `Must be at least ${rule.min}.`;
      if (rule.max !== undefined && value > rule.max) return `Must be at most ${rule.max}.`;
      return null;
    }
    case "select":
    case "radio":
    case "combobox":
      if (typeof value !== "string" || !question.options?.some((option) => option.value === value)) return "Choose one of the listed options.";
      return null;
    case "multiselect":
      if (!Array.isArray(value) || value.some((item) => !question.options?.some((option) => option.value === item))) return "Choose from the listed options.";
      return null;
    case "tristate":
      return value === "yes" || value === "no" || value === "unknown" ? null : "Choose yes, no or not sure.";
    case "boolean":
      return typeof value === "boolean" ? null : "Invalid value.";
    case "date":
      if (typeof value !== "string" || !isIsoDate(value)) return "Enter a valid date.";
      if (rule.notFuture && value > today) return "The date cannot be in the future.";
      return null;
  }
}

const DAY_MS = 86_400_000;

/** Reporting period must be ordered and match the declared monthly or annual basis. */
export function financialPeriodIssue(values: Record<string, AnswerValue>): string | null {
  const start = values["fin.period_start"];
  const end = values["fin.period_end"];
  if (typeof start !== "string" || typeof end !== "string" || !isIsoDate(start) || !isIsoDate(end)) return null;
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
  if (days <= 0) return "The period end must be after the period start.";
  const period = values["fin.period"];
  if (period === "monthly" && (days < 28 || days > 31)) return `A monthly period should span 28–31 days; this one spans ${days}.`;
  if (period === "annual" && (days < 360 || days > 371)) return `An annual period should span about a year; this one spans ${days} days.`;
  return null;
}

function rows(answers: AssessmentAnswers, key: string): RepeatRow[] {
  return answers.groups[key] ?? [];
}

export function validateAnswers(answers: AssessmentAnswers, mode: "draft" | "submit", now = new Date()): ValidationIssue[] {
  const today = todayIso(now);
  const context = contextFor(answers);
  const issues: ValidationIssue[] = [];
  const push = (stepId: string, key: string, message: string, groupKey: string | null = null, rowId: string | null = null) =>
    issues.push({ stepId, key, groupKey, rowId, message });

  for (const step of STEPS) {
    for (const item of visibleStepItems(step, context)) {
      const message = checkValue(item.question, item.values, today);
      if (message) {
        push(step.id, item.question.key, message, item.groupKey, item.rowId);
        continue;
      }
      if (mode !== "submit") continue;
      if (item.question.required && !questionAnswered(item.question, item.values)) {
        push(step.id, item.question.key, item.question.type === "boolean" ? "Confirm to continue." : "Required.", item.groupKey, item.rowId);
        continue;
      }
      const minItems = item.question.validation?.minItems;
      const value = item.values[item.question.key];
      if (minItems && Array.isArray(value) && value.length < minItems) push(step.id, item.question.key, `Choose at least ${minItems}.`, item.groupKey, item.rowId);
      if (item.question.type === "geopoint" && questionAnswered(item.question, item.values)) {
        const confirmation = item.values[geopointKeys(item.question.key).confirmation];
        if (confirmation !== "confirmed_pin" && confirmation !== "accepted_low_precision") {
          push(step.id, item.question.key, "Confirm the pin or accept lower precision.", item.groupKey, item.rowId);
        }
      }
    }
    if (mode === "submit") {
      for (const section of step.sections) {
        if (!section.group || !isSectionVisible(section, context)) continue;
        if (rows(answers, section.group.key).length < section.group.minItems) {
          push(step.id, section.group.key, `Add at least ${section.group.minItems} ${section.group.itemLabel.toLowerCase()}.`, section.group.key);
        }
      }
    }
  }

  if (mode === "submit") {
    const sites = rows(answers, "sites");
    if (sites.length > 1 && sites.filter((row) => row.values.is_primary === true).length !== 1) {
      push("locations", "is_primary", "Mark exactly one site as primary.", "sites");
    }
  }

  for (const row of rows(answers, "prospects")) {
    const weights = [row.values.weight_cost, row.values.weight_resilience, row.values.weight_climate];
    if (weights.some((weight) => typeof weight === "number")) {
      const total = weights.reduce<number>((sum, weight) => sum + (typeof weight === "number" ? weight : 0), 0);
      if (Math.abs(total - 100) > 0.5) push("prospects", "weight_climate", `Weights total ${total}; they should total 100.`, "prospects", row.id);
    }
  }

  const shareTotal = rows(answers, "suppliers").reduce((sum, row) => sum + (typeof row.values.spend_share === "number" ? row.values.spend_share : 0), 0);
  if (shareTotal > 100.5) push("suppliers", "spend_share", `Supplier shares total ${Math.round(shareTotal)}%, more than 100%.`, "suppliers");

  if (answers.values["fin.include"] === "yes") {
    const period = financialPeriodIssue(answers.values);
    if (period) push("financials", "fin.period_end", period);
  }
  return issues;
}

/** Drops unknown keys so only defined questions are ever stored. */
export function sanitizeAnswers(raw: unknown): { ok: true; answers: AssessmentAnswers } | { ok: false; message: string } {
  const parsed = answersEnvelope.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "The answers could not be read." };
  const values: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(parsed.data.values)) {
    if (QUESTIONS_BY_KEY.has(key)) values[key] = value;
  }
  const groups: Record<string, RepeatRow[]> = {};
  for (const [key, list] of Object.entries(parsed.data.groups)) {
    const entry = GROUPS.get(key);
    if (!entry) continue;
    const allowed = new Set<string>();
    for (const question of entry.group.questions) {
      if (question.type === "geopoint") Object.values(geopointKeys(question.key)).forEach((name) => allowed.add(name));
      else allowed.add(question.key);
    }
    groups[key] = list.slice(0, entry.group.maxItems).map((row) => ({
      id: row.id,
      values: Object.fromEntries(Object.entries(row.values).filter(([name]) => allowed.has(name))),
    }));
  }
  return { ok: true, answers: { values, groups } };
}
