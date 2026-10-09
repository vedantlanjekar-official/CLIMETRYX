"use server";

import { after } from "next/server";
import { z } from "zod";
import { initialProgress } from "@/lib/assessments/job";
import { runAssessmentJob } from "@/lib/assessments/job-runner";
import { REPORT_TYPES, type ReportType } from "@/lib/intelligence/catalogue";
import { membership, queueReportBatch, REPORT_ROLES, runReportBatch } from "@/lib/intelligence/service";
import { mergeRestricted } from "@/lib/questionnaire/mapping";
import type { AssessmentAnswers } from "@/lib/questionnaire/types";
import { METHODOLOGY_VERSION } from "@/lib/scoring/types";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const generateInput = z.object({
  assessmentId: z.string().uuid(),
  types: z.array(z.enum(REPORT_TYPES as [ReportType, ...ReportType[]])).min(1).max(REPORT_TYPES.length),
});

export type GenerateResult = { ok: true; batchId: string; reportIds: string[] } | { ok: false; message: string };

async function signedIn() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." } as const;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sign in to generate reports." } as const;
  const member = await membership(supabase, data.user.id);
  if (!member) return { error: "Complete the business assessment first." } as const;
  if (!REPORT_ROLES.includes(member.role)) return { error: "Reports include restricted financial figures and are available to owner, admin and analyst roles only." } as const;
  return { supabase, user: data.user, member } as const;
}

export async function generateReports(raw: unknown): Promise<GenerateResult> {
  const parsed = generateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose at least one valid report." };
  const auth = await signedIn();
  if ("error" in auth) return { ok: false, message: auth.error! };
  const { supabase, user, member } = auth;
  const limited = rateLimit(`reports:${user.id}`, 8, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many report requests. Wait a few minutes before generating again." };

  const queued = await queueReportBatch(supabase, { organizationId: member.organizationId, userId: user.id, assessmentId: parsed.data.assessmentId, types: parsed.data.types });
  if (!queued.ok) return queued;
  const { batchId, context, reports } = queued;
  after(() => runReportBatch({ supabase, batchId, userId: user.id, context, reports }));
  return { ok: true, batchId, reportIds: reports.map((item) => item.id) };
}

export interface ReportStatusRow {
  id: string;
  reportType: string;
  version: number;
  status: string;
  errorSummary: string | null;
  updatedAt: string;
}

export async function reportStatuses(ids: unknown): Promise<ReportStatusRow[]> {
  const parsed = z.array(z.string().uuid()).max(40).safeParse(ids);
  if (!parsed.success || !parsed.data.length) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("intelligence_reports").select("id, report_type, version, status, error_summary, updated_at").in("id", parsed.data);
  return (data ?? []).map((row) => ({ id: row.id as string, reportType: row.report_type as string, version: row.version as number, status: row.status as string, errorSummary: (row.error_summary as string | null) ?? null, updatedAt: row.updated_at as string }));
}

export type RefreshResult = { ok: true; jobId: string } | { ok: false; message: string };

/** Re-runs the climate analysis for the latest submitted answers. Existing reports stay and become outdated. */
export async function refreshAssessmentData(raw: unknown): Promise<RefreshResult> {
  const parsed = z.object({ businessId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown business." };
  const auth = await signedIn();
  if ("error" in auth) return { ok: false, message: auth.error! };
  const { supabase, user, member } = auth;
  const limited = rateLimit(`refresh:${user.id}`, 4, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many refreshes. Wait a few minutes." };

  const { data: version } = await supabase
    .from("assessment_input_versions")
    .select("id, version_number, answers, organization_id")
    .eq("business_id", parsed.data.businessId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version || version.organization_id !== member.organizationId) return { ok: false, message: "No submitted assessment was found for this business." };
  const { data: financial } = await supabase.from("assessment_input_financials").select("answers").eq("input_version_id", version.id).maybeSingle();
  const answers = mergeRestricted(version.answers as AssessmentAnswers, (financial?.answers as AssessmentAnswers | undefined) ?? null);
  const { data: locations } = await supabase.from("business_locations").select("id, client_row_id").eq("business_id", parsed.data.businessId).is("removed_at", null);
  const locationIds = Object.fromEntries((locations ?? []).filter((row) => row.client_row_id).map((row) => [row.client_row_id as string, row.id as string]));

  const { data: job, error } = await supabase
    .from("background_jobs")
    .insert({ organization_id: member.organizationId, business_id: parsed.data.businessId, input_version_id: version.id, job_type: "assessment", status: "queued", stage: null, progress: initialProgress(), payload: { inputVersionId: version.id, versionNumber: version.version_number, methodologyVersion: METHODOLOGY_VERSION, refresh: true } })
    .select("id")
    .single();
  if (error || !job) return { ok: false, message: error?.message ?? "Refresh could not be queued." };
  await supabase.from("audit_logs").insert({ organization_id: member.organizationId, actor_id: user.id, action: "assessment_refreshed", entity_type: "assessment_input_versions", entity_id: version.id, metadata: { jobId: job.id } });
  after(() => runAssessmentJob({ supabase, jobId: job.id as string, organizationId: member.organizationId, businessId: parsed.data.businessId, inputVersionId: version.id as string, userId: user.id, answers, locationIds, warnings: [] }));
  return { ok: true, jobId: job.id as string };
}
