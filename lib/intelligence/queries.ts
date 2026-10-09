import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IntelligenceReport } from "./reports/document";
import { membership, REPORT_ROLES } from "./service";

export type ReportRowStatus = "pending" | "processing" | "completed" | "completed_with_limitations" | "failed";

export interface ReportRow {
  id: string;
  businessId: string;
  assessmentId: string;
  reportType: string;
  version: number;
  status: ReportRowStatus;
  mode: "ai" | "rules" | null;
  model: string | null;
  errorSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface RawReport {
  id: string;
  business_id: string;
  assessment_id: string;
  report_type: string;
  version: number;
  status: ReportRowStatus;
  generation: { mode?: "ai" | "rules"; model?: string | null } | null;
  error_summary: string | null;
  created_at: string;
  completed_at: string | null;
}

const toRow = (row: RawReport): ReportRow => ({
  id: row.id,
  businessId: row.business_id,
  assessmentId: row.assessment_id,
  reportType: row.report_type,
  version: row.version,
  status: row.status,
  mode: row.generation?.mode ?? null,
  model: row.generation?.model ?? null,
  errorSummary: row.error_summary,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

const REPORT_COLUMNS = "id, business_id, assessment_id, report_type, version, status, generation, error_summary, created_at, completed_at";

async function context() {
  const supabase = await createClient();
  if (!supabase) return { state: "unconfigured" as const };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { state: "signed_out" as const };
  const member = await membership(supabase, data.user.id);
  if (!member) return { state: "no_org" as const };
  if (!REPORT_ROLES.includes(member.role)) return { state: "forbidden" as const, role: member.role };
  return { state: "ok" as const, supabase, member };
}

export interface ReportDetail {
  row: ReportRow;
  document: IntelligenceReport | null;
  assessment: { stale: boolean; staleReason: string | null; superseded: boolean } | null;
  versions: ReportRow[];
}

export async function reportDetail(id: string): Promise<ReportDetail | { error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Report not found." };
  const ctx = await context();
  if (ctx.state === "forbidden") return { error: "Reports are available to owner, admin and analyst roles only." };
  if (ctx.state !== "ok") return { error: "Sign in to view reports." };
  const { supabase } = ctx;
  const { data } = await supabase.from("intelligence_reports").select(`${REPORT_COLUMNS}, document`).eq("id", id).maybeSingle();
  if (!data) return { error: "Report not found." };
  const row = toRow(data as RawReport);
  const [{ data: versions }, { data: assessment }] = await Promise.all([
    supabase.from("intelligence_reports").select(REPORT_COLUMNS).eq("assessment_id", row.assessmentId).eq("report_type", row.reportType).order("version", { ascending: false }),
    supabase.from("risk_assessments").select("stale, stale_reason, superseded_by").eq("id", row.assessmentId).maybeSingle(),
  ]);
  return {
    row,
    document: (data.document as IntelligenceReport | null) ?? null,
    assessment: assessment ? { stale: Boolean(assessment.stale), staleReason: (assessment.stale_reason as string | null) ?? null, superseded: Boolean(assessment.superseded_by) } : null,
    versions: ((versions ?? []) as RawReport[]).map(toRow),
  };
}

export async function reportDocument(id: string): Promise<{ row: ReportRow; document: IntelligenceReport } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const ctx = await context();
  if (ctx.state !== "ok") return null;
  const { data } = await ctx.supabase.from("intelligence_reports").select(`${REPORT_COLUMNS}, document`).eq("id", id).maybeSingle();
  if (!data?.document) return null;
  return { row: toRow(data as RawReport), document: data.document as IntelligenceReport };
}
