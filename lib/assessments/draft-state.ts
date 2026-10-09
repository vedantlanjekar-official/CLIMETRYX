import { mergeRestricted } from "@/lib/questionnaire/mapping";
import { emptyAnswers, TEMPLATE_VERSION, type AssessmentAnswers } from "@/lib/questionnaire/types";
import { sanitizeAnswers } from "@/lib/questionnaire/validation";
import { createClient } from "@/lib/supabase/server";

export interface InitialDraftState {
  mode: "unconfigured" | "signed_out" | "workspace";
  answers: AssessmentAnswers;
  revision: number | null;
  currentStep: string;
  savedAt: string | null;
  role: string | null;
  businessId: string | null;
  businessName: string | null;
  submitted: boolean;
  latestVersion: number | null;
  notice: string | null;
}

const blank = (mode: InitialDraftState["mode"], notice: string | null = null): InitialDraftState => ({
  mode,
  answers: emptyAnswers(),
  revision: null,
  currentStep: "purpose",
  savedAt: null,
  role: null,
  businessId: null,
  businessName: null,
  submitted: false,
  latestVersion: null,
  notice,
});

function hasContent(payload: unknown): boolean {
  const clean = sanitizeAnswers(payload);
  return clean.ok && (Object.keys(clean.answers.values).length > 0 || Object.values(clean.answers.groups).some((rows) => rows.length > 0));
}

/**
 * Loads the caller's draft. A submitted draft is reopened from its own payload for reassessment.
 * With `newBusiness`, a draft tied to an existing business is detached and cleared so the next
 * submission creates a new business; that business keeps its submitted input versions.
 * With `businessId`, the draft is pointed at that business and filled from its latest submitted
 * version, unless it holds unsubmitted answers for another business, which are never overwritten.
 */
export async function loadInitialDraft(options: { newBusiness?: boolean; businessId?: string } = {}): Promise<InitialDraftState> {
  const supabase = await createClient();
  if (!supabase) return blank("unconfigured", "Supabase is not configured. Answers are kept in this browser only and cannot be submitted.");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return blank("signed_out", "You are not signed in. Answers are kept in this browser until you sign in.");
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return blank("workspace");

  let { data: draft } = await supabase
    .from("onboarding_drafts")
    .select("id, payload, revision, current_step, updated_at, business_id, status")
    .eq("organization_id", member.organization_id)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const state = blank("workspace");
  state.role = member.role as string;

  if (options.businessId && draft?.business_id !== options.businessId) {
    const unsubmitted = draft && draft.status !== "submitted" && hasContent(draft.payload);
    if (unsubmitted) {
      return { ...state, notice: "The form holds unsubmitted answers for a new business. Submit that business from “Create new business” first; this page will not overwrite those answers." };
    }
    const { data: latest } = await supabase
      .from("assessment_input_versions")
      .select("id, answers")
      .eq("business_id", options.businessId)
      .eq("organization_id", member.organization_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return { ...state, notice: "No submitted answers were found for this business." };
    const { data: financial } = await supabase.from("assessment_input_financials").select("answers").eq("input_version_id", latest.id).maybeSingle();
    const answers = mergeRestricted(latest.answers as AssessmentAnswers, (financial?.answers as AssessmentAnswers | undefined) ?? null);
    const row = { payload: answers, business_id: options.businessId, status: "submitted", current_step: "review", step: 15, updated_at: new Date().toISOString() };
    const { data: pointed } = draft
      ? await supabase.from("onboarding_drafts").update({ ...row, revision: (draft.revision as number) + 1 }).eq("id", draft.id).eq("revision", draft.revision).select("id, payload, revision, current_step, updated_at, business_id, status").maybeSingle()
      : await supabase.from("onboarding_drafts").insert({ ...row, organization_id: member.organization_id, user_id: userData.user.id, template_version: TEMPLATE_VERSION }).select("id, payload, revision, current_step, updated_at, business_id, status").maybeSingle();
    if (!pointed) return { ...state, notice: "The answers for this business could not be opened. Reload the page to try again." };
    draft = pointed;
  }

  if (!draft) return state;

  if (options.newBusiness && draft.business_id) {
    const { data: reset } = await supabase
      .from("onboarding_drafts")
      .update({ payload: emptyAnswers(), business_id: null, status: "draft", current_step: "purpose", step: 1, revision: (draft.revision as number) + 1, updated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .eq("revision", draft.revision)
      .select("revision, updated_at")
      .maybeSingle();
    if (!reset) return { ...state, notice: "The form could not be cleared for a new business. Reload the page to try again." };
    state.revision = reset.revision as number;
    state.savedAt = reset.updated_at as string;
    return state;
  }

  const clean = sanitizeAnswers(draft.payload);
  state.answers = clean.ok ? clean.answers : emptyAnswers();
  state.revision = draft.revision as number;
  state.currentStep = (draft.current_step as string | null) ?? "purpose";
  state.savedAt = draft.updated_at as string;
  state.businessId = (draft.business_id as string | null) ?? null;
  state.submitted = draft.status === "submitted";

  if (state.businessId) {
    const [{ data: business }, { data: latest }] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", state.businessId).maybeSingle(),
      supabase.from("assessment_input_versions").select("id, version_number, answers").eq("business_id", state.businessId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    ]);
    state.businessName = (business?.name as string | undefined) ?? null;
    state.latestVersion = (latest?.version_number as number | undefined) ?? null;
    if (!clean.ok && latest) {
      const { data: financial } = await supabase.from("assessment_input_financials").select("answers").eq("input_version_id", latest.id).maybeSingle();
      state.answers = mergeRestricted(latest.answers as AssessmentAnswers, (financial?.answers as AssessmentAnswers | undefined) ?? null);
    }
  }
  if (state.submitted) {
    state.notice = `Input version ${state.latestVersion ?? ""} was submitted. Editing these answers and submitting again creates a new version; earlier assessments and reports are kept.`;
  }
  return state;
}
