import { findActivity } from "@/lib/questionnaire/industries";
import type {
  AnswerValue,
  AssessmentAnswers,
  Condition,
  IndustryBranch,
  Level,
  QuestionDefinition,
  SectionDefinition,
  StepDefinition,
} from "@/lib/questionnaire/types";

export interface EvalContext {
  answers: AssessmentAnswers;
  branches: Set<IndustryBranch>;
  level: Level;
  row?: Record<string, AnswerValue>;
}

export function assessmentLevel(answers: AssessmentAnswers): Level {
  return answers.values["purpose.depth"] === "B" ? "B" : "A";
}

function includes(value: AnswerValue | undefined, item: string): boolean {
  return Array.isArray(value) && value.includes(item);
}

/** Branches come from the chosen activity plus answers that reveal the same exposure. */
export function activeBranches(answers: AssessmentAnswers): Set<IndustryBranch> {
  const values = answers.values;
  const branches = new Set<IndustryBranch>(findActivity(values["profile.activity"])?.branches ?? []);
  if (values["ops.water_dependency"] === "critical" || values["ops.water_dependency"] === "high") branches.add("water_intensive");
  if (values["ops.outdoor_work"] === "yes") branches.add("outdoor_work");
  if (values["ops.perishable_inventory"] === "yes") branches.add("food_cold_chain");
  if (includes(values["purpose.goals"], "new_site") || values["prospects.planning"] === "yes") branches.add("new_site");
  if (values["fin.include"] === "yes") branches.add("financial");
  return branches;
}

export function contextFor(answers: AssessmentAnswers): EvalContext {
  return { answers, branches: activeBranches(answers), level: assessmentLevel(answers) };
}

function lookup(field: string, context: EvalContext): AnswerValue | undefined {
  if (field.startsWith(".")) return context.row?.[field.slice(1)];
  return context.answers.values[field];
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function evaluate(condition: Condition | undefined, context: EvalContext): boolean {
  if (!condition) return true;
  if ("all" in condition) return condition.all.every((item) => evaluate(item, context));
  if ("any" in condition) return condition.any.some((item) => evaluate(item, context));
  if ("not" in condition) return !evaluate(condition.not, context);
  if ("branch" in condition) return context.branches.has(condition.branch);
  if ("level" in condition) return condition.level === "A" || context.level === "B";
  const value = lookup(condition.field, context);
  if ("equals" in condition) return value === condition.equals;
  if ("in" in condition) return typeof value === "string" && condition.in.includes(value);
  if ("includes" in condition) return includes(value, condition.includes);
  if ("answered" in condition) return isAnswered(value) === condition.answered;
  if ("gt" in condition) return typeof value === "number" && value > condition.gt;
  return true;
}

function industriesMatch(industries: IndustryBranch[] | undefined, context: EvalContext): boolean {
  return !industries?.length || industries.some((branch) => context.branches.has(branch));
}

export function isSectionVisible(section: SectionDefinition, context: EvalContext): boolean {
  if (!industriesMatch(section.industries, context)) return false;
  if (!evaluate(section.visibleWhen, context)) return false;
  if (section.group && !evaluate(section.group.visibleWhen, context)) return false;
  if (section.group?.level === "B" && context.level !== "B") return false;
  return true;
}

export function isQuestionVisible(question: QuestionDefinition, context: EvalContext): boolean {
  if (question.level === "B" && context.level !== "B") return false;
  if (!industriesMatch(question.industries, context)) return false;
  return evaluate(question.visibleWhen, context);
}

export function geopointKeys(key: string) {
  return {
    lat: `${key}_lat`,
    lon: `${key}_lon`,
    source: `${key}_source`,
    match: `${key}_match`,
    confirmation: `${key}_confirmation`,
  } as const;
}

export function questionAnswered(question: QuestionDefinition, values: Record<string, AnswerValue>): boolean {
  if (question.type === "geopoint") {
    const keys = geopointKeys(question.key);
    return isAnswered(values[keys.lat]) && isAnswered(values[keys.lon]);
  }
  if (question.type === "boolean" && question.required) return values[question.key] === true;
  return isAnswered(values[question.key]);
}

/** Questions visible in a step, with the values object they read from. */
export function visibleStepItems(step: StepDefinition, context: EvalContext) {
  const items: Array<{ question: QuestionDefinition; values: Record<string, AnswerValue>; groupKey: string | null; rowId: string | null }> = [];
  for (const section of step.sections) {
    if (!isSectionVisible(section, context)) continue;
    for (const question of section.questions ?? []) {
      if (isQuestionVisible(question, context)) items.push({ question, values: context.answers.values, groupKey: null, rowId: null });
    }
    if (section.group) {
      for (const row of context.answers.groups[section.group.key] ?? []) {
        const rowContext = { ...context, row: row.values };
        for (const question of section.group.questions) {
          if (isQuestionVisible(question, rowContext)) items.push({ question, values: row.values, groupKey: section.group.key, rowId: row.id });
        }
      }
    }
  }
  return items;
}
