import { NextResponse } from "next/server";
import { intelligenceReportToPdf } from "@/lib/intelligence/exports/pdf";
import { intelligenceReportToCsv, intelligenceReportToXlsx } from "@/lib/intelligence/exports/tabular";
import { reportDocument } from "@/lib/intelligence/queries";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FORMATS = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
} as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string; format: string }> }) {
  const { id, format } = await context.params;
  if (!(format in FORMATS)) return NextResponse.json({ error: "unsupported_format" }, { status: 404 });
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`export:${user.id}`, 30, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const found = await reportDocument(id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { row, document } = found;
  const meta = { version: row.version };
  const stem = `${document.reportType}-${document.businessName}-v${row.version}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const kind = format as keyof typeof FORMATS;
  const body = kind === "pdf" ? Buffer.from(await intelligenceReportToPdf(document, meta)) : kind === "xlsx" ? await intelligenceReportToXlsx(document, meta) : intelligenceReportToCsv(document, meta);
  return new NextResponse(body as BodyInit, {
    headers: {
      "content-type": FORMATS[kind],
      "content-disposition": `attachment; filename="${stem}.${kind}"`,
      "cache-control": "private, no-store",
    },
  });
}
