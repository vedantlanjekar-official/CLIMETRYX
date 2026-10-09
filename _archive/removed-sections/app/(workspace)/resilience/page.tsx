import { orgRows } from "@/lib/data/queries";

export default async function ResiliencePage() {
  const result = await orgRows<{ id: string; measure_key: string; status: string; notes: string | null }>(
    "resilience_measures",
    "id,measure_key,status,notes",
  );
  return (
    <div>
      <h1 className="text-4xl">Resilience measures</h1>
      <p className="mt-2 text-sm">Unknown stays unknown. It is not counted as protection.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {result.rows.map((measure) => <li key={measure.id}>{measure.measure_key}: {measure.status}</li>)}
      </ul>
    </div>
  );
}
