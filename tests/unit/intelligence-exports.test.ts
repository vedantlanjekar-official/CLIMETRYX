import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { intelligenceReportToPdf, pdfSafe } from "@/lib/intelligence/exports/pdf";
import { intelligenceReportToCsv, intelligenceReportToXlsx, neutralizeFormula } from "@/lib/intelligence/exports/tabular";
import { REPORT_TYPES } from "@/lib/intelligence/catalogue";
import { composeReport } from "@/lib/intelligence/reports/compose";
import type { IntelligenceReport } from "@/lib/intelligence/reports/document";
import { SYNTHETIC_NOW, syntheticPackage } from "../fixtures/synthetic-manufacturer";

let reports: IntelligenceReport[] = [];

beforeAll(async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  const { pkg, hash } = await syntheticPackage();
  reports = await Promise.all(REPORT_TYPES.map(async (type) => (await composeReport(type, pkg, hash, null, null, SYNTHETIC_NOW)).document));
});

describe("exports (synthetic data)", () => {
  it("transliterates characters the standard PDF fonts cannot encode", () => {
    expect(pdfSafe("≥ 35 °C → ₹ 5,000 − 2")).toBe(">= 35 °C -> Rs  5,000 - 2");
    expect(pdfSafe("日本")).toBe("??");
  });

  it("writes a multi-page PDF with a cover, contents and page-numbered footer for every core report", async () => {
    for (const report of reports) {
      const bytes = await intelligenceReportToPdf(report, { version: 3 });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount(), report.reportType).toBeGreaterThanOrEqual(4);
      expect(doc.getTitle()).toBe(pdfSafe(report.title));
    }
  });

  it("writes an Excel workbook with summary, metrics, chart data and sources sheets", async () => {
    const report = reports.find((item) => item.reportType === "stress_test")!;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await intelligenceReportToXlsx(report, { version: 1 })) as unknown as Parameters<typeof book.xlsx.load>[0]);
    const names = book.worksheets.map((sheet) => sheet.name);
    expect(names).toEqual(expect.arrayContaining(["Summary", "Metrics", "Chart data", "Actions", "Sources"]));
    expect(book.getWorksheet("Metrics")!.rowCount).toBeGreaterThan(2);
  });

  it("neutralises spreadsheet formulas in exported text", () => {
    expect(neutralizeFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula(-5)).toBe(-5);
    const report = { ...reports[0]!, headline: "=cmd|' /C calc'!A0" };
    expect(intelligenceReportToCsv(report, { version: 1 })).toContain("'=cmd");
  });

  it("writes a CSV with metrics, chart points and the disclaimer", () => {
    const csv = intelligenceReportToCsv(reports[0]!, { version: 2 });
    expect(csv.startsWith("\uFEFFrecord,section,label")).toBe(true);
    expect(csv).toContain("metric,");
    expect(csv).toContain("disclaimer,");
  });
});
