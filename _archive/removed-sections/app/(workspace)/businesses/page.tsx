import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { orgRows } from "@/lib/data/queries";

export default async function BusinessesPage() {
  const result = await orgRows<{ id: string; name: string; industry: string; city: string | null; status: string }>(
    "businesses",
    "id,name,industry,city,status",
  );
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">Businesses</h1>
      {!result.configured ? <p className="text-sm">Database not configured.</p> : null}
      {result.message ? <p className="text-sm">{result.message}</p> : null}
      {result.rows.length === 0 ? <p className="text-sm">No businesses stored for this account.</p> : null}
      {result.rows.map((business) => (
        <Card key={business.id}>
          <h2 className="text-2xl"><Link href={`/businesses/${business.id}`}>{business.name}</Link></h2>
          <p className="text-sm">{business.industry} · {business.city || "city not supplied"} · {business.status}</p>
        </Card>
      ))}
      <Link className="font-semibold underline" href="/dashboard#assessment">Add a business</Link>
    </div>
  );
}
