"use server";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { gatherEnvironment } from "@/lib/assessments/environment";
import { initialProgress, type JobSnapshot } from "@/lib/assessments/job";
import { runAssessmentJob } from "@/lib/assessments/job-runner";
import { runAssessment } from "@/lib/assessments/pipeline";
import { logError } from "@/lib/observability/logger";
import { dimensionCoverage, evidenceSummary, missingData } from "@/lib/questionnaire/completeness";
import { assessmentLevel } from "@/lib/questionnaire/engine";
import { buildAssessmentRequest, changedFields, materialChanges, mergeRestricted, sitesForAnalysis, splitRestricted, stableStringify } from "@/lib/questionnaire/mapping";
import { businessColumns, persistAnswers } from "@/lib/questionnaire/persist";
import { STEPS } from "@/lib/questionnaire/registry";
import { TEMPLATE_KEY, TEMPLATE_VERSION, type AssessmentAnswers } from "@/lib/questionnaire/types";
import { checkUpload } from "@/lib/questionnaire/uploads";
import { sanitizeAnswers, validateAnswers, type ValidationIssue } from "@/lib/questionnaire/validation";
import { METHODOLOGY_VERSION } from "@/lib/scoring/types";
import { buildReportModel, type ReportModel } from "@/lib/reports/model";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type Role = "owner" | "admin" | "analyst" | "member" | "viewer";
const FINANCIAL_ROLES: Role[] = ["owner", "admin", "analyst"];
const WRITE_ROLES: Role[] = ["owner", "admin", "analyst", "member"];

async function membership(supabase: SupabaseClient, userId: string): Promise<{ organizationId: string; role: Role } | null> {
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

function workspaceName(answers: AssessmentAnswers, email: string | null | undefined): string {
  const business = typeof answers.values["profile.legal_name"] === "string" ? answers.values["profile.legal_name"].trim() : "";
  if (business.length >= 2) return business.slice(0, 160);
  const person = (email ?? "").split("@")[0]?.trim() ?? "";
  return person.length >= 2 ? `${person.slice(0, 140)}'s workspace` : "My workspace";
}

/**
 * First save creates the caller's workspace (organisation) with the caller as owner, so drafts are stored from the start.
 * The id is generated here: the row is only readable to members, so it cannot be read back before the membership exists.
 */
async function ensureOrganization(supabase: SupabaseClient, user: { id: string; email?: string | null }, answers: AssessmentAnswers) {
  const existing = await membership(supabase, user.id);
  if (existing) return { ok: true as const, ...existing };
  const organizationId = randomUUID();
  const { error } = await supabase.from("organizations").insert({ id: organizationId, name: workspaceName(answers, user.email), created_by: user.id });
  if (error) return { ok: false as const, message: `Workspace could not be created: ${error.message}` };
  const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: organizationId, user_id: user.id, role: "owner", status: "active" });
  if (memberError) return { ok: false as const, message: `Workspace membership could not be created: ${memberError.message}` };
  return { ok: true as const, organizationId, role: "owner" as Role };
}

export type DraftSaveResult =
  | { status: "saved"; revision: number; savedAt: string }
  | { status: "conflict"; serverRevision: number; serverSavedAt: string; serverAnswers: AssessmentAnswers }
  | { status: "local_only"; message: string }
  | { status: "error"; message: string };

function stepNumber(stepId: string): number {
  return STEPS.find((step) => step.id === stepId)?.number ?? 1;
}

async function markStaleIfMaterial(supabase: SupabaseClient, businessId: string, organizationId: string, role: Role, answers: AssessmentAnswers) {
  const { data: latest } = await supabase
    .from("assessment_input_versions")
    .select("id, answers")
    .eq("business_id", businessId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  let previous = latest.answers as AssessmentAnswers;
  let current = answers;
  if (FINANCIAL_ROLES.includes(role)) {
    const { data: financial } = await supabase.from("assessment_input_financials").select("answers").eq("input_version_id", latest.id).maybeSingle();
    previous = mergeRestricted(previous, (financial?.answers as AssessmentAnswers | undefined) ?? null);
  } else {
    current = splitRestricted(answers).general;
  }
  const material = materialChanges(changedFields(previous, current));
  if (!material.length) return;
  await supabase
    .from("risk_assessments")
    .update({ stale: true, stale_reason: `Inputs changed since this assessment: ${material.slice(0, 6).join(", ")}${material.length > 6 ? "…" : ""}`, stale_since: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("organization_id", organizationId)
    .is("superseded_by", null)
    .eq("stale", false);
}

export async function saveAssessmentDraft(input: { answers: unknown; baseRevision: number | null; currentStep: string; force?: boolean }): Promise<DraftSaveResult> {
  const supabase = await createClient();
  if (!supabase) return { status: "local_only", message: "Supabase is not configured. The draft is kept in this browser." };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { status: "local_only", message: "Sign in to save to your workspace. The draft is kept in this browser." };
  const limited = rateLimit(`draft:${user.id}`, 120, 10 * 60 * 1000);
  if (!limited.ok) return { status: "error", message: "Saving too often. Changes are kept in this browser and will retry." };
  const clean = sanitizeAnswers(input.answers);
  if (!clean.ok) return { status: "error", message: clean.message };
  const org = await ensureOrganization(supabase, user, clean.answers);
  if (!org.ok) return { status: "error", message: org.message };
  if (!WRITE_ROLES.includes(org.role)) return { status: "error", message: "Your role is view-only. Ask an owner or admin for edit access." };

  const { data: existing, error: readError } = await supabase
    .from("onboarding_drafts")
    .select("id, revision, updated_at, payload, business_id")
    .eq("organization_id", org.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const now = new Date().toISOString();
  const row = {
    payload: clean.answers,
    current_step: input.currentStep,
    step: stepNumber(input.currentStep),
    template_version: TEMPLATE_VERSION,
    status: "draft",
    updated_at: now,
  };
  if (!existing) {
    const { data, error } = await supabase
      .from("onboarding_drafts")
      .insert({ organization_id: org.organizationId, user_id: user.id, revision: 1, ...row })
      .select("revision, updated_at")
      .single();
    if (error || !data) return { status: "error", message: error?.message ?? "Draft was not saved." };
    return { status: "saved", revision: data.revision as number, savedAt: data.updated_at as string };
  }
  if (!input.force && input.baseRevision !== existing.revision) {
    return { status: "conflict", serverRevision: existing.revision as number, serverSavedAt: existing.updated_at as string, serverAnswers: existing.payload as AssessmentAnswers };
  }
  const { data, error } = await supabase
    .from("onboarding_drafts")
    .update({ ...row, revision: (existing.revision as number) + 1 })
    .eq("id", existing.id)
    .eq("revision", existing.revision)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) {
    const { data: fresh } = await supabase.from("onboarding_drafts").select("revision, updated_at, payload").eq("id", existing.id).single();
    return { status: "conflict", serverRevision: fresh?.revision as number, serverSavedAt: fresh?.updated_at as string, serverAnswers: fresh?.payload as AssessmentAnswers };
  }
  if (existing.business_id) {
    await markStaleIfMaterial(supabase, existing.business_id as string, org.organizationId, org.role, clean.answers).catch((staleError) =>
      logError("stale check failed", { message: staleError instanceof Error ? staleError.message : "unknown" }),
    );
  }
  return { status: "saved", revision: data.revision as number, savedAt: data.updated_at as string };
}

export async function uploadAssessmentDocument(formData: FormData): Promise<{ ok: true; assetId: string; filename: string } | { ok: false; message: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Uploads need Supabase Storage, which is not configured." };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, message: "Sign in to upload documents." };
  const limited = rateLimit(`upload:${user.id}`, 20, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many uploads. Wait a few minutes." };
  const member = await membership(supabase, user.id);
  if (!member) return { ok: false, message: "Enter the business name first so your workspace exists." };
  if (!FINANCIAL_ROLES.includes(member.role)) return { ok: false, message: "Only owner, admin and analyst roles can upload documents." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a file." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload({ name: file.name, size: file.size, type: file.type, head: bytes.subarray(0, 512) });
  if (!check.ok) return check;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const objectPath = `${member.organizationId}/assessment/${user.id}/${randomUUID()}-${check.safeName}`;
  const { error: storageError } = await supabase.storage.from("business-uploads").upload(objectPath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (storageError) return { ok: false, message: `Upload failed: ${storageError.message}` };
  const documentType = typeof formData.get("documentType") === "string" ? String(formData.get("documentType")).slice(0, 40) : null;
  const { data, error } = await supabase
    .from("uploaded_data_assets")
    .insert({
      organization_id: member.organizationId,
      bucket: "business-uploads",
      object_path: objectPath,
      filename: check.safeName,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      checksum,
      status: "uploaded_unreviewed",
      document_type: documentType,
      validation_report: { kind: check.kind, checks: ["size", "extension", "declared_type", "file_signature"], checkedAt: new Date().toISOString(), contentParsed: false },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "The file was stored but not recorded." };
  return { ok: true, assetId: data.id as string, filename: check.safeName };
}

export interface PreviewResult {
  ok: boolean;
  message: string;
  report?: ReportModel;
}

export async function previewAssessmentAnswers(raw: unknown): Promise<PreviewResult> {
  const limited = rateLimit("preview-questionnaire", 20, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many preview requests. Wait a few minutes." };
  const clean = sanitizeAnswers(raw);
  if (!clean.ok) return { ok: false, message: clean.message };
  const issues = validateAnswers(clean.answers, "submit");
  if (issues.length) return { ok: false, message: `${issues.length} answer${issues.length === 1 ? "" : "s"} still need attention before a preview can run.` };
  const site = sitesForAnalysis(clean.answers)[0];
  if (!site) return { ok: false, message: "No site has confirmed coordinates." };
  const environment = await gatherEnvironment(site.latitude, site.longitude);
  const request = buildAssessmentRequest(clean.answers, site, environment);
  const result = runAssessment(request);
  result.limitations.push(...environment.notes);
  return {
    ok: true,
    message: "Preview calculated for the primary site. Nothing was saved.",
    report: await buildReportModel(request, result),
  };
}

export type SubmitResult =
  | { ok: true; jobId: string; businessId: string; inputVersionId: string; versionNumber: number }
  | { ok: false; message: string; issues?: ValidationIssue[] };

export async function submitAssessmentAnswers(input: { answers: unknown }): Promise<SubmitResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured, so the assessment cannot be stored. Use the preview on this step instead." };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, message: "Sign in before submitting." };
  const limited = rateLimit(`submit:${user.id}`, 6, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many submissions. Wait a few minutes." };

  const clean = sanitizeAnswers(input.answers);
  if (!clean.ok) return { ok: false, message: clean.message };
  const answers = clean.answers;
  const issues = validateAnswers(answers, "submit");
  if (issues.length) return { ok: false, message: `${issues.length} answer${issues.length === 1 ? "" : "s"} need attention.`, issues };

  const org = await ensureOrganization(supabase, user, answers);
  if (!org.ok) return { ok: false, message: org.message };
  if (!WRITE_ROLES.includes(org.role)) return { ok: false, message: "Your role is view-only." };
  const canWriteFinancials = FINANCIAL_ROLES.includes(org.role);
  if (answers.values["fin.include"] === "yes" && !canWriteFinancials) {
    return { ok: false, message: "Your role cannot store financial figures. Choose “No” on the financial step, or ask an owner, admin or analyst to submit." };
  }

  const { data: draft } = await supabase
    .from("onboarding_drafts")
    .select("id, revision, business_id")
    .eq("organization_id", org.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  let businessId = (draft?.business_id as string | null) ?? null;
  const columns = businessColumns(answers);
  if (businessId) {
    const { error } = await supabase.from("businesses").update(columns).eq("id", businessId);
    if (error) return { ok: false, message: `Business was not updated: ${error.message}` };
  } else {
    const { data, error } = await supabase
      .from("businesses")
      .insert({ ...columns, organization_id: org.organizationId, status: "active", created_by: user.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? "Business was not saved." };
    businessId = data.id as string;
  }

  const { data: previous } = await supabase
    .from("assessment_input_versions")
    .select("id, version_number, answers")
    .eq("business_id", businessId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let previousAnswers: AssessmentAnswers | null = (previous?.answers as AssessmentAnswers | undefined) ?? null;
  if (previous && canWriteFinancials) {
    const { data: financial } = await supabase.from("assessment_input_financials").select("answers").eq("input_version_id", previous.id).maybeSingle();
    previousAnswers = mergeRestricted(previousAnswers!, (financial?.answers as AssessmentAnswers | undefined) ?? null);
  }
  const changed = changedFields(previousAnswers, answers);
  const material = previous ? materialChanges(changed) : [];
  const { general, restricted } = splitRestricted(answers);
  const versionNumber = ((previous?.version_number as number | undefined) ?? 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("assessment_input_versions")
    .insert({
      organization_id: org.organizationId,
      business_id: businessId,
      version_number: versionNumber,
      template_key: TEMPLATE_KEY,
      template_version: TEMPLATE_VERSION,
      methodology_version: METHODOLOGY_VERSION,
      level: assessmentLevel(answers),
      answers: general,
      answers_hash: createHash("sha256").update(stableStringify(answers)).digest("hex"),
      completeness: { dimensions: dimensionCoverage(answers), evidence: evidenceSummary(answers), missing: missingData(answers).length },
      changed_fields: previous ? changed : [],
      material_changes: material,
      previous_version_id: previous?.id ?? null,
      submitted_by: user.id,
    })
    .select("id")
    .single();
  if (versionError || !version) return { ok: false, message: versionError?.message ?? "Input version was not saved." };
  const inputVersionId = version.id as string;

  if (Object.keys(restricted.values).length || Object.keys(restricted.groups).length) {
    const { error } = await supabase.from("assessment_input_financials").insert({ input_version_id: inputVersionId, organization_id: org.organizationId, answers: restricted });
    if (error) return { ok: false, message: `Financial inputs were not saved: ${error.message}` };
  }

  let persisted;
  try {
    persisted = await persistAnswers({ supabase, organizationId: org.organizationId, businessId, inputVersionId, userId: user.id, answers, canWriteFinancials });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Answers were not saved." };
  }

  if (material.length) {
    await supabase
      .from("risk_assessments")
      .update({ stale: true, stale_reason: `Superseded by input version ${versionNumber}: ${material.slice(0, 6).join(", ")}`, stale_since: new Date().toISOString() })
      .eq("business_id", businessId)
      .is("superseded_by", null)
      .eq("stale", false);
  }

  if (draft) {
    await supabase
      .from("onboarding_drafts")
      .update({ business_id: businessId, status: "submitted", revision: (draft.revision as number) + 1, updated_at: new Date().toISOString() })
      .eq("id", draft.id);
  } else {
    await supabase.from("onboarding_drafts").insert({ organization_id: org.organizationId, user_id: user.id, business_id: businessId, payload: answers, status: "submitted", step: 15, current_step: "review", template_version: TEMPLATE_VERSION });
  }

  const { data: job, error: jobError } = await supabase
    .from("background_jobs")
    .insert({
      organization_id: org.organizationId,
      business_id: businessId,
      input_version_id: inputVersionId,
      job_type: "assessment",
      status: "queued",
      stage: null,
      progress: initialProgress(),
      payload: { inputVersionId, versionNumber, methodologyVersion: METHODOLOGY_VERSION },
    })
    .select("id")
    .single();
  if (jobError || !job) return { ok: false, message: jobError?.message ?? "The analysis job could not be queued." };

  await supabase.from("audit_logs").insert({
    organization_id: org.organizationId,
    actor_id: user.id,
    action: "assessment_submitted",
    entity_type: "assessment_input_versions",
    entity_id: inputVersionId,
    metadata: { versionNumber, materialChanges: material, warnings: persisted.warnings.length },
  });

  const jobId = job.id as string;
  const organizationId = org.organizationId;
  const finalBusinessId = businessId;
  after(() =>
    runAssessmentJob({
      supabase,
      jobId,
      organizationId,
      businessId: finalBusinessId,
      inputVersionId,
      userId: user.id,
      answers,
      locationIds: persisted.locationIds,
      warnings: persisted.warnings,
    }),
  );
  return { ok: true, jobId, businessId: finalBusinessId, inputVersionId, versionNumber };
}

export async function getJobSnapshot(jobId: string): Promise<JobSnapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("background_jobs")
    .select("id, status, stage, progress, result, error_summary, updated_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    status: data.status as JobSnapshot["status"],
    stage: (data.stage as JobSnapshot["stage"]) ?? null,
    progress: (data.progress as JobSnapshot["progress"]) ?? [],
    result: (data.result as JobSnapshot["result"]) ?? null,
    errorSummary: (data.error_summary as string | null) ?? null,
    updatedAt: data.updated_at as string,
  };
}
