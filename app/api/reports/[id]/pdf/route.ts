import { NextResponse } from "next/server";
import { workspaceContext } from "@/lib/data/queries";
import { reportToPdf } from "@/lib/reports/pdf";
import type { ReportDocument } from "@/lib/reports/document";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await workspaceContext();
  if (!session.supabase || !session.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await session.supabase
    .from("generated_reports")
    .select("content")
    .eq("assessment_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pdf = await reportToPdf(data.content as ReportDocument);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="climetryx-${id}.pdf"`,
    },
  });
}
