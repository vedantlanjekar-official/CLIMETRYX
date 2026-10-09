import { orgRows } from "@/lib/data/queries";

export default async function SuppliersPage() {
  const result = await orgRows<{ id: string; name: string; criticality: string; spend_share: number | null }>(
    "suppliers",
    "id,name,criticality,spend_share",
    { excludeRemoved: true },
  );
  return (
    <div>
      <h1 className="text-4xl">Suppliers</h1>
      <p className="mt-2 max-w-2xl text-sm">Supplier locations are user supplied. A regional hazard overlay is exposure context, not a delivery failure.</p>
      {result.rows.length === 0 ? <p className="mt-4 text-sm">No suppliers stored.</p> : null}
      <ul className="mt-4 space-y-2 text-sm">
        {result.rows.map((supplier) => (
          <li key={supplier.id}>{supplier.name} · {supplier.criticality} · spend share {supplier.spend_share ?? "not supplied"}</li>
        ))}
      </ul>
    </div>
  );
}
