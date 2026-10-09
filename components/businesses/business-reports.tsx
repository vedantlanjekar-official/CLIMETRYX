"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { generateReports } from "@/lib/actions/reports";
import type { BusinessReport } from "@/lib/businesses/queries";
import { REPORT_TYPES, type ReportType } from "@/lib/intelligence/catalogue";

const ACTIVE = new Set(["pending", "processing"]);

export function BusinessReports({ reports, assessmentId }: { reports: BusinessReport[]; assessmentId: string | null }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = reports.some((report) => ACTIVE.has(report.status));
  const ready = reports.filter((report) => report.status === "completed" || report.status === "completed_with_limitations").length;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [active, router]);

  function generate(types: ReportType[]) {
    if (!assessmentId) return;
    setError(null);
    startTransition(async () => {
      const result = await generateReports({ assessmentId, types });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4" aria-label="AI reports">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">AI reports</h2>
          <p className="mt-1 text-sm text-muted">
            {reports.length === 0
              ? "No reports yet."
              : active
                ? `Generating… ${ready} of ${reports.length} ready. This page updates on its own.`
                : `${ready} of ${reports.length} reports ready.`}
          </p>
        </div>
        {assessmentId && !active ? (
          <Button variant="secondary" disabled={busy} onClick={() => generate(REPORT_TYPES)}>
            <RefreshCw aria-hidden className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {reports.length ? "Regenerate all reports" : "Generate all reports"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-xl bg-warn-100 px-4 py-3 text-sm text-warn-700">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const done = report.status === "completed" || report.status === "completed_with_limitations";
          return (
            <Card key={report.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg leading-snug">{report.title}</h3>
                  <p className="mt-1 text-sm text-muted">{report.summary}</p>
                </div>
                <span className="shrink-0 pt-1">
                  {ACTIVE.has(report.status) ? (
                    <LoaderCircle aria-label="Generating" className="h-5 w-5 animate-spin text-brand-600" />
                  ) : done ? (
                    <CheckCircle2 aria-label="Ready" className="h-5 w-5 text-ok-700" />
                  ) : (
                    <XCircle aria-label="Failed" className="h-5 w-5 text-warn-700" />
                  )}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {done ? (
                  <>
                    <Badge tone={report.status === "completed" ? "ok" : "warn"}>{report.status === "completed" ? "Ready" : "Ready, with limitations"}</Badge>
                    <Badge>{report.mode === "ai" ? "AI narrative" : "Rules-written narrative"}</Badge>
                    {assessmentId && !active ? (
                      <Button variant="ghost" className="ml-auto" disabled={busy} onClick={() => generate([report.type as ReportType])}>
                        <RefreshCw aria-hidden className="h-4 w-4" /> Regenerate
                      </Button>
                    ) : null}
                    <Link href={`/reports/${report.id}`} className={`${assessmentId && !active ? "" : "ml-auto "}inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700`}>
                      <FileText aria-hidden className="h-4 w-4" /> Open report
                    </Link>
                  </>
                ) : ACTIVE.has(report.status) ? (
                  <Badge>{report.status === "processing" ? "Writing…" : "Queued"}</Badge>
                ) : (
                  <>
                    <Badge tone="warn">Failed</Badge>
                    {report.errorSummary ? <span className="text-xs text-muted">{report.errorSummary}</span> : null}
                    {assessmentId ? (
                      <Button variant="ghost" className="ml-auto" disabled={busy} onClick={() => generate([report.type as ReportType])}>
                        Retry
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
