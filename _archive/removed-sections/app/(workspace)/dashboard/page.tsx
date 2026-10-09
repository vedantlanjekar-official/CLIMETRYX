import Link from "next/link";
import { Bot, FileText, Gauge } from "lucide-react";
import { AssessmentWorkspace } from "@/components/assessment/assessment-workspace";
import { JobStatusView } from "@/components/assessment/job-status";
import { Badge, Card } from "@/components/ui/primitives";
import { getJobSnapshot } from "@/lib/actions/assessment";
import { aiStatus } from "@/lib/ai/openai";
import { loadInitialDraft } from "@/lib/assessments/draft-state";
import { orgRows } from "@/lib/data/queries";
import { publicConfigStatus } from "@/lib/config/env";
import "@/components/assessment/assessment.css";

export const maxDuration = 60;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ job?: string | string[] }> }) {
  const { job } = await searchParams;
  const jobId = typeof job === "string" ? job : null;
  const [assessments, reports, snapshot] = await Promise.all([
    orgRows<{ id: string }>("risk_assessments", "id"),
    orgRows<{ id: string }>("intelligence_reports", "id"),
    jobId ? getJobSnapshot(jobId) : Promise.resolve(null),
  ]);
  const initial = snapshot ? null : await loadInitialDraft();
  const config = publicConfigStatus();
  const ai = aiStatus();
  const sources = [
    { label: "Database", ok: config.supabase.configured, detail: config.supabase.configured ? "configured" : "needs configuration" },
    { label: "Open-Meteo", ok: config.openMeteo.configured, detail: config.openMeteo.configured ? config.openMeteo.mode : "needs configuration" },
    { label: "Map style", ok: config.mapStyle.configured, detail: config.mapStyle.configured ? "configured" : "needs configuration" },
    { label: "OpenAI (report narratives)", ok: ai.configured, detail: ai.configured ? `configured · ${ai.model}` : "not configured, rules-written narratives" },
    {
      label: "Copernicus download",
      ok: config.copernicus.configured,
      detail: config.copernicus.configured ? "credentials present, NDVI still requires processing" : "catalog search only until credentials are set",
    },
  ];
  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>
      {assessments.rows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted">Assessments run</p>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Gauge aria-hidden className="h-5 w-5" /></span>
            </div>
            <p className="stat-value mt-3 text-5xl text-ink">{assessments.rows.length}</p>
          </Card>
          <Link href="/reports" className="group">
            <Card className="group-hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted">AI reports generated</p>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><FileText aria-hidden className="h-5 w-5" /></span>
              </div>
              <p className="stat-value mt-3 text-5xl text-ink">{reports.rows.length}</p>
              <p className="mt-2 text-sm font-semibold text-brand-600">Open the AI Reports Centre →</p>
            </Card>
          </Link>
          <Card>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted">AI narrative service</p>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Bot aria-hidden className="h-5 w-5" /></span>
            </div>
            <div className="mt-3"><Badge tone={ai.configured ? "ok" : "warn"}>{ai.configured ? `Configured · ${ai.model}` : "Not configured"}</Badge></div>
            <p className="mt-2 text-xs text-muted">{ai.detail}</p>
          </Card>
        </div>
      ) : null}
      {jobId && !snapshot ? <p className="text-sm text-muted">That analysis job was not found in your workspace. The assessment is shown below.</p> : null}
      <section id="assessment" className="ax" aria-label="Business assessment">
        {snapshot ? <JobStatusView initial={snapshot} /> : <AssessmentWorkspace initial={initial!} />}
      </section>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl">Source configuration</h2>
          <Link className="text-sm font-semibold text-brand-600 hover:text-brand-800" href="/sources">All sources →</Link>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {sources.map((source) => (
            <li key={source.label} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="font-medium text-ink">{source.label}</span>
              <Badge tone={source.ok ? "ok" : "warn"}>{source.detail}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
