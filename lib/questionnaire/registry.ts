import { locationsStep, operationsStep, profileStep, prospectsStep, purposeStep } from "@/lib/questionnaire/steps-profile";
import {
  costsStep,
  financialsStep,
  hazardsStep,
  incidentsStep,
  measuresStep,
  monitoringStep,
  reviewStep,
  suppliersStep,
  uploadsStep,
  utilitiesStep,
} from "@/lib/questionnaire/steps-risk";
import type { GroupDefinition, QuestionDefinition, SectionDefinition, StepDefinition } from "@/lib/questionnaire/types";

export const STEPS: StepDefinition[] = [
  purposeStep,
  profileStep,
  locationsStep,
  prospectsStep,
  operationsStep,
  incidentsStep,
  hazardsStep,
  utilitiesStep,
  suppliersStep,
  financialsStep,
  measuresStep,
  costsStep,
  uploadsStep,
  monitoringStep,
  reviewStep,
];

export interface QuestionEntry {
  question: QuestionDefinition;
  step: StepDefinition;
  section: SectionDefinition;
  group: GroupDefinition | null;
  /** Unique path: "profile.legal_name" or "sites[].label". */
  path: string;
}

let counter = 0;
const entries: QuestionEntry[] = [];
for (const step of STEPS) {
  for (const section of step.sections) {
    for (const question of section.questions ?? []) {
      question.order = ++counter;
      entries.push({ question, step, section, group: null, path: question.key });
    }
    if (section.group) {
      for (const question of section.group.questions) {
        question.order = ++counter;
        entries.push({ question, step, section, group: section.group, path: `${section.group.key}[].${question.key}` });
      }
    }
  }
}

export const QUESTION_ENTRIES: readonly QuestionEntry[] = entries;
export const QUESTIONS_BY_KEY = new Map(entries.filter((entry) => !entry.group).map((entry) => [entry.question.key, entry]));
export const GROUPS = new Map(
  STEPS.flatMap((step) => step.sections.flatMap((section) => (section.group ? [[section.group.key, { group: section.group, step, section }] as const] : []))),
);

export function stepById(id: string): StepDefinition | undefined {
  return STEPS.find((step) => step.id === id);
}
