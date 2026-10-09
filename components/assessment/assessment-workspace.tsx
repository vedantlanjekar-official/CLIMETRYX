"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { submitAssessmentAnswers } from "@/lib/actions/assessment";
import { formatDateTime, formatTime } from "@/lib/datetime";
import type { InitialDraftState } from "@/lib/assessments/draft-state";
import { dimensionCoverage, evidenceSummary, missingData, stepProgress } from "@/lib/questionnaire/completeness";
import { assessmentLevel, contextFor } from "@/lib/questionnaire/engine";
import { sitesForAnalysis, stableStringify } from "@/lib/questionnaire/mapping";
import { GROUPS, QUESTIONS_BY_KEY, STEPS } from "@/lib/questionnaire/registry";
import type { AnswerValue, AssessmentAnswers } from "@/lib/questionnaire/types";
import { validateAnswers, type ValidationIssue } from "@/lib/questionnaire/validation";
import type { ReportModel } from "@/lib/reports/model";
import { ReportView } from "@/components/report/report-view";
import { ContextRail } from "@/components/assessment/context-rail";
import { ReviewPanel } from "@/components/assessment/review-panel";
import { StepForm, issueKey, type IssueMap, type StepHandlers } from "@/components/assessment/step-form";
import { StepNavigator } from "@/components/assessment/step-navigator";
import { UploadPanel } from "@/components/assessment/upload-panel";
import { clearLocalBackup, readLocalBackup, useAutosave, type LocalBackup, type SaveState } from "@/components/assessment/use-autosave";

function newRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowHasContent(values: Record<string, AnswerValue>): boolean {
  return Object.entries(values).some(([key, value]) => key !== "site_status" && key !== "is_primary" && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));
}

function saveLabel(state: SaveState, initialSavedAt: string | null): { text: string; tone: "ok" | "busy" | "bad" | "idle" } {
  switch (state.kind) {
    case "idle":
      return initialSavedAt ? { text: `Saved ${formatTime(initialSavedAt)}`, tone: "ok" } : { text: "Not saved yet", tone: "idle" };
    case "pending":
      return { text: "Unsaved changes", tone: "busy" };
    case "saving":
      return { text: "Saving…", tone: "busy" };
    case "saved":
      return { text: `Saved ${formatTime(state.at)}`, tone: "ok" };
    case "local":
      return { text: "Saved in this browser only", tone: "idle" };
    case "error":
      return { text: `Not saved: ${state.message}`, tone: "bad" };
    case "conflict":
      return { text: "Saved copy changed elsewhere", tone: "bad" };
  }
}

export function AssessmentWorkspace({ initial }: { initial: InitialDraftState }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AssessmentAnswers>(initial.answers);
  const [current, setCurrent] = useState<string>(STEPS.some((step) => step.id === initial.currentStep) ? initial.currentStep : "purpose");
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [restore, setRestore] = useState<LocalBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [previewReport, setPreviewReport] = useState<ReportModel | null>(null);
  const workspace = initial.mode === "workspace";
  const autosave = useAutosave(answers, current, initial.revision, workspace);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is only readable after hydration */
  useEffect(() => {
    const backup = readLocalBackup();
    if (!backup || stableStringify(backup.answers) === stableStringify(initial.answers)) return;
    if (!workspace) {
      setAnswers(backup.answers);
      setCurrent(backup.currentStep || "purpose");
      const restored = "Answers saved earlier in this browser were restored.";
      setNotice((existing) => (existing?.includes(restored) ? existing : [existing, restored].filter(Boolean).join(" ")));
    } else if (!initial.savedAt || backup.savedAt > initial.savedAt) {
      setRestore(backup);
    }
  }, [initial.answers, initial.savedAt, workspace]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const step = STEPS.find((item) => item.id === current) ?? STEPS[0]!;
  const stepIndex = STEPS.indexOf(step);
  const derived = useMemo(() => {
    const context = contextFor(answers);
    const draftIssues = validateAnswers(answers, "draft");
    const submitIssues = validateAnswers(answers, "submit");
    const typeKeys = new Set(draftIssues.map((issue) => issueKey(issue.groupKey, issue.rowId, issue.key)));
    const shown: ValidationIssue[] = submitIssues.filter(
      (issue) => submitAttempted || attempted.has(issue.stepId) || typeKeys.has(issueKey(issue.groupKey, issue.rowId, issue.key)),
    );
    const issueMap: IssueMap = new Map(shown.map((issue) => [issueKey(issue.groupKey, issue.rowId, issue.key), issue.message]));
    return {
      context,
      submitIssues,
      issueMap,
      progress: stepProgress(answers, shown),
      coverage: dimensionCoverage(answers),
      evidence: evidenceSummary(answers),
      missing: missingData(answers),
      sites: sitesForAnalysis(answers, 12),
    };
  }, [answers, attempted, submitAttempted]);

  const goTo = useCallback((id: string) => {
    setCurrent(id);
    document.getElementById("assessment")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlers: StepHandlers = useMemo(
    () => ({
      setValue: (key, value) => setAnswers((prev) => ({ ...prev, values: { ...prev.values, [key]: value } })),
      setRowValues: (groupKey, rowId, patch) =>
        setAnswers((prev) => {
          const rows = (prev.groups[groupKey] ?? []).map((row) => {
            if (row.id === rowId) return { ...row, values: { ...row.values, ...patch } };
            if (groupKey === "sites" && patch.is_primary === true) return { ...row, values: { ...row.values, is_primary: false } };
            return row;
          });
          return { ...prev, groups: { ...prev.groups, [groupKey]: rows } };
        }),
      addRow: (groupKey) =>
        setAnswers((prev) => {
          const rows = prev.groups[groupKey] ?? [];
          const values: Record<string, AnswerValue> = groupKey === "sites" ? { site_status: "active", is_primary: rows.length === 0 } : {};
          return { ...prev, groups: { ...prev.groups, [groupKey]: [...rows, { id: newRowId(), values }] } };
        }),
      removeRow: (groupKey, rowId) =>
        setAnswers((prev) => {
          const rows = prev.groups[groupKey] ?? [];
          const target = rows.find((row) => row.id === rowId);
          if (target && rowHasContent(target.values) && !window.confirm("Remove this entry and its answers?")) return prev;
          return { ...prev, groups: { ...prev.groups, [groupKey]: rows.filter((row) => row.id !== rowId) } };
        }),
    }),
    [],
  );

  function next() {
    setAttempted((prev) => new Set(prev).add(step.id));
    const following = STEPS[stepIndex + 1];
    if (following) goTo(following.id);
  }

  async function saveDraft() {
    await autosave.flush();
  }

  function submit() {
    setSubmitAttempted(true);
    setSubmitError(null);
    if (derived.submitIssues.length) {
      const first = derived.submitIssues[0]!;
      const question = first.groupKey ? GROUPS.get(first.groupKey)?.group.questions.find((item) => item.key === first.key) : QUESTIONS_BY_KEY.get(first.key)?.question;
      const where = question ? `${question.label}: ${first.message}` : first.message;
      setSubmitError(`${derived.submitIssues.length} answer${derived.submitIssues.length === 1 ? "" : "s"} need attention. The first is in step ${STEPS.find((item) => item.id === first.stepId)?.number}, ${where}`);
      return;
    }
    if (!workspace) {
      setSubmitError(initial.mode === "unconfigured" ? "Submission needs Supabase, which is not configured. Use the preview instead." : "Sign in to submit. Your answers stay in this browser.");
      return;
    }
    startSubmit(async () => {
      await autosave.flush();
      const result = await submitAssessmentAnswers({ answers });
      if (result.ok) {
        clearLocalBackup();
        router.push(`/businesses/${result.businessId}`);
      } else {
        setSubmitError(result.message);
        if (result.issues?.[0]) goTo(result.issues[0].stepId);
      }
    });
  }

  const status = saveLabel(autosave.state, initial.savedAt);
  const level = assessmentLevel(answers);
  const role = initial.role;
  const canUpload = workspace && (role === null || role === "owner" || role === "admin" || role === "analyst");

  return (
    <>
      <div className="ax-shell">
        <StepNavigator steps={STEPS} progress={derived.progress} current={current} level={level} onSelect={goTo} />

        <div className="ax-form min-w-0" id="assessment-form">
          <p className="ax-eyebrow">
            Step {step.number} of {STEPS.length}
            {step.optional ? " · Optional" : ""}
          </p>
          <h2 className="ax-title">{step.title}</h2>
          <p className="ax-lede">{step.summary}</p>

          {notice ? <p className="ax-notice">{notice}</p> : null}
          {restore ? (
            <div className="ax-notice ax-warn" role="alert">
              <p>This browser has changes from {formatDateTime(restore.savedAt)} that are newer than the saved draft.</p>
              <div className="mt-2 flex gap-4">
                <button type="button" className="ax-link-btn" onClick={() => { setAnswers(restore.answers); setRestore(null); }}>Restore browser changes</button>
                <button type="button" className="ax-link-btn" onClick={() => setRestore(null)}>Keep saved draft</button>
              </div>
            </div>
          ) : null}
          {autosave.state.kind === "conflict" ? (
            <div className="ax-notice ax-bad" role="alert">
              <p>The saved draft was changed in another tab or session at {formatDateTime(autosave.state.serverSavedAt)}. Autosave is paused until you choose.</p>
              <div className="mt-2 flex gap-4">
                <button type="button" className="ax-link-btn" onClick={() => void autosave.resolveConflict("keep_mine")}>Keep my version</button>
                <button
                  type="button"
                  className="ax-link-btn"
                  onClick={async () => {
                    const server = await autosave.resolveConflict("use_saved");
                    if (server) setAnswers(server);
                  }}
                >
                  Load the saved version
                </button>
              </div>
            </div>
          ) : null}

          {step.id === "uploads" ? (
            <UploadPanel
              enabled={canUpload}
              disabledReason={workspace ? "Only owner, admin and analyst roles can upload documents." : "Uploads are stored in your workspace. Sign in with Supabase configured to add documents."}
              onUploaded={({ assetId, filename, documentType }) =>
                setAnswers((prev) => ({
                  ...prev,
                  groups: { ...prev.groups, documents: [...(prev.groups.documents ?? []), { id: newRowId(), values: { asset_id: assetId, filename, document_type: documentType, related_step: null } }] },
                }))
              }
            />
          ) : null}

          {step.id === "review" ? (
            <ReviewPanel steps={STEPS} progress={derived.progress} answers={answers} onEdit={goTo} submitIssueCount={derived.submitIssues.length} onPreview={setPreviewReport} />
          ) : null}

          <StepForm step={step} answers={answers} context={derived.context} issues={derived.issueMap} handlers={handlers} />

          {step.id === "uploads" && (answers.groups.documents?.length ?? 0) > 0 ? (
            <p className="ax-help mt-3">Removing a document here unlinks it from this assessment. The stored file stays in your organisation&apos;s private storage.</p>
          ) : null}
          {submitError ? <p className="ax-notice ax-bad" role="alert">{submitError}</p> : null}
        </div>

        <ContextRail
          step={step}
          coverage={derived.coverage}
          evidence={derived.evidence}
          missing={derived.missing}
          sites={derived.sites}
          siteCount={answers.groups.sites?.length ?? 0}
          onJump={goTo}
        />
      </div>

      {step.id === "review" && previewReport ? (
        <div id="assessment-report" className="ax-report-slot">
          <ReportView report={previewReport} mode="preview" />
        </div>
      ) : null}

      <div className="ax-actions">
        <div className="ax-actions-inner">
          <span className="ax-status" role="status" aria-live="polite">
            <span className="ax-dot" data-tone={status.tone} aria-hidden />
            {status.text}
          </span>
          <div className="ax-actions-buttons flex flex-wrap items-center gap-2">
            <button type="button" className="ax-btn ax-btn-ghost" aria-label="Back" onClick={() => goTo(STEPS[stepIndex - 1]!.id)} disabled={stepIndex === 0}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> <span className="ax-hide-sm">Back</span>
            </button>
            <button type="button" className="ax-btn ax-btn-secondary" onClick={() => void saveDraft()}>
              Save draft
            </button>
            {step.id === "review" ? (
              <button type="button" className="ax-btn ax-btn-primary" onClick={submit} disabled={submitting}>
                <Send className="h-4 w-4" aria-hidden /> {submitting ? "Submitting" : "Submit assessment"}
              </button>
            ) : (
              <button type="button" className="ax-btn ax-btn-primary" onClick={next}>
                Save and continue <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
