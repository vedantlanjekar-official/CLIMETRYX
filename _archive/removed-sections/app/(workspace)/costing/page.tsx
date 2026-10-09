import { sumSuppliedCosts, type CostLine } from "@/lib/financial/costs";
import { orgRows } from "@/lib/data/queries";

export default async function CostingPage() {
  const result = await orgRows<{ id: string; purchase_price: number | null; rent_amount: number | null; construction_cost: number | null; currency: string; source: string; estimate_date: string | null }>(
    "property_cost_assumptions",
    "id,purchase_price,rent_amount,construction_cost,currency,source,estimate_date",
  );
  const lines: CostLine[] = result.rows.flatMap((row) => [
    { label: "Purchase", currency: row.currency, amount: row.purchase_price, source: row.source, estimateDate: row.estimate_date },
    { label: "Rent", currency: row.currency, amount: row.rent_amount, source: row.source, estimateDate: row.estimate_date },
    { label: "Construction", currency: row.currency, amount: row.construction_cost, source: row.source, estimateDate: row.estimate_date },
  ]);
  const total = sumSuppliedCosts(lines);
  return (
    <div>
      <h1 className="text-4xl">Cost worksheet</h1>
      <p className="mt-2 max-w-2xl text-sm">A user quotation is not a market price. Blank fields are listed as missing and are not filled.</p>
      {result.message ? <p className="mt-3 text-sm">{result.message}</p> : null}
      <p className="mt-4 text-sm">{total.error ?? `Total of supplied lines: ${total.total ?? "none"} ${total.currency ?? ""}`}</p>
    </div>
  );
}
