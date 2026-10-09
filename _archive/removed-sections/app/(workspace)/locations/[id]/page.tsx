import { notFound } from "next/navigation";
import { SiteMap } from "@/components/maps/site-map";
import { workspaceContext } from "@/lib/data/queries";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await workspaceContext();
  if (!context.supabase) return <p>Database not configured.</p>;
  const { data } = await context.supabase.from("business_locations").select("label,latitude,longitude,user_confirmed,match_quality,crs,geocoder_name").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">{data.label}</h1>
      <p className="text-sm">CRS {data.crs}. Geocoder {data.geocoder_name || "not used"}. Match {data.match_quality || "not recorded"}. Confirmed: {data.user_confirmed ? "yes" : "no"}.</p>
      <SiteMap latitude={Number(data.latitude)} longitude={Number(data.longitude)} label={data.label} />
    </div>
  );
}
