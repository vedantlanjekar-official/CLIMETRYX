import { NextResponse } from "next/server";
import { workspaceContext } from "@/lib/data/queries";
import { reportToCsv } from "@/lib/reports/pdf";
import type { ReportDocument } from "@/lib/reports/document";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await workspaceContext();
  if (!session.supabase || !session.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await session.supabase
    .from("generated_reports")
    .select("content")
    .eq("assessment_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(reportToCsv(data.content as ReportDocument), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="climetryx-${id}.csv"`,
    },
  });
}
