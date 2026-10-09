import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Work runs inside the request that starts it (max 300 s), so anything untouched this long was cut off. */
const STALL_MS = 15 * 60 * 1000;

/**
 * Called on a schedule by the Render cron worker. Marks interrupted analysis jobs and reports as
 * failed so the business page offers Retry and Refresh instead of an endless spinner.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ status: "needs_configuration" }, { status: 503 });
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ status: "needs_configuration" }, { status: 503 });

  const cutoff = new Date(Date.now() - STALL_MS).toISOString();
  const now = new Date().toISOString();
  const [jobs, reports, queued] = await Promise.all([
    supabase
      .from("background_jobs")
      .update({ status: "failed", error_summary: "The analysis was interrupted before it finished. Use “Refresh climate data” to run it again.", completed_at: now, updated_at: now })
      .in("status", ["queued", "running"])
      .lt("updated_at", cutoff)
      .select("id"),
    supabase
      .from("intelligence_reports")
      .update({ status: "failed", error_summary: "Report writing was interrupted before it finished. Use Retry to write it again.", updated_at: now })
      .in("status", ["pending", "processing"])
      .lt("updated_at", cutoff)
      .select("id"),
    supabase.from("background_jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]),
  ]);
  if (jobs.error || reports.error || queued.error) return NextResponse.json({ status: "failed" }, { status: 500 });
  return NextResponse.json({ status: "ok", active: queued.count ?? 0, interruptedJobs: jobs.data.length, interruptedReports: reports.data.length });
}
