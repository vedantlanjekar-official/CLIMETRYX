import { NextResponse } from "next/server";
import { publicConfigStatus } from "@/lib/config/env";

export function GET() {
  const status = publicConfigStatus();
  return NextResponse.json({
    app: "climetryx",
    supabaseConfigured: status.supabase.configured,
    openMeteoMode: status.openMeteo.mode,
    openMeteoConfigured: status.openMeteo.configured,
    mapStyleConfigured: status.mapStyle.configured,
    copernicusCredentialsPresent: status.copernicus.configured,
    cdsKeyPresent: status.cds.configured,
    earthdataUsernamePresent: status.nasaEarthdata.configured,
  });
}
