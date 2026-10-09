import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BRAND } from "@/lib/brand";
import type { ReportDocument } from "@/lib/reports/document";

async function readLogo(): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", BRAND.logo));
  } catch {
    return null;
  }
}

export async function reportToPdf(report: ReportDocument): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const logoBytes = await readLogo();
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;
  if (logo) page.drawImage(logo, { x: 48, y: 772, width: 36, height: 36 });
  page.drawText(BRAND.name, { x: logo ? 92 : 48, y: 792, size: 14, font: bold, color: rgb(0.05, 0.27, 0.24) });
  page.drawText(BRAND.tagline, { x: logo ? 92 : 48, y: 778, size: 8, font, color: rgb(0.35, 0.42, 0.41) });
  y = 744;
  const write = (text: string, size: number, header = false) => {
    const used = header ? bold : font;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (used.widthOfTextAtSize(next, size) > 500) {
        if (y < 60) {
          page = doc.addPage([595, 842]);
          y = 800;
        }
        page.drawText(line, { x: 48, y, size, font: used, color: rgb(0.08, 0.15, 0.14) });
        y -= size + 4;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 800;
      }
      page.drawText(line, { x: 48, y, size, font: used, color: rgb(0.08, 0.15, 0.14) });
      y -= size + 8;
    }
  };
  write(report.title, 16, true);
  write(`Generated ${report.generatedAt}`, 10);
  for (const section of report.sections) {
    write(section.title, 12, true);
    for (const paragraph of section.paragraphs) write(paragraph, 10);
  }
  return doc.save();
}

export function reportToCsv(report: ReportDocument): string {
  const rows = [["section", "text"]];
  for (const section of report.sections) {
    for (const paragraph of section.paragraphs) {
      rows.push([section.title, paragraph]);
    }
  }
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
