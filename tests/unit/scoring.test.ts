import { describe, expect, it } from "vitest";
import { runAssessment } from "@/lib/assessments/pipeline";
import { riversideSample } from "@/lib/demo/riverside";
import { assessDrought } from "@/lib/hazards/drought";
import { assessFlood } from "@/lib/hazards/flood";
import { assessHeat } from "@/lib/hazards/heat";
import { sumSuppliedCosts } from "@/lib/financial/costs";
import { deriveFinancials, financialSensitivityScore, stressScenario } from "@/lib/financial/metrics";
import { explainScoreChange, scoreVulnerability } from "@/lib/scoring/engine";
import type { ScoreComponentInput } from "@/lib/scoring/types";
import { cacheKey, freshnessOf, FRESHNESS_POLICIES } from "@/lib/ingestion/freshness";
import { validateCoordinate } from "@/lib/geospatial/coordinates";
import { validateUpload } from "@/lib/security/uploads";
import { readFileSync } from "node:fs";

const base = (): ScoreComponentInput => ({
  id: "hazard",
  value: 80,
  evidenceKind: "forecast",
  source: "test",
  normalization: "test",
  notes: [],
});

describe("vulnerability score", () => {
  it("does not treat a missing hazard as zero", () => {
    const result = scoreVulnerability(
      [
        { ...base(), id: "hazard", value: null, evidenceKind: "missing" },
        { ...base(), id: "operational_sensitivity", value: 10, evidenceKind: "self_reported" },
      ],
      [{ id: "forecast", label: "Weather forecast", available: false, requiredForComplete: true }],
    );
    expect(result.status).not.toBe("complete");
    expect(result.components.find((component) => component.id === "hazard")?.included).toBe(false);
    expect(result.score).toBe(10);
    expect(result.limitations.join(" ")).toMatch(/not a low-risk finding/i);
  });

  it("returns no number when every component is missing", () => {
    const result = scoreVulnerability(
      [{ ...base(), value: null }],
      [],
    );
    expect(result.score).toBeNull();
    expect(result.status).toBe("incomplete");
  });

  it("explains a component change", () => {
    const first = scoreVulnerability([{ ...base(), value: 20 }], []);
    const second = scoreVulnerability([{ ...base(), value: 70 }], []);
    const change = explainScoreChange(first, second);
    expect(change.delta).toBeGreaterThan(0);
    expect(change.reasons.join(" ")).toMatch(/hazard/);
  });
});

describe("hazards", () => {
  it("does not call three dry days a drought", () => {
    const result = assessDrought({
      recent30DayMm: 0,
      baselineMean30DayMm: null,
      baselineYears: 0,
      recentDryDays: 3,
      waterStress: null,
    });
    expect(result.score).toBeNull();
    expect(result.summary).toMatch(/not interpreted as drought|not scored/i);
  });

  it("keeps population exposure out of the flood score", () => {
    const result = assessFlood({
      days: [],
      officialWarnings: [],
      populationExposure: {
        source: "World Bank",
        summary: "People are exposed in the modelled scenario.",
        resolution: "3 arcseconds",
      },
    });
    expect(result.score).toBeNull();
    expect(result.raw?.populationExposureUsedInScore).toBe(0);
  });

  it("scores heat only from supplied temperatures", () => {
    const result = assessHeat(
      [
        {
          date: "2026-10-09",
          temperatureMaxC: 40,
          temperatureMinC: 28,
          precipitationMm: 0,
          precipitationProbabilityPct: 0,
          windGustMps: 1,
          windSpeedMps: 1,
          humidityMeanPct: null,
          apparentTemperatureMaxC: null,
          wetBulbMaxC: null,
          et0Mm: null,
          precipitationHours: null,
          capeMaxJkg: null,
          rootZoneSoilMoisture: null,
        },
      ],
      "general",
    );
    expect(result.score).toBe(100);
    expect(result.limitations.join(" ")).toMatch(/not a physiological heat-stress/i);
  });
});

describe("finance", () => {
  it("does not invent runway when cash is missing", () => {
    const derived = deriveFinancials({
      currency: "INR",
      period: "monthly",
      revenue: 30000,
      fixedCosts: 10000,
      variableCosts: null,
      cashReserves: null,
      recoveryCost: null,
    });
    expect(derived.runwayDays).toBeNull();
    expect(financialSensitivityScore(derived.runwayDays)).toBeNull();
  });

  it("labels stress results as hypothetical", () => {
    const result = stressScenario(
      {
        currency: "INR",
        period: "monthly",
        revenue: 30000,
        fixedCosts: 15000,
        variableCosts: 5000,
        cashReserves: 2000,
        recoveryCost: 500,
      },
      { disruptionDays: 7, lostRevenueFraction: 1, continuingFixedFraction: 1, continuingVariableFraction: 0 },
    );
    expect(result.hypothetical).toBe(true);
    expect(result.revenueAtRisk).toBeCloseTo((30000 / 30) * 7, 5);
  });

  it("refuses to add mixed currencies", () => {
    const total = sumSuppliedCosts([
      { label: "Land", currency: "INR", amount: 10, source: "quote", estimateDate: null },
      { label: "Power", currency: "USD", amount: 10, source: "quote", estimateDate: null },
    ]);
    expect(total.total).toBeNull();
    expect(total.error).toMatch(/currency/i);
  });
});

describe("guards", () => {
  it("rejects the null island unless explicitly allowed", () => {
    expect(validateCoordinate(0, 0).ok).toBe(false);
    expect(validateCoordinate(0, 0, { allowNullIsland: true }).ok).toBe(true);
  });

  it("builds stable cache keys and freshness", () => {
    expect(cacheKey({ b: 1, a: 2 })).toBe("a=2|b=1");
    const now = new Date("2026-10-09T12:00:00Z");
    expect(freshnessOf("2026-10-09T11:00:00Z", now, FRESHNESS_POLICIES.forecast)).toBe("fresh");
    expect(freshnessOf(null, now, FRESHNESS_POLICIES.forecast)).toBe("unknown");
  });

  it("blocks executable uploads and path traversal", () => {
    expect(validateUpload({ filename: "notes.exe", contentType: "application/json", sizeBytes: 10 }).ok).toBe(false);
    expect(validateUpload({ filename: "data.csv", contentType: "text/csv", sizeBytes: 10, zipEntries: ["../secret.txt"] }).ok).toBe(false);
    expect(validateUpload({ filename: "data.csv", contentType: "text/csv", sizeBytes: 10 }).ok).toBe(true);
  });
});

describe("synthetic riverside case", () => {
  it("stays partial because drought and satellite evidence are absent", () => {
    const sample = riversideSample();
    expect(sample.synthetic).toBe(true);
    expect(sample.result.score.score).not.toBeNull();
    expect(sample.result.status).toBe("completed_with_limitations");
    expect(sample.result.satellite?.status).toBe("not_available");
    expect(sample.result.recommendations.some((item) => /loan/i.test(item.action))).toBe(true);
  });

  it("blocks an unconfirmed location", () => {
    const sample = riversideSample();
    const blocked = runAssessment({
      ...sample.request,
      location: { ...sample.request.location, userConfirmed: false, acceptedLowPrecision: false },
    });
    expect(blocked.status).toBe("failed");
    expect(blocked.score.score).toBeNull();
  });
});

describe("row level security migration", () => {
  const sql = readFileSync("supabase/migrations/20261009045332_fin05_initial.sql", "utf8");
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);

  it("enables RLS for every application table", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("does not authorize from user metadata", () => {
    expect(sql).not.toMatch(/auth\.jwt\(\).*user_metadata/);
    expect(sql).toContain("organization_members");
  });
});
