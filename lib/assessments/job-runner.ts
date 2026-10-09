import type { SupabaseClient } from "@supabase/supabase-js";
import { gatherEnvironment } from "@/lib/assessments/environment";
import { initialProgress, updateStage, type JobStageKey, type JobStatus, type StageProgress, type StageStatus } from "@/lib/assessments/job";
import { runAssessment, type AssessmentRequest, type AssessmentResult } from "@/lib/assessments/pipeline";
import { supabaseClimatologyStore } from "@/lib/climatology/supabase-store";
import { REPORT_TYPES } from "@/lib/intelligence/catalogue";
import { membership, queueReportBatch, REPORT_ROLES, runReportBatch } from "@/lib/intelligence/service";
import { logError } from "@/lib/observability/logger";
import { buildAssessmentRequest, sitesForAnalysis } from "@/lib/questionnaire/mapping";
import type { AssessmentAnswers } from "@/lib/questionnaire/types";
import { validateAnswers } from "@/lib/questionnaire/validation";
import { buildReport } from "@/lib/reports/document";
import { buildReportModel } from "@/lib/reports/model";
import { explainScoreChange } from "@/lib/scoring/engine";
import type { VulnerabilityScore } from "@/lib/scoring/types";

export interface JobInput {
  supabase: SupabaseClient;
  jobId: string;
  organizationId: string;
  businessId: string;
  inputVersionId: string;
  userId: string;
  answers: AssessmentAnswers;
  /** Repeat-row id → business_locations.id */
  locationIds: Record<string, string>;
  warnings: string[];
}

class JobTracker {
  private progress: StageProgress[] = initialProgress();
  constructor(private readonly supabase: SupabaseClient, private readonly jobId: string) {}

  async stage(key: JobStageKey, status: StageStatus, detail?: string) {
    this.progress = updateStage(this.progress, key, status, detail);
    const patch: Record<string, unknown> = { stage: key, progress: this.progress, status: "running" };
    if (key === "validating" && status === "running") patch.started_at = new Date().toISOString();
    await this.supabase.from("background_jobs").update(patch).eq("id", this.jobId);
  }

  async finish(status: JobStatus, result: Record<string, unknown>, errorSummary: string | null = null) {
    await this.supabase
      .from("background_jobs")
      .update({ status, result, error_summary: errorSummary, progress: this.progress, completed_at: new Date().toISOString() })
      .eq("id", this.jobId);
  }
}

/** Enough of a stored score for explainScoreChange, which reads only these fields. */
function previousScore(row: { methodology_version: string; score: number | null; risk_component_scores: Array<{ component: string; score: number | null }> } | null): VulnerabilityScore | null {
  if (!row) return null;
  return {
    methodologyVersion: row.methodology_version,
    score: row.score,
    components: row.risk_component_scores.map((component) => ({ id: component.component, score: component.score })),
  } as unknown as VulnerabilityScore;
}

async function saveSiteResult(input: JobInput, siteRowId: string, request: AssessmentRequest, result: AssessmentResult): Promise<string> {
  const { supabase, organizationId, businessId } = input;
  const locationId = input.locationIds[siteRowId] ?? null;
  const { data: prior } = locationId
    ? await supabase
        .from("risk_assessments")
        .select("id, methodology_version, score, risk_component_scores(component, score)")
        .eq("business_id", businessId)
        .eq("location_id", locationId)
        .is("superseded_by", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const change = explainScoreChange(previousScore(prior as Parameters<typeof previousScore>[0]), result.score);
  result.change = change;

  const { data: assessment, error } = await supabase
    .from("risk_assessments")
    .insert({
      organization_id: organizationId,
      business_id: businessId,
      input_version_id: input.inputVersionId,
      location_id: locationId,
      methodology_version: result.methodologyVersion,
      status: result.status,
      input_snapshot: { inputVersionId: input.inputVersionId, siteRowId, location: request.location, utilityOrigin: request.utilityOrigin },
      score: result.score.score,
      score_band: result.score.band,
      evidence_completeness: result.score.evidenceCompleteness,
      previous_assessment_id: prior?.id ?? null,
      score_delta: change.delta,
      change_explanation: change,
      limitations: result.limitations,
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !assessment) throw new Error(error?.message ?? "Assessment was not saved.");
  const assessmentId = assessment.id as string;

  const writes = await Promise.all([
    supabase.from("risk_component_scores").insert(
      result.score.components.map((component) => ({
        organization_id: organizationId,
        assessment_id: assessmentId,
        component: component.id,
        score: component.score,
        baseline_weight: component.baselineWeight,
        effective_weight: component.effectiveWeight,
        included: component.included,
        explanation: component.normalization,
      })),
    ),
    result.hazards.indicators.length
      ? supabase.from("hazard_indicators").insert(
          result.hazards.indicators.map((indicator) => ({
            organization_id: organizationId,
            assessment_id: assessmentId,
            location_id: locationId,
            hazard_type: indicator.hazard,
            indicator_key: indicator.key,
            score: indicator.score,
            status: indicator.status,
            summary: indicator.summary,
            limitations: indicator.limitations,
            provenance: { source: indicator.source, thresholdOrigin: indicator.thresholdOrigin },
          })),
        )
      : Promise.resolve({ error: null }),
    result.recommendations.length
      ? supabase.from("assessment_recommendations").insert(
          result.recommendations.map((item) => ({
            organization_id: organizationId,
            assessment_id: assessmentId,
            action: item.action,
            evidence: item.evidence,
            dependency: item.dependency,
            priority: item.priority,
            benefit: item.benefit,
            cost_status: item.costStatus,
            horizon: item.horizon,
            verification_metric: item.verificationMetric,
          })),
        )
      : Promise.resolve({ error: null }),
    supabase.from("satellite_observations").insert({
      organization_id: organizationId,
      assessment_id: assessmentId,
      location_id: locationId,
      indicator: "ndvi",
      status: result.satellite?.status ?? "not_available",
      value: result.satellite?.latest?.ndvi.mean ?? null,
      formula: result.satellite?.formula,
      limitations: result.satellite?.reason ?? "not available",
      acquisition_time: result.satellite?.catalog?.acquisitionTime,
      product: result.satellite?.catalog?.collection,
      cloud_cover_pct: result.satellite?.catalog?.cloudCoverPct,
      buffer_m: result.satellite?.bufferMeters,
      provenance: result.satellite?.catalog?.provenance ?? {},
    }),
    locationId
      ? supabase.from("risk_assessment_locations").insert({ assessment_id: assessmentId, location_id: locationId, organization_id: organizationId })
      : Promise.resolve({ error: null }),
  ]);
  for (const write of writes) {
    if (write.error) input.warnings.push(`A result table was not fully written: ${write.error.message}`);
  }

  if (result.scenarios.length) {
    const { error: scenarioError } = await supabase.from("financial_stress_scenarios").insert(
      result.scenarios.map((scenario) => ({
        organization_id: organizationId,
        assessment_id: assessmentId,
        business_id: businessId,
        disruption_days: scenario.disruptionDays,
        assumptions: scenario.assumptions,
        result: scenario,
      })),
    );
    if (scenarioError) input.warnings.push("Hypothetical financial scenarios were not saved for your role.");
  }

  if (prior?.id) {
    await supabase
      .from("risk_assessments")
      .update({ superseded_by: assessmentId, stale: true, stale_reason: "Superseded by a newer assessment of the same site.", stale_since: new Date().toISOString() })
      .eq("id", prior.id);
  }
  return assessmentId;
}

/** Queues every core AI report for the primary site's assessment. Reports carry financial figures, so restricted roles are skipped. */
async function queueAiReports(input: JobInput, assessmentId: string) {
  const member = await membership(input.supabase, input.userId);
  if (!member || member.organizationId !== input.organizationId || !REPORT_ROLES.includes(member.role)) {
    input.warnings.push("AI reports were not generated: they include restricted financial figures and need an owner, admin or analyst role.");
    return null;
  }
  const queued = await queueReportBatch(input.supabase, { organizationId: input.organizationId, userId: input.userId, assessmentId, types: REPORT_TYPES });
  if (!queued.ok) {
    input.warnings.push(`AI reports could not be queued: ${queued.message}`);
    return null;
  }
  return queued;
}

export async function runAssessmentJob(input: JobInput): Promise<void> {
  const tracker = new JobTracker(input.supabase, input.jobId);
  const assessmentIds: string[] = [];
  const results: Array<{ request: AssessmentRequest; result: AssessmentResult; assessmentId: string }> = [];
  try {
    await tracker.stage("validating", "running");
    const issues = validateAnswers(input.answers, "submit");
    if (issues.length) {
      await tracker.stage("validating", "failed", `${issues.length} answers failed validation.`);
      await tracker.finish("failed", { inputVersionId: input.inputVersionId }, "The input version did not pass validation.");
      return;
    }
    const sites = sitesForAnalysis(input.answers);
    if (!sites.length) {
      await tracker.stage("validating", "failed", "No operating site has confirmed coordinates.");
      await tracker.finish("failed", { inputVersionId: input.inputVersionId }, "No site could be analysed.");
      return;
    }
    await tracker.stage("validating", "done", `${sites.length} site${sites.length === 1 ? "" : "s"} to analyse.`);

    const store = supabaseClimatologyStore(input.supabase, input.organizationId);
    const prepared: Array<{ siteRowId: string; request: AssessmentRequest; notes: string[] }> = [];
    for (const [index, site] of sites.entries()) {
      await tracker.stage("collecting", "running", `Site ${index + 1} of ${sites.length}: ${site.label}`);
      const environment = await gatherEnvironment(site.latitude, site.longitude, store);
      prepared.push({ siteRowId: site.id, request: buildAssessmentRequest(input.answers, site, environment), notes: environment.notes });
    }
    const providerNotes = prepared.reduce((count, item) => count + item.notes.length, 0);
    await tracker.stage("collecting", "done", providerNotes ? `${providerNotes} provider limitation${providerNotes === 1 ? "" : "s"} recorded.` : "All configured sources responded.");

    await tracker.stage("scoring", "running");
    const scored = prepared.map((item) => {
      const result = runAssessment(item.request);
      result.limitations.push(...item.notes);
      return { ...item, result };
    });
    await tracker.stage("scoring", "done", scored.map((item) => `${item.request.location.label}: ${item.result.score.score ?? "not scored"}`).join(" · "));

    await tracker.stage("saving", "running");
    for (const item of scored) {
      const assessmentId = await saveSiteResult(input, item.siteRowId, item.request, item.result);
      assessmentIds.push(assessmentId);
      results.push({ request: item.request, result: item.result, assessmentId });
    }
    await tracker.stage("saving", "done", `${assessmentIds.length} assessment${assessmentIds.length === 1 ? "" : "s"} saved.`);

    await tracker.stage("reporting", "running");
    let reports = 0;
    for (const item of results) {
      const detail = await buildReportModel(item.request, item.result);
      const { error } = await input.supabase.from("generated_reports").insert({
        organization_id: input.organizationId,
        assessment_id: item.assessmentId,
        version: 1,
        content: { ...buildReport(item.request, item.result), detail },
      });
      if (error) input.warnings.push(`Report for ${item.request.location.label} was not saved: ${error.message}`);
      else reports += 1;
    }
    await tracker.stage("reporting", reports === results.length ? "done" : "failed", `${reports} of ${results.length} reports saved.`);

    const batch = reports > 0 ? await queueAiReports(input, assessmentIds[0]!) : null;
    const limited = input.warnings.length > 0 || results.some((item) => item.result.status !== "completed");
    await tracker.finish(limited ? "completed_with_limitations" : "completed", { assessmentIds, inputVersionId: input.inputVersionId, warnings: input.warnings, reportBatchId: batch?.batchId ?? null });
    await input.supabase.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_id: input.userId,
      action: "assessment_completed",
      entity_type: "assessment_input_versions",
      entity_id: input.inputVersionId,
      metadata: { assessmentIds, limited },
    });
    if (batch) await runReportBatch({ supabase: input.supabase, batchId: batch.batchId, userId: input.userId, context: batch.context, reports: batch.reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown failure.";
    logError("assessment job failed", { jobId: input.jobId, message });
    await tracker.finish("failed", { assessmentIds, inputVersionId: input.inputVersionId, warnings: input.warnings }, message.slice(0, 500));
  }
}
