import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobSnapshot } from "@/lib/assessments/job";
import { coreReport, REPORT_TYPES } from "@/lib/intelligence/catalogue";
import type { ReportRowStatus } from "@/lib/intelligence/queries";
import { membership, REPORT_ROLES, type Role } from "@/lib/intelligence/service";
import { createClient } from "@/lib/supabase/server";

export interface BusinessReport {
  id: string;
  type: string;
  title: string;
  summary: string;
  version: number;
  status: ReportRowStatus;
  mode: "ai" | "rules" | null;
  errorSummary: string | null;
  completedAt: string | null;
}

export interface BusinessSummary {
  id: string;
  name: string;
  industry: string;
  place: string | null;
  createdAt: string;
  analysing: boolean;
  analysisFailed: boolean;
  reportsReady: number;
  reportsPending: number;
}

type Access = { state: "unconfigured" | "signed_out" } | { state: "ok"; supabase: SupabaseClient; organizationId: string | null; role: Role | null };

async function access(): Promise<Access> {
  const supabase = await createClient();
  if (!supabase) return { state: "unconfigured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { state: "signed_out" };
  const member = await membership(supabase, data.user.id);
  return { state: "ok", supabase, organizationId: member?.organizationId ?? null, role: member?.role ?? null };
}

const ACTIVE_JOB = ["queued", "running"];
const ACTIVE_REPORT: ReportRowStatus[] = ["pending", "processing"];

const placeOf = (row: { city?: string | null; admin_area?: string | null; country?: string | null }) => [row.city, row.admin_area, row.country].filter(Boolean).join(", ") || null;

interface RawReport {
  id: string;
  business_id: string;
  assessment_id: string;
  report_type: string;
  version: number;
  status: ReportRowStatus;
  generation: { mode?: "ai" | "rules" } | null;
  error_summary: string | null;
  created_at: string;
  completed_at: string | null;
}

/** The newest version of each core report type for one business. */
function latestPerType(rows: RawReport[]): RawReport[] {
  const latest = new Map<string, RawReport>();
  for (const row of rows) {
    const current = latest.get(row.report_type);
    if (!current || row.created_at > current.created_at || (row.created_at === current.created_at && row.version > current.version)) latest.set(row.report_type, row);
  }
  return REPORT_TYPES.map((type) => latest.get(type)).filter((row): row is RawReport => Boolean(row));
}

const REPORT_COLUMNS = "id, business_id, assessment_id, report_type, version, status, generation, error_summary, created_at, completed_at";

export interface DraftSummary {
  name: string | null;
  currentStep: string | null;
  savedAt: string;
}

export type BusinessListData =
  | { state: "unconfigured" | "signed_out" }
  | { state: "ready"; businesses: BusinessSummary[]; draft: DraftSummary | null; canSeeReports: boolean; message: string | null };

/** The caller's unsubmitted new-business draft, if it has any answers. */
async function openDraft(supabase: SupabaseClient, organizationId: string): Promise<DraftSummary | null> {
  const { data } = await supabase.from("onboarding_drafts").select("payload, current_step, updated_at").eq("organization_id", organizationId).is("business_id", null).eq("status", "draft").maybeSingle();
  if (!data) return null;
  const payload = data.payload as { values?: Record<string, unknown>; groups?: Record<string, unknown[]> } | null;
  const answered = Object.keys(payload?.values ?? {}).length + Object.values(payload?.groups ?? {}).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  if (!answered) return null;
  const name = payload?.values?.["profile.legal_name"];
  return { name: typeof name === "string" && name.trim() ? name.trim() : null, currentStep: (data.current_step as string | null) ?? null, savedAt: data.updated_at as string };
}

export async function businessList(): Promise<BusinessListData> {
  const ctx = await access();
  if (ctx.state !== "ok") return ctx;
  if (!ctx.organizationId) return { state: "ready", businesses: [], draft: null, canSeeReports: true, message: null };
  const { supabase, organizationId } = ctx;
  const canSeeReports = Boolean(ctx.role && REPORT_ROLES.includes(ctx.role));
  const [{ data: businesses, error }, { data: jobs }, { data: reports }, draft] = await Promise.all([
    supabase.from("businesses").select("id, name, industry, city, admin_area, country, created_at").eq("organization_id", organizationId).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("background_jobs").select("business_id, status, created_at").eq("organization_id", organizationId).eq("job_type", "assessment").order("created_at", { ascending: false }).limit(500),
    canSeeReports ? supabase.from("intelligence_reports").select(REPORT_COLUMNS).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [] as RawReport[] }),
    openDraft(supabase, organizationId),
  ]);
  const lastJob = new Map<string, string>();
  for (const job of jobs ?? []) if (job.business_id && !lastJob.has(job.business_id as string)) lastJob.set(job.business_id as string, job.status as string);
  return {
    state: "ready",
    draft,
    canSeeReports,
    message: error ? error.message : null,
    businesses: (businesses ?? []).map((row) => {
      const latest = latestPerType(((reports ?? []) as RawReport[]).filter((report) => report.business_id === row.id));
      const job = lastJob.get(row.id as string);
      return {
        id: row.id as string,
        name: row.name as string,
        industry: (row.industry as string) || "",
        place: placeOf(row),
        createdAt: row.created_at as string,
        analysing: Boolean(job && ACTIVE_JOB.includes(job)),
        analysisFailed: job === "failed",
        reportsReady: latest.filter((report) => report.status === "completed" || report.status === "completed_with_limitations").length,
        reportsPending: latest.filter((report) => ACTIVE_REPORT.includes(report.status)).length,
      };
    }),
  };
}

export interface BusinessDetail {
  business: { id: string; name: string; industry: string; place: string | null; createdAt: string };
  job: JobSnapshot | null;
  assessmentId: string | null;
  reports: BusinessReport[];
  canSeeReports: boolean;
}

export async function businessDetail(id: string): Promise<BusinessDetail | { error: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const ctx = await access();
  if (ctx.state === "unconfigured") return { error: "Supabase is not configured." };
  if (ctx.state !== "ok") return { error: "Sign in to view this business." };
  const { supabase } = ctx;
  const canSeeReports = Boolean(ctx.role && REPORT_ROLES.includes(ctx.role));
  const [{ data: business }, { data: job }, { data: assessment }, { data: reports }] = await Promise.all([
    supabase.from("businesses").select("id, name, industry, city, admin_area, country, created_at").eq("id", id).maybeSingle(),
    supabase.from("background_jobs").select("id, status, stage, progress, result, error_summary, updated_at").eq("business_id", id).eq("job_type", "assessment").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("risk_assessments").select("id").eq("business_id", id).is("superseded_by", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    canSeeReports ? supabase.from("intelligence_reports").select(REPORT_COLUMNS).eq("business_id", id).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] as RawReport[] }),
  ]);
  if (!business) return null;
  const latest = latestPerType((reports ?? []) as RawReport[]);
  return {
    business: { id: business.id as string, name: business.name as string, industry: (business.industry as string) || "", place: placeOf(business), createdAt: business.created_at as string },
    job: job
      ? {
          id: job.id as string,
          status: job.status as JobSnapshot["status"],
          stage: (job.stage as JobSnapshot["stage"]) ?? null,
          progress: (job.progress as JobSnapshot["progress"]) ?? [],
          result: (job.result as JobSnapshot["result"]) ?? null,
          errorSummary: (job.error_summary as string | null) ?? null,
          updatedAt: job.updated_at as string,
        }
      : null,
    assessmentId: (job?.result as JobSnapshot["result"] | null)?.assessmentIds?.[0] ?? latest[0]?.assessment_id ?? (assessment?.id as string | undefined) ?? null,
    canSeeReports,
    reports: latest.map((row) => ({
      id: row.id,
      type: row.report_type,
      title: coreReport(row.report_type)?.title ?? row.report_type,
      summary: coreReport(row.report_type)?.summary ?? "",
      version: row.version,
      status: row.status,
      mode: row.generation?.mode ?? null,
      errorSummary: row.error_summary,
      completedAt: row.completed_at,
    })),
  };
}
