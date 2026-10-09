import { sumSuppliedCosts, type CostLine } from "@/lib/financial/costs";
import { orgRows } from "@/lib/data/queries";

export default async function FeasibilityPage() {
  const preferences = await orgRows<{ id: string; name: string; budget_amount: number | null; budget_currency: string | null; weights: { cost?: number; resilience?: number; climate?: number } }>(
    "location_preferences",
    "id,name,budget_amount,budget_currency,weights",
    { excludeRemoved: true },
  );
  const lines: CostLine[] = preferences.rows.map((row) => ({
    label: row.name,
    currency: row.budget_currency || "UNK",
    amount: row.budget_amount,
    source: "user supplied budget",
    estimateDate: null,
  }));
  const total = sumSuppliedCosts(lines);
  return (
    <div className="space-y-3">
      <h1 className="text-4xl">Site feasibility</h1>
      <p className="max-w-2xl text-sm">Candidates are compared on the weights the user entered. Climate evidence is attached only when an assessment has retrieved it. This page does not rank a universal best site.</p>
      {preferences.rows.length === 0 ? <p className="text-sm">No preferred locations stored.</p> : null}
      <ul className="space-y-2 text-sm">
        {preferences.rows.map((row) => (
          <li key={row.id}>{row.name}: budget {row.budget_amount ?? "not supplied"} {row.budget_currency ?? ""} · weights cost {row.weights?.cost ?? "—"}, resilience {row.weights?.resilience ?? "—"}, climate {row.weights?.climate ?? "—"}</li>
        ))}
      </ul>
      <p className="text-sm">{total.error ?? (total.total === null ? "No single-currency total." : `Supplied total ${total.total} ${total.currency}. Missing: ${total.missing.join(", ") || "none"}.`)}</p>
    </div>
  );
}
