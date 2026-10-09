import { generateText, Output } from "ai";
import type { AssessmentResult } from "@/lib/assessments/pipeline";
import { logError } from "@/lib/observability/logger";
import type { EvidencePack } from "./evidence";
import { narrativeSchema, validateNarrative, type Narrative, type NarrativeBody } from "./narrative-schema";

export const DEFAULT_NARRATIVE_MODEL = "google/gemini-3.8-flash";

export function narrativeModel(): string | null {
  const configured = Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim());
  if (!configured || process.env.AI_NARRATIVE_DISABLED === "true") return null;
  return process.env.AI_NARRATIVE_MODEL?.trim() || DEFAULT_NARRATIVE_MODEL;
}

const INSTRUCTIONS = `You write the plain-English summary of a climate-disruption vulnerability assessment for a small business owner and the loan officer who reviews it.

Rules you must follow:
- Use only facts in the evidence items. Cite the evidence ids that support each driver and action.
- Do not introduce any number that is not in the evidence. Prefer words over numbers when unsure.
- The indicator is a 0-100 climate-disruption vulnerability indicator. Never call it a probability of default, a credit score or a lending decision, and never suggest approving, rejecting or pricing a loan.
- Keep three things distinct: hazard and regional context (weather, alerts, flood exposure, river, projections, satellite), business vulnerability and resilience, and the hypothetical financial scenarios.
- Regional context (flood exposure, river discharge, projections, satellite) does not change the score. Say so if you mention it.
- Missing evidence is unknown, never safe.
- Actions must be practical steps for the business, grounded in the recommended actions or the drivers.
- Short sentences. No marketing language. No markdown.`;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let kept = "";
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (next.length > max) break;
    kept = next;
  }
  if (kept.trim()) return kept.trim();
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

function rulesNarrative(pack: EvidencePack, result: AssessmentResult, fallbackReason: string | null): Narrative {
  const score = result.score;
  const find = (id: string) => pack.items.find((item) => item.id === id);
  const drivers = score.components
    .filter((component) => component.included && component.score !== null)
    .sort((a, b) => (b.score ?? 0) * (b.effectiveWeight ?? 0) - (a.score ?? 0) * (a.effectiveWeight ?? 0))
    .slice(0, 3)
    .map((component) => ({
      title: `${component.label}: ${component.score} of 100`,
      explanation: component.notes[0] ?? component.normalization,
      evidence: [`component.${component.id}`],
    }));
  const elevatedHazards = result.hazards.indicators.filter((indicator) => (indicator.score ?? 0) >= 60);
  for (const indicator of elevatedHazards.slice(0, 2)) {
    drivers.push({ title: `${indicator.hazard[0]!.toUpperCase()}${indicator.hazard.slice(1)} screening elevated`, explanation: indicator.summary, evidence: [`hazard.${indicator.hazard}`] });
  }
  const horizonOf = (text: string): NarrativeBody["actions"][number]["horizon"] =>
    /immediate|now|today|before/i.test(text) ? "now" : /month|30/i.test(text) ? "30_days" : /quarter|90/i.test(text) ? "90_days" : "12_months";
  const actions = result.recommendations.slice(0, 5).map((recommendation, index) => ({
    action: recommendation.action,
    rationale: recommendation.evidence,
    horizon: horizonOf(recommendation.horizon),
    evidence: [`action.${index + 1}`],
  }));
  const watchItems = [find("context.alerts"), find("context.river"), find("context.flood_exposure")]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => clip(`${item.label}: ${item.text}`, 200));
  return {
    headline:
      score.score === null
        ? "Not enough evidence to show an indicator yet"
        : `Climate-disruption vulnerability ${score.score} of 100 (${score.band})`,
    summary: [find("score")?.text, drivers[0] ? `The largest contributor is ${drivers[0].title.toLowerCase()}.` : null, elevatedHazards.length ? `${elevatedHazards.length} hazard screen(s) are elevated for the coming days.` : "No hazard screen is elevated for the coming days."]
      .filter(Boolean)
      .join(" "),
    drivers: drivers.slice(0, 5),
    actions,
    dataQuality: find("quality.coverage")?.text ?? "",
    watchItems,
    generatedBy: "rules",
    model: null,
    generatedAt: new Date().toISOString(),
    fallbackReason,
  };
}

/** Grounded summary. Never changes the score; falls back to rules when AI is unavailable or ungrounded. */
export async function writeNarrative(pack: EvidencePack, result: AssessmentResult): Promise<Narrative> {
  const model = narrativeModel();
  if (!model) return rulesNarrative(pack, result, "No AI Gateway credentials are configured, so the summary was written by rules.");
  try {
    const { output } = await generateText({
      model,
      instructions: INSTRUCTIONS,
      prompt: `Business: ${pack.businessName}\nSite: ${pack.siteLabel}\n\nEvidence items (id | group | label | text):\n${pack.items
        .map((item) => `${item.id} | ${item.group} | ${item.label} | ${item.text}`)
        .join("\n")}`,
      output: Output.object({ schema: narrativeSchema }),
      timeout: 30000,
      maxRetries: 1,
    });
    const problems = validateNarrative(output, pack);
    if (problems.length) {
      return rulesNarrative(pack, result, `The AI draft was discarded because it was not fully grounded: ${problems.slice(0, 3).join(" ")}`);
    }
    return { ...output, generatedBy: "ai", model, generatedAt: new Date().toISOString(), fallbackReason: null };
  } catch (error) {
    logError("narrative generation failed", { message: error instanceof Error ? error.message : "unknown" });
    return rulesNarrative(pack, result, "The AI service did not return a usable summary, so it was written by rules.");
  }
}
