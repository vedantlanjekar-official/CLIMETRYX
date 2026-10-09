/**
 * Builds a complete, valid answer set for manual and browser testing by filling every visible required
 * question with a plausible value. Test input only; never shown as observed data.
 * Usage: npx tsx scripts/make-sample-answers.ts <lat> <lon> [out.json]
 */
import { writeFileSync } from "node:fs";
import { contextFor, geopointKeys, isQuestionVisible, isSectionVisible } from "@/lib/questionnaire/engine";
import { STEPS } from "@/lib/questionnaire/registry";
import type { AnswerValue, AssessmentAnswers, QuestionDefinition, RepeatRow } from "@/lib/questionnaire/types";
import { validateAnswers } from "@/lib/questionnaire/validation";

const [lat, lon] = process.argv.slice(2, 4).map(Number) as [number, number];
const out = process.argv[4];

const OVERRIDES: Record<string, AnswerValue> = {
  "profile.legal_name": "Sample Foods Pvt Ltd",
  "profile.trading_name": "Sample Foods",
  "fin.include": "yes",
  "fin.revenue": 1_200_000,
  "fin.fixed_costs": 300_000,
  "fin.variable_costs": 600_000,
  "fin.cash_reserves": 250_000,
};

function valueFor(question: QuestionDefinition, values: Record<string, AnswerValue>): void {
  if (question.key in OVERRIDES) {
    values[question.key] = OVERRIDES[question.key]!;
    return;
  }
  const v = question.validation ?? {};
  switch (question.type) {
    case "geopoint": {
      const keys = geopointKeys(question.key);
      values[keys.lat] = lat;
      values[keys.lon] = lon;
      values[keys.source] = "map_pin";
      values[keys.confirmation] = "confirmed_pin";
      return;
    }
    case "boolean":
      values[question.key] = true;
      return;
    case "tristate":
      values[question.key] = "no";
      return;
    case "select":
    case "combobox":
    case "radio":
      values[question.key] = question.options?.find((option) => !/unknown|prefer|other/i.test(option.value))?.value ?? question.options?.[0]?.value ?? null;
      return;
    case "multiselect":
      values[question.key] = question.options?.slice(0, Math.max(1, v.minItems ?? 1)).map((option) => option.value) ?? [];
      return;
    case "number":
    case "currency":
    case "percentage": {
      const min = v.min ?? 0;
      const max = v.max ?? min + 100;
      values[question.key] = Math.min(max, Math.max(min, question.type === "percentage" ? 30 : Math.max(1, Math.round((min + Math.min(max, min + 48)) / 2))));
      return;
    }
    case "date":
      values[question.key] = "2025-04-01";
      return;
    case "text":
    case "textarea":
      values[question.key] = "Sample answer";
      return;
    case "site_ref":
      return;
  }
}

function fill(answers: AssessmentAnswers): void {
  for (const step of STEPS) {
    for (const section of step.sections) {
      const context = contextFor(answers);
      if (!isSectionVisible(section, context)) continue;
      for (const question of section.questions ?? []) {
        if (question.required && isQuestionVisible(question, contextFor(answers)) && answers.values[question.key] === undefined) valueFor(question, answers.values);
      }
      const group = section.group;
      if (group && !group.managed && (answers.groups[group.key]?.length ?? 0) < group.minItems) {
        const rows: RepeatRow[] = answers.groups[group.key] ?? [];
        while (rows.length < Math.max(group.minItems, 1)) {
          const row: RepeatRow = { id: `${group.key}-${rows.length + 1}`, values: {} };
          for (const question of group.questions) {
            if (question.required || question.type === "geopoint") valueFor(question, row.values);
          }
          if (group.key === "sites") {
            row.values.is_primary = true;
            row.values.label = "Main shop";
          }
          rows.push(row);
        }
        answers.groups[group.key] = rows;
      }
    }
  }
}

const answers: AssessmentAnswers = { values: { ...OVERRIDES }, groups: {} };
for (let pass = 0; pass < 4; pass += 1) fill(answers);
const issues = validateAnswers(answers, "submit");
console.log(`${issues.length} issues`);
for (const issue of issues.slice(0, 40)) console.log(JSON.stringify(issue));
if (out) writeFileSync(out, JSON.stringify(answers, null, 1));
