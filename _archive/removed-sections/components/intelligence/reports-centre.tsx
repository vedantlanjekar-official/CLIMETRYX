"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, History, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { Badge, Button, Card, SelectInput, TextInput } from "@/components/ui/primitives";
import { generateReports, refreshAssessmentData, reportStatuses } from "@/lib/actions/reports";
import { CATALOGUE, CATEGORIES, CORE_REPORTS, coreReport, type ReportType } from "@/lib/intelligence/catalogue";
import type { AssessmentOption, ReportRow } from "@/lib/intelligence/queries";

type DisplayStatus = "not_generated" | "pending" | "processing" | "completed" | "completed_with_limitations" | "failed" | "outdated";

const STATUS_LABEL: Record<DisplayStatus, string> = {
  not_generated: "Not generated",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  completed_with_limitations: "Completed with limitations",
  failed: "Failed",
  outdated: "Outdated",
};

const STATUS_TONE: Record<DisplayStatus, "neutral" | "warn" | "ok" | "danger"> = {
  not_generated: "neutral",
  pending: "neutral",
  processing: "neutral",
  completed: "ok",
  completed_with_limitations: "warn",
  failed: "danger",
  outdated: "warn",
};

const ACTIVE = new Set(["pending", "processing"]);
const categoryTitle = (id: string) => CATEGORIES.find((category) => category.id === id)?.title ?? id;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function displayStatus(row: ReportRow | undefined, assessment: AssessmentOption): DisplayStatus {
  if (!row) return "not_generated";
  if ((row.status === "completed" || row.status === "completed_with_limitations") && (assessment.stale || assessment.superseded)) return "outdated";
  return row.status;
}

export function ReportsCentre({ assessments, reports, initialAssessmentId, aiConfigured }: { assessments: AssessmentOption[]; reports: ReportRow[]; initialAssessmentId: string; aiConfigured: boolean }) {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState(initialAssessmentId);
  const [selected, setSelected] = useState<Set<ReportType>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [live, setLive] = useState<Record<string, ReportRow["status"]>>({});
  const [busy, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const assessment = assessments.find((item) => item.id === assessmentId) ?? assessments[0]!;
  const rows = useMemo(() => reports.filter((row) => row.assessmentId === assessment.id).map((row) => (live[row.id] ? { ...row, status: live[row.id]! } : row)), [reports, assessment.id, live]);
  const byType = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const row of [...rows].sort((a, b) => b.version - a.version)) map.set(row.reportType, [...(map.get(row.reportType) ?? []), row]);
    return map;
  }, [rows]);
  const activeIds = rows.filter((row) => ACTIVE.has(row.status)).map((row) => row.id);
  const activeKey = activeIds.join(",");

  useEffect(() => {
    if (!activeKey) return;
    const ids = activeKey.split(",");
    const timer = setInterval(async () => {
      const statuses = await reportStatuses(ids);
      setLive((current) => ({ ...current, ...Object.fromEntries(statuses.map((item) => [item.id, item.status as ReportRow["status"]])) }));
      if (statuses.length && statuses.every((item) => !ACTIVE.has(item.status))) {
        clearInterval(timer);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeKey, router]);

  const generate = (types: ReportType[]) => {
    setMessage(null);
    startTransition(async () => {
      const result = await generateReports({ assessmentId: assessment.id, types });
      if (!result.ok) {
        setMessage({ tone: "danger", text: result.message });
        return;
      }
      setSelected(new Set());
      setMessage({ tone: "ok", text: `${types.length} report${types.length === 1 ? "" : "s"} queued. ${aiConfigured ? "AI narratives are written after the analytical snapshot is built." : "AI is not configured, so narratives are rules-written."}` });
      router.refresh();
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    setMessage(null);
    const result = await refreshAssessmentData({ businessId: assessment.businessId });
    setRefreshing(false);
    if (!result.ok) {
      setMessage({ tone: "danger", text: result.message });
      return;
    }
    router.push(`/dashboard?job=${result.jobId}`);
  };

  const needle = query.trim().toLowerCase();
  const coreCards = CORE_REPORTS.filter((report) => {
    if (category !== "all" && report.category !== category) return false;
    if (needle && !`${report.title} ${report.summary}`.toLowerCase().includes(needle)) return false;
    if (statusFilter !== "all" && displayStatus(byType.get(report.type)?.[0], assessment) !== statusFilter) return false;
    return true;
  });
  const catalogue = CATALOGUE.filter((entry) => (category === "all" || entry.category === category) && (!needle || entry.name.toLowerCase().includes(needle)));
  const toggle = (type: ReportType) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Assessment</span>
            <SelectInput
              value={assessment.id}
              onChange={(event) => {
                setAssessmentId(event.target.value);
                setSelected(new Set());
                router.replace(`/reports?assessment=${event.target.value}`, { scroll: false });
              }}
            >
              {assessments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.businessName}
                  {item.siteLabel ? ` · ${item.siteLabel}` : ""} · {when(item.createdAt)}
                  {item.superseded ? " (superseded)" : item.stale ? " (inputs changed)" : ""}
                </option>
              ))}
            </SelectInput>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh} disabled={refreshing || busy} title="Re-run the climate and risk analysis for the latest submitted answers">
              {refreshing ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden className="h-4 w-4" />}
              Refresh data
            </Button>
            <Button variant="secondary" onClick={() => generate([...selected])} disabled={!selected.size || busy}>
              <FileText aria-hidden className="h-4 w-4" />
              Generate selected ({selected.size})
            </Button>
            <Button onClick={() => generate(CORE_REPORTS.map((report) => report.type))} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
              Generate all 10
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={assessment.status === "completed" ? "ok" : "warn"}>Assessment {assessment.status.replace(/_/g, " ")}</Badge>
          {assessment.superseded ? <Badge tone="warn">Superseded by a newer assessment</Badge> : null}
          {assessment.stale && !assessment.superseded ? <Badge tone="warn">Inputs changed since this assessment</Badge> : null}
          {assessment.staleReason ? <span>{assessment.staleReason}</span> : null}
        </div>
        {assessment.stale || assessment.superseded ? (
          <p className="text-sm text-warn-700">Reports for this assessment are marked outdated. Use “Refresh data” to analyse the latest answers, then generate reports for the new assessment.</p>
        ) : null}
        {message ? <p className={message.tone === "ok" ? "text-sm text-ok-700" : "text-sm text-danger-700"} role="status">{message.text}</p> : null}
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Search</span>
          <span className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports, e.g. flood, liquidity, supplier" style={{ paddingLeft: "2.25rem" }} />
          </span>
        </label>
        <label className="flex min-w-52 flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Category</span>
          <SelectInput value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All 24 categories</option>
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.number}. {item.title}</option>
            ))}
          </SelectInput>
        </label>
        <label className="flex min-w-48 flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Status</span>
          <SelectInput value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Any status</option>
            {(Object.keys(STATUS_LABEL) as DisplayStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABEL[key]}</option>
            ))}
          </SelectInput>
        </label>
      </div>

      <section aria-label="Core reports" className="space-y-3">
        <h2 className="text-xl">Core reports</h2>
        {coreCards.length ? null : <p className="text-sm text-muted">No core report matches these filters.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {coreCards.map((report) => {
            const versions = byType.get(report.type) ?? [];
            const latest = versions[0];
            const status = displayStatus(latest, assessment);
            const lastGood = versions.find((row) => row.status === "completed" || row.status === "completed_with_limitations");
            const running = latest ? ACTIVE.has(latest.status) : false;
            return (
              <Card key={report.type} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1.5 h-4 w-4 accent-brand-600" checked={selected.has(report.type)} onChange={() => toggle(report.type)} disabled={running} aria-label={`Select ${report.title}`} />
                    <span>
                      <span className="block text-base font-semibold text-ink">{report.title}</span>
                      <span className="text-xs text-muted">{categoryTitle(report.category)} · For {report.audience.join(", ")}</span>
                    </span>
                  </label>
                  <Badge tone={STATUS_TONE[status]}>
                    {running ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> : null}
                    {STATUS_LABEL[status]}
                  </Badge>
                </div>
                <p className="text-sm text-ink-soft">{report.summary}</p>
                {latest ? (
                  <p className="text-xs text-muted">
                    Version {latest.version} · {when(latest.completedAt ?? latest.createdAt)}
                    {latest.mode ? ` · ${latest.mode === "ai" ? `AI narrative (${latest.model})` : "Rules-written narrative"}` : ""}
                  </p>
                ) : null}
                {latest?.status === "failed" && latest.errorSummary ? <p className="text-xs text-danger-700">Last attempt failed: {latest.errorSummary}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {lastGood ? (
                    <Link className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700" href={`/reports/${lastGood.id}`}>
                      <FileText aria-hidden className="h-4 w-4" /> View{lastGood !== latest ? ` v${lastGood.version}` : ""}
                    </Link>
                  ) : null}
                  <Button variant="secondary" onClick={() => generate([report.type])} disabled={busy || running}>
                    {lastGood ? "Regenerate" : "Generate"}
                  </Button>
                  {versions.length > 1 ? (
                    <details className="text-sm">
                      <summary className="flex cursor-pointer items-center gap-1 text-brand-700"><History aria-hidden className="h-4 w-4" /> {versions.length} versions</summary>
                      <ul className="mt-2 space-y-1">
                        {versions.map((row) => (
                          <li key={row.id} className="flex items-center gap-2 text-xs">
                            {row.status === "completed" || row.status === "completed_with_limitations" ? <Link className="underline" href={`/reports/${row.id}`}>Version {row.version}</Link> : <span>Version {row.version}</span>}
                            <span className="text-muted">{STATUS_LABEL[row.status]} · {when(row.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Report catalogue" className="space-y-3">
        <div>
          <h2 className="text-xl">Full catalogue</h2>
          <p className="mt-1 text-sm text-muted">Every report type from the 24 categories. Most are covered as a section of a core report. Those marked “Needs data” are not produced, and the missing input is shown instead of an estimate.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.filter((item) => catalogue.some((entry) => entry.category === item.id)).map((item) => (
            <Card key={item.id} className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.group}</p>
              <h3 className="mt-1 text-base font-semibold text-ink">{item.number}. {item.title}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {catalogue.filter((entry) => entry.category === item.id).map((entry) => (
                  <li key={entry.name} className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink">{entry.name}</span>
                      {entry.status.kind === "core" ? <Badge tone="ok">Core report</Badge> : entry.status.kind === "section" ? <Badge>Section</Badge> : <Badge tone="warn">Needs data</Badge>}
                    </span>
                    {entry.status.kind === "section" ? (
                      <span className="text-xs text-muted">In {coreReport(entry.status.within)?.title}: “{entry.status.section}”</span>
                    ) : entry.status.kind === "unavailable" ? (
                      <span className="text-xs text-muted">Requires: {entry.status.requires}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
