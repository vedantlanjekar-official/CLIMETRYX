"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, LoaderCircle, MinusCircle, XCircle } from "lucide-react";
import { getJobSnapshot } from "@/lib/actions/assessment";
import { JOB_STAGES, isTerminal, type JobSnapshot, type StageStatus } from "@/lib/assessments/job";
import { formatTime } from "@/lib/datetime";
import { createBrowserSupabase } from "@/lib/supabase/client";

const ICONS: Record<StageStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-[var(--ax-border-strong)]" aria-hidden />,
  running: <LoaderCircle className="h-4 w-4 animate-spin text-[var(--ax-green)]" aria-hidden />,
  done: <CheckCircle2 className="h-4 w-4 text-[var(--ax-green)]" aria-hidden />,
  failed: <XCircle className="h-4 w-4 text-[var(--ax-red)]" aria-hidden />,
  skipped: <MinusCircle className="h-4 w-4 text-[var(--ax-muted)]" aria-hidden />,
};

const STATUS_TEXT: Record<JobSnapshot["status"], string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  completed_with_limitations: "Completed with limitations",
  failed: "Failed",
};

function fromRow(row: Record<string, unknown>, previous: JobSnapshot): JobSnapshot {
  return {
    id: previous.id,
    status: (row.status as JobSnapshot["status"]) ?? previous.status,
    stage: (row.stage as JobSnapshot["stage"]) ?? null,
    progress: (row.progress as JobSnapshot["progress"]) ?? previous.progress,
    result: (row.result as JobSnapshot["result"]) ?? previous.result,
    errorSummary: (row.error_summary as string | null) ?? null,
    updatedAt: (row.updated_at as string) ?? previous.updatedAt,
  };
}

export function JobStatusView({ initial }: { initial: JobSnapshot }) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [channel, setChannel] = useState<"live" | "polling">("polling");
  const done = isTerminal(job.status);

  useEffect(() => {
    if (isTerminal(initial.status)) return;
    const supabase = createBrowserSupabase();
    const subscription = supabase
      ?.channel(`job-${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "background_jobs", filter: `id=eq.${initial.id}` }, (payload) =>
        setJob((previous) => fromRow(payload.new as Record<string, unknown>, previous)),
      )
      .subscribe((state) => setChannel(state === "SUBSCRIBED" ? "live" : "polling"));
    return () => {
      if (subscription) void supabase?.removeChannel(subscription);
    };
  }, [initial.id, initial.status]);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(async () => {
      const snapshot = await getJobSnapshot(initial.id);
      if (snapshot) setJob(snapshot);
    }, channel === "live" ? 15000 : 4000);
    return () => clearInterval(timer);
  }, [channel, done, initial.id]);

  useEffect(() => {
    if (done && !isTerminal(initial.status)) router.refresh();
  }, [done, initial.status, router]);

  const byKey = new Map(job.progress.map((stage) => [stage.key, stage]));

  return (
    <div className="max-w-3xl px-5 py-8 sm:px-8">
      <p className="ax-eyebrow">Assessment progress</p>
      <h2 className="ax-title">{STATUS_TEXT[job.status]}</h2>
      <p className="ax-lede">
        {done
          ? "The climate analysis has finished. AI reports are generated from its saved results."
          : "The climate analysis runs on the server. When it finishes, all AI reports are generated automatically. You can leave this page; progress is saved."}
      </p>
      <ol className="mt-8 border-t border-[var(--ax-border)]" aria-live="polite">
        {JOB_STAGES.map((stage) => {
          const item = byKey.get(stage.key);
          const status: StageStatus = item?.status ?? "pending";
          return (
            <li key={stage.key} className="flex items-start gap-3 border-b border-[var(--ax-border)] py-4">
              <span className="pt-0.5">{ICONS[status]}</span>
              <div className="min-w-0">
                <p className="font-semibold">{stage.label}</p>
                <p className="ax-help">
                  {status === "pending" ? "Waiting" : status.charAt(0).toUpperCase() + status.slice(1)}
                  {item?.detail ? ` · ${item.detail}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {job.errorSummary ? <p className="ax-notice ax-bad">{job.errorSummary}</p> : null}
      {job.result?.warnings?.length ? (
        <div className="ax-notice ax-warn">
          <p className="font-semibold">Recorded limitations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {job.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="mt-6 text-xs text-[var(--ax-muted)]">Updates: {channel === "live" ? "live connection" : "checking every few seconds"} · last change {formatTime(job.updatedAt)}</p>
    </div>
  );
}
