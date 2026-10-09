export interface CostLine {
  label: string;
  currency: string;
  amount: number | null;
  source: string;
  estimateDate: string | null;
}

export function sumSuppliedCosts(lines: CostLine[]): {
  currency: string | null;
  total: number | null;
  included: string[];
  missing: string[];
  error: string | null;
} {
  const present = lines.filter((line) => line.amount !== null);
  const missing = lines.filter((line) => line.amount === null).map((line) => line.label);
  const currencies = new Set(present.map((line) => line.currency));
  if (present.length === 0) {
    return { currency: null, total: null, included: [], missing, error: null };
  }
  if (currencies.size > 1) {
    return {
      currency: null,
      total: null,
      included: [],
      missing,
      error: "Amounts use more than one currency, so they are not added together.",
    };
  }
  const currency = present[0]?.currency ?? null;
  const total = present.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  return { currency, total, included: present.map((line) => line.label), missing, error: null };
}
