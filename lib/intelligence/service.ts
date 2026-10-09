import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCostUsd } from "@/lib/ai/openai";
import { fetchEra5Daily } from "@/lib/integrations/open-meteo/client";
import { logError } from "@/lib/observability/logger";
import { mergeRestricted } from "@/lib/questionnaire/mapping";
import type { AssessmentAnswers } from "@/lib/questionnaire/types";
import type { ReportModel } from "@/lib/reports/model";
import type { ReportType } from "./catalogue";
import { MIN_MONTHS_FOR_COMPARISON, monthlyClimate, type ClimateMonth } from "./history";
import { cleanHistory, historyFromAnswers, type MonthlyRecord } from "./normalize";
import { composeReport } from "./reports/compose";
import { openAiNarrativeProvider } from "./reports/openai-provider";
import { buildAnalysisPackage, snapshotHash, type AnalysisPackage } from "./snapshot";
import { ENGINE_VERSION } from "./types";

export type Role = "owner" | "admin" | "analyst" | "member" | "viewer";
export const REPORT_ROLES: Role[] = ["owner", "admin", "analyst"];

export async function membership(supabase: SupabaseClient, userId: string): Promise<{ organizationId: string; role: Role } | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { organizationId: data.organization_id as string, role: data.role as Role } : null;
}

export interface AssessmentContext {
  assessment: { id: string; organizationId: string; businessId: string; inputVersionId: string | null; status: string; stale: boolean; staleReason: string | null; createdAt: string };
  model: ReportModel;
  answers: AssessmentAnswers;
  storedHistory: MonthlyRecord[];
}

export async function loadAssessmentContext(supabase: SupabaseClient, assessmentId: string): Promise<AssessmentContext | { error: string }> {
  const { data: row, error } = await supabase
    .from("risk_assessments")
    .select("id, organization_id, business_id, input_version_id, status, stale, stale_reason, created_at")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error || !row) return { error: "Assessment not found or not accessible." };
  const { data: report } = await supabase
    .from("generated_reports")
    .select("content")
    .eq("assessment_id", assessmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const model = (report?.content as { detail?: ReportModel } | null)?.detail;
  if (!model) return { error: "This assessment has no saved analysis. Refresh the data to run it again." };
  let answers: AssessmentAnswers = { values: {}, groups: {} };
  if (row.input_version_id) {
    const [{ data: version }, { data: financial }] = await Promise.all([
      supabase.from("assessment_input_versions").select("answers").eq("id", row.input_version_id).maybeSingle(),
      supabase.from("assessment_input_financials").select("answers").eq("input_version_id", row.input_version_id).maybeSingle(),
    ]);
    if (version) answers = mergeRestricted(version.answers as AssessmentAnswers, (financial?.answers as AssessmentAnswers | undefined) ?? null);
  }
  const { data: records } = await supabase
    .from("monthly_financial_records")
    .select("year, month, revenue, costs")
    .eq("business_id", row.business_id)
    .order("year")
    .order("month")
    .limit(120);
  const storedHistory: MonthlyRecord[] = (records ?? []).flatMap((record) =>
    record.revenue === null ? [] : [{ month: `${record.year}-${String(record.month).padStart(2, "0")}`, revenue: Number(record.revenue), costs: record.costs === null ? null : Number(record.costs) }],
  );
  return {
    assessment: {
      id: row.id as string,
      organizationId: row.organization_id as string,
      businessId: row.business_id as string,
      inputVersionId: (row.input_version_id as string | null) ?? null,
      status: row.status as string,
      stale: Boolean(row.stale),
      staleReason: (row.stale_reason as string | null) ?? null,
      createdAt: row.created_at as string,
    },
    model,
    answers,
    storedHistory,
  };
}

/** Observed monthly weather for the revenue months, only when there is enough history to compare. */
export async function climateForHistory(history: MonthlyRecord[], latitude: number, longitude: number, now = new Date()): Promise<{ months: ClimateMonth[] | null; source: string | null; retrievedAt: string | null }> {
  if (history.length < MIN_MONTHS_FOR_COMPARISON) return { months: null, source: null, retrievedAt: null };
  const start = `${history[0]!.month}-01`;
  const lastMonth = history.at(-1)!.month;
  const [year, month] = lastMonth.split("-").map(Number) as [number, number];
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const latestAvailable = new Date(now.getTime() - 6 * 86_400_000);
  const end = (monthEnd < latestAvailable ? monthEnd : latestAvailable).toISOString().slice(0, 10);
  try {
    const series = await fetchEra5Daily({ latitude, longitude, startDate: start, endDate: end });
    return { months: monthlyClimate(series.records), source: `ERA5 reanalysis via Open-Meteo, grid ${series.gridLatitude}, ${series.gridLongitude}, ${start} to ${end}`, retrievedAt: new Date().toISOString() };
  } catch (error) {
    logError("revenue weather history failed", { message: error instanceof Error ? error.message : "unknown" });
    return { months: null, source: null, retrievedAt: null };
  }
}

export async function buildSnapshotFor(supabase: SupabaseClient, context: AssessmentContext, userId: string): Promise<{ pkg: AnalysisPackage; hash: string; snapshotId: string | null }> {
  const fromAnswers = historyFromAnswers(context.answers);
  const history = cleanHistory(fromAnswers.length ? fromAnswers : context.storedHistory);
  const climate = await climateForHistory(history, context.model.site.latitude, context.model.site.longitude);
  const pkg = buildAnalysisPackage({
    model: context.model,
    answers: context.answers,
    storedHistory: context.storedHistory,
    climateMonths: climate.months,
    climateMonthsSource: climate.source,
    climateMonthsRetrievedAt: climate.retrievedAt,
    assessment: { id: context.assessment.id, createdAt: context.assessment.createdAt, status: context.assessment.status, stale: context.assessment.stale, staleReason: context.assessment.staleReason },
  });
  const hash = snapshotHash(pkg);
  const { data: existing } = await supabase
    .from("analytical_snapshots")
    .select("id")
    .eq("assessment_id", context.assessment.id)
    .eq("engine_version", ENGINE_VERSION)
    .eq("snapshot_hash", hash)
    .maybeSingle();
  if (existing) return { pkg, hash, snapshotId: existing.id as string };
  const { data: inserted, error } = await supabase
    .from("analytical_snapshots")
    .insert({ organization_id: context.assessment.organizationId, business_id: context.assessment.businessId, assessment_id: context.assessment.id, engine_version: ENGINE_VERSION, snapshot_hash: hash, payload: pkg, created_by: userId })
    .select("id")
    .single();
  if (error) logError("snapshot insert failed", { message: error.message });
  return { pkg, hash, snapshotId: (inserted?.id as string | undefined) ?? null };
}

export interface BatchInput {
  supabase: SupabaseClient;
  batchId: string;
  userId: string;
  context: AssessmentContext;
  reports: Array<{ id: string; type: ReportType }>;
}

export type QueueResult = { ok: true; batchId: string; context: AssessmentContext; reports: Array<{ id: string; type: ReportType }> } | { ok: false; message: string };

/** Creates the batch and one new pending version per report type. Generation itself runs in runReportBatch. */
export async function queueReportBatch(supabase: SupabaseClient, input: { organizationId: string; userId: string; assessmentId: string; types: ReportType[] }): Promise<QueueResult> {
  const context = await loadAssessmentContext(supabase, input.assessmentId);
  if ("error" in context) return { ok: false, message: context.error };
  if (context.assessment.organizationId !== input.organizationId) return { ok: false, message: "Assessment not found." };

  const types = [...new Set(input.types)];
  const { data: active } = await supabase
    .from("intelligence_reports")
    .select("report_type")
    .eq("assessment_id", context.assessment.id)
    .in("status", ["pending", "processing"])
    .in("report_type", types);
  if (active?.length) return { ok: false, message: `Already generating: ${[...new Set(active.map((row) => row.report_type))].join(", ")}. Wait for it to finish.` };

  const { data: batch, error: batchError } = await supabase
    .from("intelligence_report_batches")
    .insert({ organization_id: input.organizationId, business_id: context.assessment.businessId, assessment_id: context.assessment.id, requested_types: types, status: "pending", created_by: input.userId })
    .select("id")
    .single();
  if (batchError || !batch) return { ok: false, message: batchError?.message ?? "The report job could not be queued." };

  const { data: versions } = await supabase
    .from("intelligence_reports")
    .select("report_type, version")
    .eq("assessment_id", context.assessment.id)
    .in("report_type", types)
    .order("version", { ascending: false });
  const next = (type: string) => ((versions ?? []).find((row) => row.report_type === type)?.version ?? 0) + 1;
  const { data: rows, error: rowsError } = await supabase
    .from("intelligence_reports")
    .insert(types.map((type) => ({ organization_id: input.organizationId, business_id: context.assessment.businessId, assessment_id: context.assessment.id, batch_id: batch.id, report_type: type, version: next(type), status: "pending", engine_version: ENGINE_VERSION, created_by: input.userId })))
    .select("id, report_type");
  if (rowsError || !rows) return { ok: false, message: rowsError?.message ?? "Reports could not be queued." };

  await supabase.from("audit_logs").insert({ organization_id: input.organizationId, actor_id: input.userId, action: "reports_requested", entity_type: "intelligence_report_batches", entity_id: batch.id, metadata: { types, assessmentId: context.assessment.id } });
  return { ok: true, batchId: batch.id as string, context, reports: rows.map((row) => ({ id: row.id as string, type: row.report_type as ReportType })) };
}

const REPORT_CONCURRENCY = 3;

/** Generates the queued reports, a few at a time. A failure marks only that report failed; earlier versions are untouched. */
export async function runReportBatch(input: BatchInput): Promise<void> {
  const { supabase, batchId, context } = input;
  const organizationId = context.assessment.organizationId;
  const touch = (patch: Record<string, unknown>) => supabase.from("intelligence_report_batches").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", batchId);
  await touch({ status: "processing" });
  let failed = 0;
  let limited = 0;
  try {
    const { pkg, hash, snapshotId } = await buildSnapshotFor(supabase, context, input.userId);
    const { provider, reason } = openAiNarrativeProvider();
    const queue = [...input.reports];
    const generate = async (report: { id: string; type: ReportType }) => {
      await supabase.from("intelligence_reports").update({ status: "processing", snapshot_id: snapshotId, updated_at: new Date().toISOString() }).eq("id", report.id);
      try {
        const { document, usage } = await composeReport(report.type, pkg, hash, provider, reason);
        if (document.status === "completed_with_limitations" || document.generation.mode === "rules") limited += 1;
        await supabase
          .from("intelligence_reports")
          .update({ status: document.status, document, generation: document.generation, error_summary: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", report.id);
        if (usage.length) {
          await supabase.from("ai_usage_events").insert(
            usage.map((item) => ({
              organization_id: organizationId,
              report_id: report.id,
              provider: "openai",
              model: item.model,
              operation: `report:${report.type}`,
              outcome: item.outcome,
              input_tokens: item.inputTokens,
              output_tokens: item.outputTokens,
              total_tokens: item.inputTokens === null || item.outputTokens === null ? null : item.inputTokens + item.outputTokens,
              latency_ms: item.latencyMs,
              estimated_cost_usd: estimateCostUsd(item.inputTokens, item.outputTokens),
              detail: item.detail?.slice(0, 500) ?? null,
              created_by: input.userId,
            })),
          );
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Report generation failed.";
        logError("report generation failed", { reportId: report.id, message });
        await supabase.from("intelligence_reports").update({ status: "failed", error_summary: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", report.id);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(REPORT_CONCURRENCY, queue.length) }, async () => {
        for (let report = queue.shift(); report; report = queue.shift()) await generate(report);
      }),
    );
    await touch({ status: failed === input.reports.length ? "failed" : failed || limited ? "completed_with_limitations" : "completed", completed_at: new Date().toISOString(), error_summary: failed ? `${failed} report(s) failed.` : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch failed.";
    logError("report batch failed", { batchId, message });
    await supabase.from("intelligence_reports").update({ status: "failed", error_summary: message.slice(0, 500), updated_at: new Date().toISOString() }).in("id", input.reports.map((item) => item.id)).in("status", ["pending", "processing"]);
    await touch({ status: "failed", error_summary: message.slice(0, 500), completed_at: new Date().toISOString() });
  }
}
