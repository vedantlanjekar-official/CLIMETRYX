import { SiteMap } from "@/components/maps/site-map";
import { orgRows } from "@/lib/data/queries";

export default async function MapPage() {
  const locations = await orgRows<{ id: string; label: string; latitude: number | null; longitude: number | null }>(
    "business_locations",
    "id,label,latitude,longitude",
    { excludeRemoved: true },
  );
  const first = locations.rows.find((location) => location.latitude !== null && location.longitude !== null);
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">Locations map</h1>
      <p className="text-sm">Only stored coordinates are shown. Population-exposure and satellite rasters are not painted as if they were loaded.</p>
      {first ? <SiteMap latitude={Number(first.latitude)} longitude={Number(first.longitude)} label={first.label} /> : <p className="text-sm">No confirmed coordinates are stored.</p>}
      <ul className="text-sm">
        {locations.rows.map((location) => (
          <li key={location.id}>{location.label}: {location.latitude ?? "latitude missing"}, {location.longitude ?? "longitude missing"}</li>
        ))}
      </ul>
    </div>
  );
}
