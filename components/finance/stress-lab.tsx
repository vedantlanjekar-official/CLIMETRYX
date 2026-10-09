"use client";

import { useMemo, useState } from "react";
import { stressScenario } from "@/lib/financial/metrics";

export function StressLab() {
  const [revenue, setRevenue] = useState(100000);
  const [fixed, setFixed] = useState(40000);
  const [cash, setCash] = useState(20000);
  const [days, setDays] = useState<1 | 3 | 7 | 14>(7);
  const result = useMemo(
    () =>
      stressScenario(
        {
          currency: "INR",
          period: "monthly",
          revenue,
          fixedCosts: fixed,
          variableCosts: null,
          cashReserves: cash,
          recoveryCost: 0,
        },
        { disruptionDays: days, lostRevenueFraction: 1, continuingFixedFraction: 1, continuingVariableFraction: 0 },
      ),
    [revenue, fixed, cash, days],
  );
  return (
    <form className="grid max-w-xl gap-3 text-sm">
      <p>This calculator uses the numbers you type. It does not look up a bank, and the result is a hypothetical scenario.</p>
      <label>Monthly revenue <input className="ml-2 rounded border px-2 py-1" type="number" value={revenue} onChange={(event) => setRevenue(Number(event.target.value))} /></label>
      <label>Monthly fixed costs <input className="ml-2 rounded border px-2 py-1" type="number" value={fixed} onChange={(event) => setFixed(Number(event.target.value))} /></label>
      <label>Cash reserves <input className="ml-2 rounded border px-2 py-1" type="number" value={cash} onChange={(event) => setCash(Number(event.target.value))} /></label>
      <label>Disruption days
        <select className="ml-2 rounded border px-2 py-1" value={days} onChange={(event) => setDays(Number(event.target.value) as 1 | 3 | 7 | 14)}>
          {[1, 3, 7, 14].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <p>Revenue at risk: {result.revenueAtRisk?.toFixed(2) ?? "unavailable"}</p>
      <p>Cash after scenario: {result.cashAfterScenario?.toFixed(2) ?? "unavailable"}</p>
      <p>{result.formula}</p>
    </form>
  );
}
