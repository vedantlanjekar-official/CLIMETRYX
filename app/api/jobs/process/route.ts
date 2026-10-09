import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ status: "needs_configuration" }, { status: 503 });
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ status: "needs_configuration" }, { status: 503 });
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id,status,attempts")
    .in("status", ["queued", "fetching_data"])
    .limit(20);
  if (error) return NextResponse.json({ status: "failed" }, { status: 500 });
  return NextResponse.json({ status: "ok", queued: data?.length ?? 0 });
}
