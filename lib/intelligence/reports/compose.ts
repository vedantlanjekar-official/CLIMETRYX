import { coreReport, type ReportType } from "../catalogue";
import type { AnalysisPackage } from "../snapshot";
import { DISCLAIMER, type GenerationInfo, type IntelligenceReport } from "./document";
import { reportReadiness, TEMPLATES, type ReportDraft } from "./templates";
import { aiReportSchema, applyAiBody, buildEvidence, normalizeCitations, validateAiReport, writerPrompt, WRITER_INSTRUCTIONS, type AiReportBody, type EvidenceItem } from "./writer";

export interface AiAttempt {
  body: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface AiUsageRecord {
  model: string;
  outcome: "accepted" | "rejected_validation" | "error";
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  detail: string | null;
}

/** Calls the model once. Injected so the composer can run with a real provider, a test double, or nothing. */
export interface NarrativeProvider {
  provider: string;
  model: string;
  generate(input: { instructions: string; prompt: string }): Promise<AiAttempt>;
}

export interface ComposeResult {
  document: IntelligenceReport;
  usage: AiUsageRecord[];
}

function rulesGeneration(reason: string | null, issues: string[] = []): GenerationInfo {
  return { mode: "rules", provider: null, model: null, fallbackReason: reason, validationIssues: issues, inputTokens: null, outputTokens: null, latencyMs: null };
}

async function tryAi(provider: NarrativeProvider, prompt: string, evidence: EvidenceItem[], sectionIds: string[], usage: AiUsageRecord[]): Promise<{ body: AiReportBody | null; issues: string[]; attempt: AiAttempt | null; error: string | null }> {
  let feedback = "";
  let lastIssues: string[] = [];
  let last: AiAttempt | null = null;
  for (let round = 0; round < 2; round += 1) {
    try {
      const attempt = await provider.generate({ instructions: WRITER_INSTRUCTIONS, prompt: feedback ? `${prompt}\n\nYour previous draft was rejected for these reasons. Fix every one:\n${feedback}` : prompt });
      last = attempt;
      const parsed = aiReportSchema.safeParse(attempt.body);
      if (!parsed.success) {
        lastIssues = ["The response did not match the report schema."];
        usage.push({ model: provider.model, outcome: "rejected_validation", inputTokens: attempt.inputTokens, outputTokens: attempt.outputTokens, latencyMs: attempt.latencyMs, detail: lastIssues[0]! });
      } else {
        const body = normalizeCitations(parsed.data, evidence);
        lastIssues = validateAiReport(body, evidence, sectionIds);
        usage.push({ model: provider.model, outcome: lastIssues.length ? "rejected_validation" : "accepted", inputTokens: attempt.inputTokens, outputTokens: attempt.outputTokens, latencyMs: attempt.latencyMs, detail: lastIssues.slice(0, 5).join(" ") || null });
        if (!lastIssues.length) return { body, issues: [], attempt, error: null };
      }
      feedback = lastIssues.slice(0, 12).map((issue) => `- ${issue}`).join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "unknown error";
      usage.push({ model: provider.model, outcome: "error", inputTokens: null, outputTokens: null, latencyMs: null, detail: message });
      return { body: null, issues: lastIssues, attempt: last, error: message };
    }
  }
  return { body: null, issues: lastIssues, attempt: last, error: null };
}

/** Builds one report: deterministic content from the template, narrative from AI only if it validates. */
export async function composeReport(type: ReportType, pkg: AnalysisPackage, snapshotHash: string, provider: NarrativeProvider | null, unavailableReason: string | null, now = new Date()): Promise<ComposeResult> {
  const meta = coreReport(type)!;
  const draft: ReportDraft = TEMPLATES[type](pkg);
  const readiness = reportReadiness(type, pkg);
  const usage: AiUsageRecord[] = [];
  let narrative: Pick<ReportDraft, "headline" | "executiveSummary" | "keyFindings" | "recommendations" | "sections"> = draft;
  let generation = rulesGeneration(unavailableReason ?? "AI narratives are not configured.");

  if (provider) {
    const evidence = buildEvidence(draft);
    const prompt = writerPrompt(meta.title, [...meta.audience], draft, evidence);
    const outcome = await tryAi(provider, prompt, evidence, draft.sections.map((sec) => sec.id), usage);
    const tokens = (key: "inputTokens" | "outputTokens") => usage.reduce<number | null>((sum, item) => (item[key] === null ? sum : (sum ?? 0) + item[key]!), null);
    if (outcome.body) {
      narrative = applyAiBody(draft, outcome.body);
      generation = { mode: "ai", provider: provider.provider, model: provider.model, fallbackReason: null, validationIssues: [], inputTokens: tokens("inputTokens"), outputTokens: tokens("outputTokens"), latencyMs: usage.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) };
    } else {
      generation = {
        ...rulesGeneration(outcome.error ? "The AI service did not return a usable narrative, so it was written by rules." : "The AI narrative was discarded because it was not fully grounded in the computed figures, so it was written by rules.", outcome.issues.slice(0, 8)),
        provider: provider.provider,
        model: provider.model,
        inputTokens: tokens("inputTokens"),
        outputTokens: tokens("outputTokens"),
      };
    }
  }

  const limited = !readiness.ready || pkg.assessment.status !== "completed" || pkg.assessment.stale;
  const document: IntelligenceReport = {
    schemaVersion: 1,
    reportType: type,
    title: meta.title,
    category: meta.category,
    audience: [...meta.audience],
    businessName: pkg.business.name,
    siteLabel: pkg.site.label,
    generatedAt: now.toISOString(),
    dataAsOf: pkg.assessment.createdAt,
    assessmentId: pkg.assessment.id,
    engineVersion: pkg.engineVersion,
    snapshotHash,
    status: limited ? "completed_with_limitations" : "completed",
    headline: narrative.headline,
    executiveSummary: narrative.executiveSummary,
    keyFindings: narrative.keyFindings,
    keyMetrics: draft.keyMetrics,
    sections: narrative.sections,
    recommendations: narrative.recommendations,
    methodology: draft.methodology,
    assumptions: draft.assumptions,
    limitations: [...(readiness.missing.length ? [`Inputs missing for this report: ${readiness.missing.join("; ")}.`] : []), ...draft.limitations],
    dataGaps: pkg.gaps,
    sources: pkg.sources,
    disclaimer: DISCLAIMER,
    generation,
  };
  return { document, usage };
}
