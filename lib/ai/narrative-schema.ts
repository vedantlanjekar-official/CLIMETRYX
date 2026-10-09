import { z } from "zod";
import type { EvidencePack } from "./evidence";

const cited = z.array(z.string()).min(1).max(6);

export const narrativeSchema = z.object({
  headline: z.string().max(160),
  summary: z.string().max(1200),
  drivers: z
    .array(z.object({ title: z.string().max(90), explanation: z.string().max(400), evidence: cited }))
    .max(5),
  actions: z
    .array(
      z.object({
        action: z.string().max(240),
        rationale: z.string().max(320),
        horizon: z.enum(["now", "30_days", "90_days", "12_months"]),
        evidence: cited,
      }),
    )
    .max(6),
  dataQuality: z.string().max(600),
  watchItems: z.array(z.string().max(200)).max(4),
});

export type NarrativeBody = z.infer<typeof narrativeSchema>;

export interface Narrative extends NarrativeBody {
  generatedBy: "ai" | "rules";
  model: string | null;
  generatedAt: string;
  /** Why an AI draft was discarded in favour of the rules summary. */
  fallbackReason: string | null;
}

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;
const FORBIDDEN = [
  /probability of default/i,
  /\bcredit ?worth/i,
  /\b(approve|approval|reject|decline)\b.{0,30}\b(loan|credit|application)/i,
  /\b(loan|credit)\b.{0,30}\b(approve|approval|reject|decline)/i,
  /\bguarantee[sd]?\b/i,
  /\bsafe from\b/i,
];

function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER)].map((match) => Number(match[0].replace(/,/g, ""))).filter(Number.isFinite);
}

/** Returns problems; an empty list means every number and citation is grounded in the evidence pack. */
export function validateNarrative(body: NarrativeBody, pack: EvidencePack): string[] {
  const problems: string[] = [];
  const ids = new Set(pack.items.map((item) => item.id));
  const allowed = new Set<number>();
  const addAllowed = (value: number) => {
    allowed.add(value);
    allowed.add(Math.round(value));
    allowed.add(Math.round(value * 10) / 10);
    allowed.add(Math.abs(value));
  };
  for (const item of pack.items) for (const value of numbersIn(`${item.label} ${item.text} ${item.observedAt ?? ""}`)) addAllowed(value);
  for (let small = 0; small <= 12; small += 1) allowed.add(small);

  const texts = [
    body.headline,
    body.summary,
    body.dataQuality,
    ...body.watchItems,
    ...body.drivers.flatMap((driver) => [driver.title, driver.explanation]),
    ...body.actions.flatMap((action) => [action.action, action.rationale]),
  ];
  for (const text of texts) {
    for (const value of numbersIn(text)) {
      if (!allowed.has(value) && !allowed.has(Math.abs(value))) problems.push(`Unsupported number ${value}.`);
    }
    for (const pattern of FORBIDDEN) if (pattern.test(text)) problems.push(`Forbidden phrasing matched ${pattern}.`);
  }
  for (const entry of [...body.drivers, ...body.actions]) {
    for (const id of entry.evidence) if (!ids.has(id)) problems.push(`Unknown evidence id ${id}.`);
  }
  return [...new Set(problems)];
}
