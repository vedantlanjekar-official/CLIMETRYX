import ExcelJS from "exceljs";
import type { IntelligenceReport } from "../reports/document";
import { HORIZON_LABEL } from "../reports/document";
import { KIND_LABEL, narrativeLabel } from "../reports/format";
import type { Metric } from "../types";

type Cell = string | number | null;

/** Spreadsheet apps execute cells starting with these characters as formulas. */
export function neutralizeFormula(value: Cell): Cell {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function metricRows(report: IntelligenceReport): Array<{ section: string; metric: Metric }> {
  const rows = report.keyMetrics.map((metric) => ({ section: "Key metrics", metric }));
  for (const section of report.sections) for (const metric of section.metrics) rows.push({ section: section.title, metric });
  return rows;
}

const sheetName = (name: string, used: Set<string>) => {
  const base = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
  let candidate = base;
  for (let index = 2; used.has(candidate.toLowerCase()); index += 1) candidate = `${base.slice(0, 25)} ${index}`;
  used.add(candidate.toLowerCase());
  return candidate;
};

export async function intelligenceReportToXlsx(report: IntelligenceReport, meta: { version: number }): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "FIN-05 Climate & Financial Intelligence";
  book.created = new Date(report.generatedAt);
  const used = new Set<string>();
  const add = (name: string, columns: Array<{ header: string; key: string; width?: number }>, rows: Array<Record<string, Cell>>) => {
    const sheet = book.addWorksheet(sheetName(name, used));
    sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width ?? 22 }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of rows) sheet.addRow(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeFormula(value)])));
    sheet.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));
    return sheet;
  };

  add(
    "Summary",
    [{ header: "Field", key: "field", width: 26 }, { header: "Value", key: "value", width: 110 }],
    [
      { field: "Report", value: report.title },
      { field: "Business", value: report.businessName },
      { field: "Site", value: report.siteLabel },
      { field: "Version", value: meta.version },
      { field: "Generated", value: report.generatedAt },
      { field: "Climate data as of", value: report.dataAsOf },
      { field: "Status", value: report.status },
      { field: "Narrative", value: narrativeLabel(report.generation) },
      { field: "Engine version", value: report.engineVersion },
      { field: "Snapshot hash", value: report.snapshotHash },
      { field: "Headline", value: report.headline },
      ...report.executiveSummary.map((text, index) => ({ field: `Summary ${index + 1}`, value: text })),
      ...report.keyFindings.map((finding, index) => ({ field: `Finding ${index + 1}`, value: finding.text })),
      { field: "Disclaimer", value: report.disclaimer },
    ],
  );

  add(
    "Metrics",
    [
      { header: "Section", key: "section", width: 28 },
      { header: "Metric", key: "label", width: 40 },
      { header: "Value", key: "value", width: 16 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Value type", key: "kind", width: 20 },
      { header: "Formula", key: "formula", width: 50 },
      { header: "Source", key: "source", width: 40 },
      { header: "Note", key: "note", width: 40 },
    ],
    metricRows(report).map(({ section, metric }) => ({ section, label: metric.label, value: metric.value, unit: metric.unit, kind: KIND_LABEL[metric.kind] ?? metric.kind, formula: metric.formula ?? null, source: metric.source, note: metric.note ?? (metric.value === null ? "Not available" : null) })),
  );

  for (const section of report.sections) {
    for (const table of section.tables) {
      add(table.title, table.columns.map((column) => ({ header: column.label, key: column.key, width: Math.min(60, Math.max(14, column.label.length + 4)) })), table.rows);
    }
  }

  const chartRows: Array<Record<string, Cell>> = [];
  for (const section of report.sections) {
    for (const chart of section.charts) {
      for (const row of chart.data) {
        for (const series of chart.series) {
          chartRows.push({ chart: chart.title, x: row[chart.xKey] ?? null, series: series.label, value: row[series.key] ?? null, unit: series.axis === "right" ? (chart.rightUnit ?? chart.unit) : chart.unit, period: chart.period, source: chart.source });
        }
      }
    }
  }
  add(
    "Chart data",
    [
      { header: "Chart", key: "chart", width: 40 },
      { header: "Category / date", key: "x", width: 20 },
      { header: "Series", key: "series", width: 30 },
      { header: "Value", key: "value", width: 14 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Period", key: "period", width: 30 },
      { header: "Source", key: "source", width: 40 },
    ],
    chartRows,
  );

  add(
    "Actions",
    [{ header: "#", key: "n", width: 5 }, { header: "Priority", key: "priority", width: 10 }, { header: "When", key: "horizon", width: 18 }, { header: "Action", key: "action", width: 60 }, { header: "Rationale", key: "rationale", width: 80 }],
    report.recommendations.map((action, index) => ({ n: index + 1, priority: action.priority, horizon: HORIZON_LABEL[action.horizon], action: action.action, rationale: action.rationale })),
  );

  add(
    "Method & limits",
    [{ header: "Type", key: "type", width: 16 }, { header: "Text", key: "text", width: 120 }],
    [
      ...report.methodology.map((text) => ({ type: "Methodology", text })),
      ...report.assumptions.map((text) => ({ type: "Assumption", text })),
      ...report.limitations.map((text) => ({ type: "Limitation", text })),
      ...report.dataGaps.map((gap) => ({ type: "Data gap", text: `${gap.area}: ${gap.missing}. ${gap.effect}` })),
    ],
  );

  add(
    "Sources",
    [{ header: "Source", key: "name", width: 40 }, { header: "Attribution", key: "attribution", width: 50 }, { header: "Licence", key: "licence", width: 30 }, { header: "Retrieved", key: "retrievedAt", width: 24 }, { header: "Resolution", key: "resolution", width: 30 }],
    report.sources.map((source) => ({ name: source.name, attribution: source.attribution, licence: source.licence, retrievedAt: source.retrievedAt, resolution: source.resolution })),
  );

  return Buffer.from(await book.xlsx.writeBuffer());
}

const csvCell = (value: Cell) => {
  const text = String(neutralizeFormula(value) ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function intelligenceReportToCsv(report: IntelligenceReport, meta: { version: number }): string {
  const rows: Cell[][] = [["record", "section", "label", "value", "unit", "value_type", "source", "detail"]];
  rows.push(["report", "", report.title, meta.version, "", "", "", `${report.businessName} | ${report.siteLabel} | generated ${report.generatedAt} | ${report.status}`]);
  rows.push(["headline", "", "Headline", null, "", "", "", report.headline]);
  for (const { section, metric } of metricRows(report)) rows.push(["metric", section, metric.label, metric.value, metric.unit, metric.kind, metric.source, metric.formula ?? metric.note ?? ""]);
  for (const section of report.sections) {
    for (const table of section.tables) {
      for (const row of table.rows) rows.push(["table_row", `${section.title} / ${table.title}`, String(row[table.columns[0]!.key] ?? ""), null, "", "", "", table.columns.slice(1).map((column) => `${column.label}: ${row[column.key] ?? "not available"}`).join(" | ")]);
    }
    for (const chart of section.charts) {
      for (const row of chart.data) for (const series of chart.series) rows.push(["chart_point", `${section.title} / ${chart.title}`, `${row[chart.xKey] ?? ""} - ${series.label}`, row[series.key] ?? null, series.axis === "right" ? (chart.rightUnit ?? chart.unit) : chart.unit, "", chart.source, chart.period]);
    }
  }
  report.recommendations.forEach((action, index) => rows.push(["action", HORIZON_LABEL[action.horizon], `${index + 1}. ${action.action}`, null, "", action.priority, "", action.rationale]));
  for (const text of report.limitations) rows.push(["limitation", "", "", null, "", "", "", text]);
  for (const source of report.sources) rows.push(["source", "", source.name, null, "", "", source.licence, source.retrievedAt ?? ""]);
  rows.push(["disclaimer", "", "", null, "", "", "", report.disclaimer]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
