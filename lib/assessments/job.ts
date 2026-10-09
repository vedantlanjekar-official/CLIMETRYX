export const JOB_STAGES = [
  { key: "validating", label: "Checking the submitted input version" },
  { key: "collecting", label: "Retrieving forecast, climatology, official alerts, flood exposure, river, projections and satellite data" },
  { key: "scoring", label: "Computing hazard indicators and vulnerability components" },
  { key: "saving", label: "Saving results" },
  { key: "reporting", label: "Writing the evidence summary and reports" },
] as const;

export type JobStageKey = (typeof JOB_STAGES)[number]["key"];
export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type JobStatus = "queued" | "running" | "completed" | "completed_with_limitations" | "failed";

export interface StageProgress {
  key: JobStageKey;
  status: StageStatus;
  detail?: string;
  at?: string;
}

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  stage: JobStageKey | null;
  progress: StageProgress[];
  result: { assessmentIds?: string[]; inputVersionId?: string; warnings?: string[] } | null;
  errorSummary: string | null;
  updatedAt: string;
}

export function initialProgress(): StageProgress[] {
  return JOB_STAGES.map((stage) => ({ key: stage.key, status: "pending" }));
}

export function updateStage(progress: StageProgress[], key: JobStageKey, status: StageStatus, detail?: string, now = new Date()): StageProgress[] {
  return progress.map((stage) => (stage.key === key ? { ...stage, status, detail, at: now.toISOString() } : stage));
}

export function isTerminal(status: string): boolean {
  return status === "completed" || status === "completed_with_limitations" || status === "failed";
}
