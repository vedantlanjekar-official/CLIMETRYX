import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { BRAND } from "@/lib/brand";
import type { ChartSpec, IntelligenceReport, TableSpec } from "../reports/document";
import { HORIZON_LABEL } from "../reports/document";
import { formatDateTime } from "@/lib/datetime";
import { KIND_LABEL, metricValue, narrativeLabel } from "../reports/format";
import type { Metric } from "../types";

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = PAGE[0] - MARGIN * 2;
const TOP = PAGE[1] - 56;
const BOTTOM = 64;

const INK = rgb(0.08, 0.15, 0.14);
const MUTED = rgb(0.38, 0.45, 0.43);
const BRAND_COLOUR = rgb(0.07, 0.36, 0.33);
const LINE = rgb(0.85, 0.84, 0.8);
const SERIES: RGB[] = [rgb(0.12, 0.44, 0.4), rgb(0.76, 0.44, 0.18), rgb(0.23, 0.5, 0.69), rgb(0.54, 0.35, 0.05), rgb(0.71, 0.2, 0.16), rgb(0.42, 0.36, 0.65)];

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/≥/g, ">="], [/≤/g, "<="], [/→/g, "->"], [/←/g, "<-"], [/₹/g, "Rs "], [/[−‐‑]/g, "-"], [/≈/g, "~"], [/Σ/g, "Sum "], [/Δ/g, "Change "], [/×/g, "x"], [/[\u00a0\u202f\u2009]/g, " "], [/[\u200b-\u200d]/g, ""],
];
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Standard PDF fonts only encode WinAnsi; anything else is transliterated or replaced. */
export function pdfSafe(text: string): string {
  let value = text;
  for (const [pattern, replacement] of REPLACEMENTS) value = value.replace(pattern, replacement);
  return [...value]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (char === "\n" || char === "\t") return " ";
      if ((code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(char)) return char;
      return "?";
    })
    .join("");
}

const shortNumber = (value: number) => (Math.abs(value) >= 1e7 ? `${(value / 1e7).toFixed(1)} cr` : Math.abs(value) >= 1e5 ? `${(value / 1e5).toFixed(1)} L` : Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value * 100) / 100}`);

class Writer {
  page!: PDFPage;
  y = TOP;
  pages: PDFPage[] = [];
  constructor(readonly doc: PDFDocument, readonly font: PDFFont, readonly bold: PDFFont) {}

  newPage() {
    this.page = this.doc.addPage(PAGE);
    this.pages.push(this.page);
    this.y = TOP;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  lines(text: string, size: number, font: PDFFont, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of pdfSafe(text).split(/\s{2,}|\r/)) {
      let line = "";
      for (const word of paragraph.split(" ").filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else line = next;
      }
      if (line) out.push(line);
    }
    return out.length ? out : [""];
  }

  text(text: string, { size = 10, font = this.font, color = INK, indent = 0, gap = 4, width = WIDTH - indent }: { size?: number; font?: PDFFont; color?: RGB; indent?: number; gap?: number; width?: number } = {}) {
    for (const line of this.lines(text, size, font, width)) {
      this.ensure(size + 2);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= size + 3;
    }
    this.y -= gap;
  }

  heading(text: string, size = 15) {
    this.ensure(size + 40);
    this.y -= 6;
    this.text(text, { size, font: this.bold, color: BRAND_COLOUR, gap: 2 });
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + 60, y: this.y }, thickness: 1.5, color: BRAND_COLOUR });
    this.y -= 10;
  }

  bullet(text: string) {
    const lines = this.lines(text, 10, this.font, WIDTH - 14);
    this.ensure(13);
    this.page.drawText("•", { x: MARGIN + 2, y: this.y - 10, size: 10, font: this.font, color: BRAND_COLOUR });
    for (const line of lines) {
      this.ensure(13);
      this.page.drawText(line, { x: MARGIN + 14, y: this.y - 10, size: 10, font: this.font, color: INK });
      this.y -= 13;
    }
    this.y -= 2;
  }

  metrics(items: Metric[]) {
    if (!items.length) return;
    const columns = 3;
    const cell = WIDTH / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const blocks = row.map((item) => ({ item, label: this.lines(item.label, 8, this.font, cell - 12) }));
      const height = 18 + Math.max(...blocks.map((block) => block.label.length)) * 10 + 14;
      this.ensure(height + 6);
      blocks.forEach(({ item, label }, column) => {
        const x = MARGIN + column * cell;
        this.page.drawRectangle({ x, y: this.y - height, width: cell - 6, height, borderColor: LINE, borderWidth: 0.8 });
        label.forEach((line, lineIndex) => this.page.drawText(line, { x: x + 6, y: this.y - 11 - lineIndex * 10, size: 8, font: this.font, color: MUTED }));
        const valueY = this.y - 13 - label.length * 10 - 4;
        this.page.drawText(pdfSafe(metricValue(item)).slice(0, 34), { x: x + 6, y: valueY, size: 11, font: this.bold, color: item.value === null ? MUTED : INK });
        this.page.drawText(pdfSafe(KIND_LABEL[item.kind] ?? item.kind), { x: x + 6, y: this.y - height + 4, size: 6.5, font: this.font, color: MUTED });
      });
      this.y -= height + 6;
    }
    this.y -= 4;
  }

  table(table: TableSpec) {
    const size = 7.5;
    const weights = table.columns.map((column) => {
      const longest = Math.max(column.label.length, ...table.rows.slice(0, 30).map((row) => String(row[column.key] ?? "").length));
      return Math.min(Math.max(longest, 6), 48);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map((value) => (value / total) * WIDTH);
    const cell = (value: unknown) => (value === null || value === undefined ? "Not available" : typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value));
    const drawRow = (values: string[], font: PDFFont, shade: boolean) => {
      const wrapped = values.map((value, index) => this.lines(value, size, font, widths[index]! - 6));
      const height = Math.max(...wrapped.map((lines) => lines.length)) * (size + 2.5) + 6;
      this.ensure(height);
      if (shade) this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: WIDTH, height, color: rgb(0.95, 0.95, 0.93) });
      let x = MARGIN;
      wrapped.forEach((lines, index) => {
        const right = table.columns[index]!.align === "right";
        lines.forEach((line, lineIndex) => {
          const lineWidth = font.widthOfTextAtSize(line, size);
          this.page.drawText(line, { x: right ? x + widths[index]! - 3 - lineWidth : x + 3, y: this.y - 3 - size - lineIndex * (size + 2.5), size, font, color: INK });
        });
        x += widths[index]!;
      });
      this.page.drawLine({ start: { x: MARGIN, y: this.y - height }, end: { x: MARGIN + WIDTH, y: this.y - height }, thickness: 0.5, color: LINE });
      this.y -= height;
    };
    this.ensure(40);
    this.text(table.title, { size: 10, font: this.bold, gap: 2 });
    const header = table.columns.map((column) => column.label);
    drawRow(header, this.bold, true);
    for (const row of table.rows) {
      if (this.y - 20 < BOTTOM) {
        this.newPage();
        drawRow(header, this.bold, true);
      }
      drawRow(table.columns.map((column) => cell(row[column.key])), this.font, false);
    }
    if (table.note) {
      this.y -= 3;
      this.text(table.note, { size: 7.5, color: MUTED });
    }
    this.y -= 8;
  }

  chart(spec: ChartSpec) {
    const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
    const hasData = spec.data.some((row) => spec.series.some((series) => numeric(row[series.key])));
    this.ensure(60);
    this.text(spec.title, { size: 10, font: this.bold, gap: 1 });
    this.text(`Unit: ${spec.unit}${spec.rightUnit ? ` (right axis: ${spec.rightUnit})` : ""} · Period: ${spec.period}`, { size: 7.5, color: MUTED, gap: 4 });
    if (!hasData) {
      this.text("No data for this chart. It is not drawn rather than shown as zero.", { size: 8.5, color: MUTED });
    } else if (spec.kind === "horizontalBar" || spec.kind === "radar") {
      this.horizontalBars(spec);
    } else {
      this.cartesian(spec);
    }
    const legend = spec.series.map((series) => series.label).join("   ");
    let x = MARGIN;
    this.ensure(14);
    spec.series.forEach((series, index) => {
      this.page.drawRectangle({ x, y: this.y - 8, width: 7, height: 7, color: SERIES[index % SERIES.length]! });
      const label = pdfSafe(series.label);
      this.page.drawText(label, { x: x + 10, y: this.y - 8, size: 7.5, font: this.font, color: INK });
      x += 18 + this.font.widthOfTextAtSize(label, 7.5);
    });
    if (legend) this.y -= 14;
    this.text(spec.explanation, { size: 8.5, color: INK, gap: 1 });
    this.text(`Source: ${spec.source}`, { size: 7, color: MUTED, gap: 10 });
  }

  private horizontalBars(spec: ChartSpec) {
    const labelWidth = 150;
    const plot = WIDTH - labelWidth - 60;
    const values = spec.data.flatMap((row) => spec.series.map((series) => row[series.key])).filter((value): value is number => typeof value === "number");
    const max = Math.max(...values.map(Math.abs), ...(spec.referenceLines ?? []).map((line) => line.value), 1);
    const barHeight = 7;
    for (const row of spec.data) {
      const height = spec.series.length * (barHeight + 2) + 6;
      this.ensure(height);
      const label = this.lines(String(row[spec.xKey] ?? ""), 7.5, this.font, labelWidth - 6)[0]!;
      this.page.drawText(label, { x: MARGIN, y: this.y - 9, size: 7.5, font: this.font, color: INK });
      spec.series.forEach((series, index) => {
        const value = row[series.key];
        const top = this.y - 2 - index * (barHeight + 2);
        if (typeof value === "number") {
          const width = Math.max(0.5, (Math.abs(value) / max) * plot);
          this.page.drawRectangle({ x: MARGIN + labelWidth, y: top - barHeight, width, height: barHeight, color: SERIES[index % SERIES.length]! });
          this.page.drawText(pdfSafe(shortNumber(value)), { x: MARGIN + labelWidth + width + 3, y: top - barHeight + 1, size: 6.5, font: this.font, color: MUTED });
        } else {
          this.page.drawText("no data", { x: MARGIN + labelWidth, y: top - barHeight + 1, size: 6.5, font: this.font, color: MUTED });
        }
      });
      this.y -= height;
    }
    this.y -= 4;
  }

  private cartesian(spec: ChartSpec) {
    const height = 150;
    this.ensure(height + 30);
    const left = MARGIN + 44;
    const right = MARGIN + WIDTH - (spec.series.some((series) => series.axis === "right") ? 40 : 6);
    const top = this.y - 4;
    const base = top - height;
    const plotWidth = right - left;
    const range = (axis: "left" | "right") => {
      const values = spec.data.flatMap((row) => spec.series.filter((series) => (series.axis ?? "left") === axis).map((series) => row[series.key])).filter((value): value is number => typeof value === "number");
      for (const line of spec.referenceLines ?? []) if ((line.axis ?? "left") === axis) values.push(line.value);
      if (!values.length) return null;
      const min = Math.min(0, ...values);
      const max = Math.max(...values);
      return { min, max: max === min ? min + 1 : max };
    };
    const scales = { left: range("left"), right: range("right") };
    const y = (value: number, axis: "left" | "right") => {
      const scale = scales[axis]!;
      return base + ((value - scale.min) / (scale.max - scale.min)) * height;
    };
    this.page.drawLine({ start: { x: left, y: base }, end: { x: right, y: base }, thickness: 0.8, color: LINE });
    this.page.drawLine({ start: { x: left, y: base }, end: { x: left, y: top }, thickness: 0.8, color: LINE });
    for (const axis of ["left", "right"] as const) {
      const scale = scales[axis];
      if (!scale) continue;
      const x = axis === "left" ? MARGIN : right + 4;
      this.page.drawText(pdfSafe(shortNumber(scale.max)), { x, y: top - 6, size: 6.5, font: this.font, color: MUTED });
      this.page.drawText(pdfSafe(shortNumber(scale.min)), { x, y: base, size: 6.5, font: this.font, color: MUTED });
      if (scale.min < 0) this.page.drawLine({ start: { x: left, y: y(0, axis) }, end: { x: right, y: y(0, axis) }, thickness: 0.5, color: LINE });
    }
    const count = spec.data.length;
    const step = plotWidth / Math.max(count, 1);
    const centre = (index: number) => left + step * index + step / 2;
    const barSeries = spec.series.filter((series) => (spec.kind === "bar" ? true : spec.kind === "composed" && (series.type ?? "bar") === "bar"));
    const groups = new Map<string, typeof barSeries>();
    barSeries.forEach((series, index) => groups.set(series.stack ?? `solo-${index}`, [...(groups.get(series.stack ?? `solo-${index}`) ?? []), series]));
    const groupList = [...groups.values()];
    const barWidth = Math.min(22, (step * 0.75) / Math.max(groupList.length, 1));
    spec.data.forEach((row, index) => {
      groupList.forEach((group, groupIndex) => {
        let stackBase = 0;
        for (const series of group) {
          const value = row[series.key];
          if (typeof value !== "number") continue;
          const axis = series.axis ?? "left";
          if (!scales[axis]) continue;
          const x = centre(index) - (groupList.length * barWidth) / 2 + groupIndex * barWidth;
          const from = y(stackBase, axis);
          const to = y(stackBase + value, axis);
          this.page.drawRectangle({ x, y: Math.min(from, to), width: barWidth - 1, height: Math.max(0.5, Math.abs(to - from)), color: SERIES[spec.series.indexOf(series) % SERIES.length]! });
          if (series.stack) stackBase += value;
        }
      });
    });
    const lineSeries = spec.series.filter((series) => !barSeries.includes(series));
    for (const series of lineSeries) {
      const axis = series.axis ?? "left";
      if (!scales[axis]) continue;
      const colour = SERIES[spec.series.indexOf(series) % SERIES.length]!;
      let previous: { x: number; y: number } | null = null;
      spec.data.forEach((row, index) => {
        const value = row[series.key];
        if (typeof value !== "number") {
          previous = null;
          return;
        }
        const point = { x: centre(index), y: y(value, axis) };
        if (previous) this.page.drawLine({ start: previous, end: point, thickness: 1.6, color: colour });
        if (count <= 24) this.page.drawCircle({ x: point.x, y: point.y, size: 1.8, color: colour });
        previous = point;
      });
    }
    for (const line of spec.referenceLines ?? []) {
      const axis = line.axis ?? "left";
      if (!scales[axis]) continue;
      const lineY = y(line.value, axis);
      this.page.drawLine({ start: { x: left, y: lineY }, end: { x: right, y: lineY }, thickness: 0.8, color: rgb(0.71, 0.2, 0.16), dashArray: [4, 3] });
      this.page.drawText(pdfSafe(line.label).slice(0, 60), { x: right - this.font.widthOfTextAtSize(pdfSafe(line.label).slice(0, 60), 6.5), y: lineY + 2, size: 6.5, font: this.font, color: rgb(0.71, 0.2, 0.16) });
    }
    const every = Math.max(1, Math.ceil(count / 10));
    spec.data.forEach((row, index) => {
      if (index % every !== 0 && index !== count - 1) return;
      const label = pdfSafe(String(row[spec.xKey] ?? "")).slice(0, 14);
      const width = this.font.widthOfTextAtSize(label, 6.5);
      this.page.drawText(label, { x: centre(index) - width / 2, y: base - 10, size: 6.5, font: this.font, color: MUTED });
    });
    this.y = base - 18;
  }
}

export async function intelligenceReportToPdf(report: IntelligenceReport, meta: { version: number }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(report.title));
  doc.setAuthor(BRAND.name);
  doc.setSubject(pdfSafe(`${report.businessName} - ${report.siteLabel}`));
  doc.setCreationDate(new Date(report.generatedAt));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  const generated = new Date(report.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

  w.newPage();
  const cover = w.page;
  cover.drawRectangle({ x: 0, y: PAGE[1] - 230, width: PAGE[0], height: 230, color: rgb(0.05, 0.2, 0.19) });
  cover.drawText(pdfSafe(BRAND.name), { x: MARGIN, y: PAGE[1] - 70, size: 14, font: bold, color: rgb(1, 1, 1) });
  cover.drawText(pdfSafe(report.category.replace(/_/g, " ").toUpperCase()), { x: MARGIN, y: PAGE[1] - 120, size: 9, font: bold, color: rgb(0.72, 0.87, 0.85) });
  w.y = PAGE[1] - 132;
  for (const line of w.lines(report.title, 24, bold, WIDTH)) {
    cover.drawText(line, { x: MARGIN, y: w.y - 24, size: 24, font: bold, color: rgb(1, 1, 1) });
    w.y -= 30;
  }
  w.y = PAGE[1] - 270;
  const facts: Array<[string, string]> = [
    ["Business", report.businessName],
    ["Site", report.siteLabel],
    ["Report version", `v${meta.version}`],
    ["Generated", generated],
    ["Climate data as of", new Date(report.dataAsOf).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })],
    ["Status", report.status === "completed" ? "Completed" : "Completed with limitations"],
    ["Narrative", narrativeLabel(report.generation)],
    ["Prepared for", report.audience.join(", ")],
    ["Engine / snapshot", `${report.engineVersion} / ${report.snapshotHash.slice(0, 12)}`],
  ];
  for (const [label, value] of facts) {
    cover.drawText(pdfSafe(label), { x: MARGIN, y: w.y, size: 9, font, color: MUTED });
    w.lines(value, 10, bold, WIDTH - 140).forEach((line, index) => cover.drawText(line, { x: MARGIN + 140, y: w.y - index * 13, size: 10, font: bold, color: INK }));
    w.y -= 13 * Math.max(1, w.lines(value, 10, bold, WIDTH - 140).length) + 6;
  }
  w.y -= 16;
  w.text(report.headline, { size: 12, font: bold, gap: 14 });
  w.text(report.disclaimer, { size: 8.5, color: MUTED });

  const sections: Array<{ title: string; page: PDFPage }> = [];
  const mark = (title: string) => {
    w.newPage();
    sections.push({ title, page: w.page });
  };

  mark("Executive summary");
  w.heading("Executive summary");
  w.text(report.headline, { size: 11.5, font: bold, gap: 8 });
  for (const paragraph of report.executiveSummary) w.text(paragraph, { size: 10, gap: 6 });
  if (report.keyFindings.length) {
    w.text("Key findings", { size: 11, font: bold, gap: 4 });
    for (const finding of report.keyFindings) w.bullet(finding.text);
    w.y -= 6;
  }
  w.metrics(report.keyMetrics);

  report.sections.forEach((section, index) => {
    if (index === 0 || w.y < 300) mark(section.title);
    else {
      w.y -= 12;
      sections.push({ title: section.title, page: w.page });
    }
    w.heading(section.title);
    if (section.narrative) w.text(section.narrative, { size: 10, gap: 6 });
    for (const paragraph of section.paragraphs) w.text(paragraph, { size: 10, color: INK, gap: 6 });
    for (const callout of section.callouts) w.text(`${callout.tone === "risk" ? "Risk" : callout.tone === "warning" ? "Note" : callout.tone === "positive" ? "Strength" : "Info"}: ${callout.text}`, { size: 9.5, font: bold, color: callout.tone === "risk" ? rgb(0.64, 0.15, 0.11) : callout.tone === "warning" ? rgb(0.54, 0.35, 0.05) : BRAND_COLOUR, gap: 6 });
    for (const bullet of section.bullets) w.bullet(bullet);
    if (section.bullets.length) w.y -= 6;
    w.metrics(section.metrics);
    for (const chart of section.charts) w.chart(chart);
    for (const table of section.tables) w.table(table);
  });

  mark("Recommended actions");
  w.heading("Recommended actions");
  if (!report.recommendations.length) w.text("No actions were derived from the available data.", { color: MUTED });
  report.recommendations.forEach((action, index) => {
    w.text(`${index + 1}. ${action.action}`, { size: 10.5, font: bold, gap: 1 });
    w.text(`${action.priority} priority · ${HORIZON_LABEL[action.horizon]}`, { size: 8, color: MUTED, indent: 12, gap: 1 });
    w.text(action.rationale, { size: 9.5, indent: 12, gap: 8 });
  });

  mark("Methodology, assumptions and limitations");
  w.heading("Methodology, assumptions and limitations");
  for (const [title, items] of [["Methodology", report.methodology], ["Assumptions", report.assumptions], ["Limitations", report.limitations]] as const) {
    w.text(title, { size: 11, font: bold, gap: 3 });
    if (!items.length) w.text("None recorded.", { color: MUTED });
    for (const item of items) w.bullet(item);
    w.y -= 8;
  }

  mark("Sources and data gaps");
  w.heading("Sources and data gaps");
  if (report.dataGaps.length) {
    w.table({ id: "gaps", title: "Missing or incomplete inputs", columns: [{ key: "area", label: "Area" }, { key: "missing", label: "Missing" }, { key: "effect", label: "Effect on this report" }], rows: report.dataGaps.map((gap) => ({ ...gap })) });
  }
  w.table({
    id: "sources",
    title: "Data sources",
    columns: [{ key: "name", label: "Source" }, { key: "licence", label: "Licence" }, { key: "retrieved", label: "Retrieved" }, { key: "resolution", label: "Resolution" }],
    rows: report.sources.map((source) => ({ name: source.name, licence: source.licence, retrieved: source.retrievedAt ? `${formatDateTime(source.retrievedAt)} IST` : null, resolution: source.resolution })),
  });
  w.text(report.disclaimer, { size: 8.5, color: MUTED });

  const toc = doc.insertPage(1, PAGE);
  const all = doc.getPages();
  const pageNumber = (page: PDFPage) => all.indexOf(page) + 1;
  toc.drawText("Contents", { x: MARGIN, y: TOP - 18, size: 18, font: bold, color: BRAND_COLOUR });
  let tocY = TOP - 50;
  sections.forEach((entry, index) => {
    const title = pdfSafe(`${index + 1}. ${entry.title}`).slice(0, 80);
    const number = String(pageNumber(entry.page));
    toc.drawText(title, { x: MARGIN, y: tocY, size: 10.5, font, color: INK });
    const titleEnd = MARGIN + font.widthOfTextAtSize(title, 10.5) + 6;
    const numberX = MARGIN + WIDTH - font.widthOfTextAtSize(number, 10.5);
    if (numberX - titleEnd > 10) toc.drawLine({ start: { x: titleEnd, y: tocY + 2 }, end: { x: numberX - 6, y: tocY + 2 }, thickness: 0.5, color: LINE, dashArray: [1, 2] });
    toc.drawText(number, { x: numberX, y: tocY, size: 10.5, font, color: INK });
    tocY -= 20;
  });

  const footer = pdfSafe(`${report.title} · v${meta.version} · generated ${generated} IST · Decision support, not a credit decision`);
  all.forEach((page, index) => {
    if (index === 0) return;
    page.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: PAGE[0] - MARGIN, y: 44 }, thickness: 0.5, color: LINE });
    page.drawText(footer.length > 110 ? `${footer.slice(0, 107)}...` : footer, { x: MARGIN, y: 30, size: 7, font, color: MUTED });
    const label = `Page ${index + 1} of ${all.length}`;
    page.drawText(label, { x: PAGE[0] - MARGIN - font.widthOfTextAtSize(label, 7.5), y: 30, size: 7.5, font: bold, color: MUTED });
  });
  return doc.save();
}
