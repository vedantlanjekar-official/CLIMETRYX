import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { ReportDocumentView } from "@/components/intelligence/report-document";
import { Badge, Card } from "@/components/ui/primitives";
import { formatDateTime as when } from "@/lib/datetime";
import { reportDetail, reportDocument } from "@/lib/intelligence/queries";
import type { IntelligenceReport } from "@/lib/intelligence/reports/document";
import { metricValue } from "@/lib/intelligence/reports/format";
import type { Metric } from "@/lib/intelligence/types";

export const metadata = { title: "Report" };

function allMetrics(report: IntelligenceReport): Map<string, Metric> {
  const map = new Map<string, Metric>();
  for (const item of report.keyMetrics) map.set(item.id, item);
  for (const section of report.sections) for (const item of section.metrics) if (!map.has(item.id)) map.set(item.id, item);
  return map;
}

export default async function ReportViewerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ compare?: string | string[] }> }) {
  const { id } = await params;
  const { compare } = await searchParams;
  const detail = await reportDetail(id);
  if ("error" in detail) {
    return (
      <div className="space-y-4">
        <Link href="/businesses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft aria-hidden className="h-4 w-4" /> Your businesses</Link>
        <Card><p className="text-sm">{detail.error}</p></Card>
      </div>
    );
  }
  const { row, document: report, versions, assessment } = detail;
  const outdated = Boolean(assessment && (assessment.stale || assessment.superseded));
  const compareId = typeof compare === "string" ? compare : null;
  const other = compareId && compareId !== row.id && versions.some((item) => item.id === compareId) ? await reportDocument(compareId) : null;
  const previousGood = versions.find((item) => item.version < row.version && (item.status === "completed" || item.status === "completed_with_limitations"));

  return (
    <div className="space-y-6">
      <Link href={`/businesses/${row.businessId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft aria-hidden className="h-4 w-4" /> Back to the business</Link>

      {!report ? (
        <Card>
          <p className="text-sm">This version has no document yet (status: {row.status.replace(/_/g, " ")}).{row.errorSummary ? ` ${row.errorSummary}` : ""}</p>
        </Card>
      ) : (
        <>
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{report.category} · For {report.audience.join(", ")}</p>
            <h1>{report.title}</h1>
            <p className="text-sm text-muted">
              {report.businessName} · {report.siteLabel} · Version {row.version} · Generated {when(report.generatedAt)} · Climate data as of {when(report.dataAsOf)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={report.status === "completed" ? "ok" : "warn"}>{report.status === "completed" ? "Completed" : "Completed with limitations"}</Badge>
              {outdated ? <Badge tone="warn">Outdated: the assessment inputs have changed</Badge> : null}
              <Badge>{report.generation.mode === "ai" ? `AI narrative · ${report.generation.model}` : "Rules-written narrative"}</Badge>
              <span className="text-xs text-muted">Engine {report.engineVersion} · Snapshot {report.snapshotHash.slice(0, 12)}</span>
            </div>
            {report.generation.mode === "rules" && report.generation.fallbackReason ? <p className="text-sm text-muted">Why rules-written: {report.generation.fallbackReason}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <a className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700" href={`/api/intelligence/${row.id}/pdf`}><FileText aria-hidden className="h-4 w-4" /> PDF</a>
              <a className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50" href={`/api/intelligence/${row.id}/xlsx`}><FileSpreadsheet aria-hidden className="h-4 w-4" /> Excel</a>
              <a className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50" href={`/api/intelligence/${row.id}/csv`}><Download aria-hidden className="h-4 w-4" /> CSV</a>
            </div>
          </header>

          {versions.length > 1 ? (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg">Versions</h2>
                {previousGood && !other ? <Link className="text-sm font-semibold text-brand-700 underline" href={`/reports/${row.id}?compare=${previousGood.id}`}>Compare with version {previousGood.version}</Link> : null}
              </div>
              <ul className="flex flex-wrap gap-2 text-sm">
                {versions.map((item) => (
                  <li key={item.id}>
                    {item.id === row.id ? (
                      <span className="rounded-lg bg-brand-600 px-2.5 py-1 font-semibold text-white">v{item.version}</span>
                    ) : item.status === "completed" || item.status === "completed_with_limitations" ? (
                      <span className="inline-flex items-center gap-1">
                        <Link className="rounded-lg border border-line px-2.5 py-1 hover:bg-brand-50" href={`/reports/${item.id}`}>v{item.version}</Link>
                        <Link className="text-xs text-brand-700 underline" href={`/reports/${row.id}?compare=${item.id}`}>compare</Link>
                      </span>
                    ) : (
                      <span className="rounded-lg border border-line px-2.5 py-1 text-muted">v{item.version} · {item.status.replace(/_/g, " ")}</span>
                    )}
                  </li>
                ))}
              </ul>
              {other ? <Comparison current={report} currentVersion={row.version} previous={other.document} previousVersion={other.row.version} /> : null}
            </Card>
          ) : null}

          <ReportDocumentView report={report} />
        </>
      )}
    </div>
  );
}

function Comparison({ current, currentVersion, previous, previousVersion }: { current: IntelligenceReport; currentVersion: number; previous: IntelligenceReport; previousVersion: number }) {
  const now = allMetrics(current);
  const before = allMetrics(previous);
  const ids = [...new Set([...now.keys(), ...before.keys()])];
  const rows = ids
    .map((key) => ({ key, a: before.get(key), b: now.get(key) }))
    .filter(({ a, b }) => (a?.value ?? null) !== (b?.value ?? null));
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="text-sm font-semibold">Version {previousVersion} → version {currentVersion}</p>
      {previous.snapshotHash === current.snapshotHash ? <p className="text-sm text-muted">Both versions use the same analytical snapshot, so figures are identical; only the narrative may differ.</p> : null}
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-3 py-2">Metric</th><th className="px-3 py-2 text-right">v{previousVersion}</th><th className="px-3 py-2 text-right">v{currentVersion}</th></tr>
            </thead>
            <tbody>
              {rows.map(({ key, a, b }) => (
                <tr key={key} className="border-t border-line">
                  <td className="px-3 py-2">{(b ?? a)!.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a ? metricValue(a) : "Not in this version"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b ? metricValue(b) : "Not in this version"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No metric changed between these versions.</p>
      )}
      {previous.headline !== current.headline ? (
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p><span className="font-semibold">v{previousVersion} headline:</span> {previous.headline}</p>
          <p><span className="font-semibold">v{currentVersion} headline:</span> {current.headline}</p>
        </div>
      ) : null}
    </div>
  );
}
