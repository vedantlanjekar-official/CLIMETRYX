import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import { HORIZON_LABEL, type CalloutTone, type IntelligenceReport, type ReportSection, type TableSpec } from "@/lib/intelligence/reports/document";
import { KIND_LABEL, metricValue } from "@/lib/intelligence/reports/format";
import type { Metric } from "@/lib/intelligence/types";
import { ReportChart } from "./report-chart";

const CALLOUT: Record<CalloutTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-brand-200 bg-brand-50 text-brand-900" },
  warning: { icon: AlertTriangle, className: "border-warn-700/20 bg-warn-100 text-warn-700" },
  risk: { icon: ShieldAlert, className: "border-danger-700/20 bg-danger-100 text-danger-700" },
  positive: { icon: CheckCircle2, className: "border-ok-700/20 bg-ok-100 text-ok-700" },
};

const PRIORITY_CLASS = { high: "bg-danger-100 text-danger-700", medium: "bg-warn-100 text-warn-700", low: "bg-brand-50 text-brand-800" };

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((item) => (
        <div key={item.id} className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium text-muted">{item.label}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${item.value === null ? "text-muted" : "text-ink"}`}>{metricValue(item)}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{KIND_LABEL[item.kind] ?? item.kind}</p>
          {item.formula ? <p className="mt-1 text-xs text-ink-soft">{item.formula}</p> : null}
          {item.note ? <p className="mt-1 text-xs text-muted">{item.note}</p> : null}
          <p className="mt-1 text-[11px] text-muted">Source: {item.source}</p>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ table }: { table: TableSpec }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-ink">{table.title}</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} className={`px-3 py-2 font-semibold ${column.align === "right" ? "text-right" : ""}`}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t border-line align-top">
                {table.columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className={`px-3 py-2 ${column.align === "right" ? "text-right tabular-nums" : ""} ${value === null || value === undefined ? "text-muted" : ""}`}>
                      {value === null || value === undefined ? "Not available" : typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? <p className="text-xs text-muted">{table.note}</p> : null}
    </div>
  );
}

function Section({ section, number }: { section: ReportSection; number: number }) {
  return (
    <section id={`s-${section.id}`} className="ir-section scroll-mt-24 space-y-4">
      <h2 className="text-2xl">
        <span className="mr-2 text-muted">{number}.</span>
        {section.title}
      </h2>
      {section.narrative ? <p className="leading-relaxed text-ink">{section.narrative}</p> : null}
      {section.paragraphs.map((text, index) => (
        <p key={index} className="leading-relaxed text-ink-soft">{text}</p>
      ))}
      {section.callouts.map((callout, index) => {
        const { icon: Icon, className } = CALLOUT[callout.tone];
        return (
          <div key={index} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${className}`}>
            <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{callout.text}</p>
          </div>
        );
      })}
      {section.bullets.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          {section.bullets.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      ) : null}
      <MetricGrid metrics={section.metrics} />
      {section.charts.map((chart) => (
        <ReportChart key={chart.id} spec={chart} />
      ))}
      {section.tables.map((table) => (
        <DataTable key={table.id} table={table} />
      ))}
    </section>
  );
}

export function ReportDocumentView({ report }: { report: IntelligenceReport }) {
  const fixed = [
    { id: "summary", title: "Executive summary" },
    ...report.sections.map((section) => ({ id: `s-${section.id}`, title: section.title })),
    { id: "actions", title: "Recommended actions" },
    { id: "method", title: "Methodology, assumptions and limitations" },
    { id: "sources", title: "Sources and data gaps" },
  ];
  return (
    <article className="ir space-y-10">
      <nav aria-label="Contents" className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contents</p>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {fixed.map((item, index) => (
            <li key={item.id}>
              <a className="text-brand-700 hover:underline" href={`#${item.id}`}>{index + 1}. {item.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="summary" className="scroll-mt-24 space-y-4">
        <h2 className="text-2xl">Executive summary</h2>
        <p className="text-lg font-medium leading-relaxed text-ink">{report.headline}</p>
        {report.executiveSummary.map((text, index) => (
          <p key={index} className="leading-relaxed text-ink-soft">{text}</p>
        ))}
        {report.keyFindings.length ? (
          <div>
            <h3 className="text-base font-semibold">Key findings</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {report.keyFindings.map((finding, index) => (
                <li key={index}>{finding.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <MetricGrid metrics={report.keyMetrics} />
      </section>

      {report.sections.map((section, index) => (
        <Section key={section.id} section={section} number={index + 2} />
      ))}

      <section id="actions" className="scroll-mt-24 space-y-3">
        <h2 className="text-2xl">Recommended actions</h2>
        {report.recommendations.length ? (
          <ol className="space-y-3">
            {report.recommendations.map((action, index) => (
              <li key={index} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${PRIORITY_CLASS[action.priority]}`}>{action.priority} priority</span>
                  <span className="text-muted">{HORIZON_LABEL[action.horizon]}</span>
                </div>
                <p className="mt-2 font-semibold text-ink">{action.action}</p>
                <p className="mt-1 text-sm text-ink-soft">{action.rationale}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No actions were derived from the available data.</p>
        )}
      </section>

      <section id="method" className="scroll-mt-24 grid gap-6 lg:grid-cols-3">
        <ListBlock title="Methodology" items={report.methodology} />
        <ListBlock title="Assumptions" items={report.assumptions} />
        <ListBlock title="Limitations" items={report.limitations} />
      </section>

      <section id="sources" className="scroll-mt-24 space-y-4">
        <h2 className="text-2xl">Sources and data gaps</h2>
        {report.dataGaps.length ? (
          <DataTable
            table={{
              id: "gaps",
              title: "Missing or incomplete inputs",
              columns: [
                { key: "area", label: "Area" },
                { key: "missing", label: "Missing" },
                { key: "effect", label: "Effect on this report" },
              ],
              rows: report.dataGaps.map((gap) => ({ ...gap })),
            }}
          />
        ) : null}
        <DataTable
          table={{
            id: "sources",
            title: "Data sources",
            columns: [
              { key: "name", label: "Source" },
              { key: "attribution", label: "Attribution" },
              { key: "licence", label: "Licence" },
              { key: "retrieved", label: "Retrieved" },
              { key: "resolution", label: "Resolution" },
            ],
            rows: report.sources.map((source) => ({ name: source.name, attribution: source.attribution, licence: source.licence, retrieved: source.retrievedAt ? formatDateTime(source.retrievedAt) : null, resolution: source.resolution })),
          }}
        />
        <p className="rounded-xl border border-line bg-canvas p-4 text-sm leading-relaxed text-ink-soft">{report.disclaimer}</p>
      </section>
    </article>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {items.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          {items.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None recorded.</p>
      )}
    </div>
  );
}
