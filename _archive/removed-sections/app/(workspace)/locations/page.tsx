import Link from "next/link";
import { orgRows } from "@/lib/data/queries";

export default async function LocationsPage() {
  const result = await orgRows<{ id: string; label: string; latitude: number | null; longitude: number | null; user_confirmed: boolean; match_quality: string | null }>(
    "business_locations",
    "id,label,latitude,longitude,user_confirmed,match_quality",
    { excludeRemoved: true },
  );
  return (
    <div>
      <h1 className="text-4xl">Operating locations</h1>
      {result.rows.length === 0 ? <p className="mt-4 text-sm">No locations stored.</p> : null}
      <ul className="mt-4 space-y-3">
        {result.rows.map((location) => (
          <li key={location.id}>
            <Link className="font-semibold underline" href={`/locations/${location.id}`}>{location.label}</Link>
            <p className="text-sm">{location.latitude}, {location.longitude} · {location.user_confirmed ? "user confirmed" : location.match_quality || "unconfirmed"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
