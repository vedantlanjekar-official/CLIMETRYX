import { beforeAll, describe, expect, it, vi } from "vitest";
import { CATALOGUE, CATEGORIES, CORE_REPORTS, REPORT_TYPES } from "@/lib/intelligence/catalogue";
import { financialBaseline, financialImpact, runScenario } from "@/lib/intelligence/financial";
import { matchHistory, monthlyClimate, pearson } from "@/lib/intelligence/history";
import { cleanHistory, normalizeBusiness } from "@/lib/intelligence/normalize";
import { composeReport, type NarrativeProvider } from "@/lib/intelligence/reports/compose";
import { TEMPLATES } from "@/lib/intelligence/reports/templates";
import { buildEvidence, FORBIDDEN_PHRASES, normalizeCitations, validateAiReport, type AiReportBody } from "@/lib/intelligence/reports/writer";
import { snapshotHash } from "@/lib/intelligence/snapshot";
import { SYNTHETIC_NOW, syntheticAnswers, syntheticPackage } from "../fixtures/synthetic-manufacturer";

beforeAll(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubEnv("OPENAI_API_KEY", "");
});

describe("catalogue", () => {
  it("has 10 core reports and 24 categories, and every entry points at a real category and core report", () => {
    expect(CORE_REPORTS).toHaveLength(10);
    expect(CATEGORIES).toHaveLength(24);
    const categoryIds = new Set(CATEGORIES.map((item) => item.id));
    for (const entry of CATALOGUE) {
      expect(categoryIds.has(entry.category), entry.name).toBe(true);
      if (entry.status.kind === "section") expect(REPORT_TYPES).toContain(entry.status.within);
      if (entry.status.kind === "unavailable") expect(entry.status.requires.length).toBeGreaterThan(10);
    }
    for (const category of CATEGORIES) expect(CATALOGUE.some((entry) => entry.category === category.id), category.title).toBe(true);
  });

  it("never offers PD, EAD or LGD as a produced report", () => {
    const credit = CATALOGUE.filter((entry) => /default|loss-given/i.test(entry.name));
    expect(credit.length).toBeGreaterThan(0);
    for (const entry of credit) expect(entry.status.kind).toBe("unavailable");
  });
});

describe("Engine A: normalisation", () => {
  it("drops future and malformed months and keeps the last value for duplicates", () => {
    const cleaned = cleanHistory(
      [
        { month: "2026-01", revenue: 100, costs: null },
        { month: "2026-01", revenue: 120, costs: null },
        { month: "2026-13", revenue: 1, costs: null },
        { month: "2027-01", revenue: 1, costs: null },
        { month: "2025-12", revenue: -5, costs: null },
      ],
      SYNTHETIC_NOW,
    );
    expect(cleaned).toEqual([{ month: "2026-01", revenue: 120, costs: null }]);
  });

  it("converts annual figures to monthly and records missing financial inputs as gaps", () => {
    const answers = syntheticAnswers();
    answers.values["fin.period"] = "annual";
    answers.values["fin.revenue"] = 24_000_000;
    delete answers.values["fin.cash_reserves"];
    const business = normalizeBusiness(answers, [], SYNTHETIC_NOW);
    expect(business.finance.monthly.revenue).toBe(2_000_000);
    expect(business.finance.cash).toBeNull();
    expect(business.gaps.some((gap) => gap.missing === "Cash reserves")).toBe(true);
    expect(business.sector).toBe("manufacturing");
  });

  it("does not use financial answers when the business chose not to share them", () => {
    const answers = syntheticAnswers();
    answers.values["fin.include"] = "no";
    const business = normalizeBusiness(answers, [], SYNTHETIC_NOW);
    expect(business.finance.monthly.revenue).toBeNull();
    expect(business.finance.cash).toBeNull();
  });
});

describe("Engine F: financial scenarios", () => {
  it("computes cash impact as margin lost plus recovery cost, without adding fixed costs again", () => {
    const business = normalizeBusiness(syntheticAnswers(), [], SYNTHETIC_NOW);
    const base = financialBaseline(business);
    expect(base.dailyRevenue).toBe(Math.round(2_300_000 / 30));
    const result = runScenario(
      { id: "t", label: "Test", hazard: "flood", description: "", days: 3, outputLoss: 1, withRecoveryCost: true, parameters: [] },
      base,
      business,
    );
    const revenueLost = (2_300_000 / 30) * 3;
    const avoided = (1_150_000 / 30) * 3;
    expect(result.revenueLost).toBe(Math.round(revenueLost));
    expect(result.cashImpact).toBe(Math.round(revenueLost - avoided + 350_000));
    expect(result.cashAfter).toBe(Math.round(1_400_000 - (revenueLost - avoided + 350_000)));
  });

  it("marks every scenario unavailable when finances were not shared, instead of showing zero", () => {
    const answers = syntheticAnswers();
    answers.values["fin.include"] = "no";
    const business = normalizeBusiness(answers, [], SYNTHETIC_NOW);
    const impact = financialImpact(business, []);
    expect(impact.scenarios.every((item) => !item.available && item.cashImpact === null)).toBe(true);
    expect(impact.worstScenarioId).toBeNull();
  });
});

describe("Engine D: revenue and weather history", () => {
  it("computes Pearson correlation and returns null for constant series", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });

  it("aggregates daily records into months and nulls out months with under 25 days", () => {
    const records = Array.from({ length: 30 }, (_, day) => ({ date: `2026-07-${String(day + 1).padStart(2, "0")}`, tmaxC: 36, precipMm: day === 0 ? 70 : 1 }));
    const [july] = monthlyClimate([...records, { date: "2026-08-01", tmaxC: 30, precipMm: 0 }]);
    expect(july).toMatchObject({ month: "2026-07", meanTmaxC: 36, precipMm: 99, hotDays: 30, heavyRainDays: 1 });
    expect(monthlyClimate([{ date: "2026-08-01", tmaxC: 30, precipMm: 0 }])[0]!.meanTmaxC).toBeNull();
  });

  it("refuses to compare when there are fewer than 12 months", () => {
    const short = Array.from({ length: 6 }, (_, index) => ({ month: `2026-0${index + 1}`, revenue: 100, costs: null }));
    expect(matchHistory(short, [], [], null).status).toBe("insufficient_history");
  });
});

describe("AI writer validation", () => {
  const evidence = [
    { id: "m.revenue", text: "Monthly revenue: 2300000 INR (reported)" },
    { id: "m.runway", text: "Cash runway: 54 days (derived)" },
  ];
  const body = (overrides: Partial<AiReportBody> = {}): AiReportBody => ({
    headline: "Cash runway of 54 days leaves limited room for a long stoppage.",
    executiveSummary: ["Monthly revenue is 2,300,000 INR."],
    keyFindings: [{ text: "Runway is 54 days.", evidence: ["m.runway"] }],
    sectionNarratives: [{ sectionId: "finance", text: "Runway is 54 days." }],
    recommendations: [{ priority: "high", horizon: "30_days", action: "Agree a fallback supplier.", rationale: "Runway is 54 days.", evidence: ["m.runway"] }],
    ...overrides,
  });

  it("accepts a draft whose numbers and citations are all grounded", () => {
    expect(validateAiReport(body(), evidence, ["finance"])).toEqual([]);
  });

  it("rejects invented numbers, unknown citations, unknown sections and forbidden phrasing", () => {
    const problems = validateAiReport(
      body({
        headline: "Revenue could fall by 37%, and the probability of default is low.",
        keyFindings: [{ text: "Industry average runway is 90 days.", evidence: ["m.unknown"] }],
        sectionNarratives: [{ sectionId: "made-up", text: "Heat caused the dip." }],
      }),
      evidence,
      ["finance"],
    );
    expect(problems).toContain("Unsupported number 37.");
    expect(problems.some((item) => item.includes("probability of default"))).toBe(true);
    expect(problems).toContain("Unknown evidence id m.unknown.");
    expect(problems).toContain("Unknown section made-up.");
    expect(problems.some((item) => item.includes('"Industry average"'))).toBe(true);
    expect(problems).toContain('Forbidden phrasing "caused" in: "Heat caused the dip.". Rewrite the sentence without it.');
  });

  it("resolves citations whose format was mangled but never invents a match", () => {
    const fixed = normalizeCitations(
      body({
        keyFindings: [{ text: "Runway is 54 days.", evidence: ["runway?", " m.revenue. ", "m.runway"] }],
        recommendations: [{ priority: "high", horizon: "now", action: "Review cash.", rationale: "Runway is 54 days.", evidence: ["unknown_id"] }],
      }),
      evidence,
    );
    expect(fixed.keyFindings[0]!.evidence).toEqual(["m.runway", "m.revenue"]);
    expect(fixed.recommendations[0]!.evidence).toEqual(["unknown_id"]);
    expect(validateAiReport(fixed, evidence, ["finance"])).toContain("Unknown evidence id unknown_id.");
  });

  it("does not offer the standard disclaimers to the writer as evidence", async () => {
    const { pkg } = await syntheticPackage();
    for (const type of ["msme_360", "climate_adjusted_financial_risk"] as const) {
      const evidence = buildEvidence(TEMPLATES[type](pkg));
      expect(evidence.length, type).toBeGreaterThan(0);
      for (const item of evidence) for (const pattern of FORBIDDEN_PHRASES) expect(item.text, `${type}/${item.id}`).not.toMatch(pattern);
    }
  });
});

describe("end-to-end: synthetic manufacturing MSME (synthetic data)", () => {
  it("builds a deterministic analytical snapshot", async () => {
    const first = await syntheticPackage();
    const second = await syntheticPackage();
    expect(first.hash).toBe(second.hash);
    expect(snapshotHash({ ...first.pkg, createdAt: "2030-01-01T00:00:00Z" })).toBe(first.hash);
    const refetched = first.pkg.sources.map((item) => (item.name === "Historical weather for revenue months" ? { ...item, retrievedAt: "2030-01-01T00:00:00Z" } : item));
    expect(refetched.some((item) => item.retrievedAt === "2030-01-01T00:00:00Z")).toBe(true);
    expect(snapshotHash({ ...first.pkg, sources: refetched })).toBe(first.hash);
    expect(first.pkg.business.name).toContain("synthetic");
    expect(first.pkg.history.status).toBe("analysed");
    expect(first.pkg.finance.scenarios.some((item) => item.available)).toBe(true);
    expect(first.pkg.risk.score).not.toBeNull();
  });

  it("generates all 10 core reports with rules narratives when AI is not configured", async () => {
    const { pkg, hash } = await syntheticPackage();
    for (const type of REPORT_TYPES) {
      const { document, usage } = await composeReport(type, pkg, hash, null, "OPENAI_API_KEY is not set on the server.", SYNTHETIC_NOW);
      expect(usage).toEqual([]);
      expect(document.generation.mode).toBe("rules");
      expect(document.generation.fallbackReason).toContain("OPENAI_API_KEY");
      expect(document.title, type).toBeTruthy();
      expect(document.headline.length, type).toBeGreaterThan(10);
      expect(document.executiveSummary.length, type).toBeGreaterThan(0);
      expect(document.sections.length, type).toBeGreaterThan(1);
      expect(document.disclaimer).toMatch(/not a probability of default/i);
      const text = JSON.stringify(document);
      expect(text, type).not.toMatch(/probability of default is|\bPD of\b|\bEAD of\b|\bLGD of\b/i);
      for (const section of document.sections) {
        for (const chart of section.charts) {
          expect(chart.title && chart.unit && chart.period && chart.source && chart.explanation, `${type}/${chart.id}`).toBeTruthy();
        }
      }
    }
  });

  it("marks reports as completed with limitations when the assessment is stale", async () => {
    const { pkg, hash } = await syntheticPackage({ stale: true });
    const { document } = await composeReport("msme_360", pkg, hash, null, null, SYNTHETIC_NOW);
    expect(document.status).toBe("completed_with_limitations");
  });

  it("lists missing inputs instead of estimating when finances are withheld", async () => {
    const { pkg, hash } = await syntheticPackage({ withClimate: false });
    const withheld = { ...pkg, business: { ...pkg.business, finance: { ...pkg.business.finance, shared: false } } };
    const { document } = await composeReport("revenue_at_risk", withheld, hash, null, null, SYNTHETIC_NOW);
    expect(document.status).toBe("completed_with_limitations");
    expect(document.limitations[0]).toMatch(/Inputs missing/);
  });

  it("accepts a grounded AI narrative but keeps every figure from the engines", async () => {
    const { pkg, hash } = await syntheticPackage();
    const draft = TEMPLATES.executive_one_page(pkg);
    const evidence = buildEvidence(draft);
    const first = evidence.find((item) => item.id.startsWith("m."))!;
    const provider: NarrativeProvider = {
      provider: "test",
      model: "test-model",
      generate: async () => ({
        body: {
          headline: "Synthetic MSME faces concentrated flood and supplier exposure.",
          executiveSummary: ["The analysis combines business answers with climate screens."],
          keyFindings: [{ text: "The key indicators are summarised in the metrics.", evidence: [first.id] }],
          sectionNarratives: [],
          recommendations: [{ priority: "high", horizon: "30_days", action: "Agree a fallback steel supplier.", rationale: "The critical supplier is single-source.", evidence: [first.id] }],
        },
        inputTokens: 1200,
        outputTokens: 300,
        latencyMs: 900,
      }),
    };
    const { document, usage } = await composeReport("executive_one_page", pkg, hash, provider, null, SYNTHETIC_NOW);
    expect(document.generation.mode).toBe("ai");
    expect(document.headline).toBe("Synthetic MSME faces concentrated flood and supplier exposure.");
    expect(document.keyMetrics).toEqual(draft.keyMetrics);
    expect(usage).toEqual([expect.objectContaining({ outcome: "accepted", inputTokens: 1200 })]);
  });

  it("falls back to rules after two ungrounded AI drafts, and on provider errors", async () => {
    const { pkg, hash } = await syntheticPackage();
    let calls = 0;
    const ungrounded: NarrativeProvider = {
      provider: "test",
      model: "test-model",
      generate: async () => {
        calls += 1;
        return { body: { headline: "Losses will reach 98765432 rupees.", executiveSummary: ["x"], keyFindings: [], sectionNarratives: [], recommendations: [] }, inputTokens: 10, outputTokens: 10, latencyMs: 5 };
      },
    };
    const rejected = await composeReport("stress_test", pkg, hash, ungrounded, null, SYNTHETIC_NOW);
    expect(calls).toBe(2);
    expect(rejected.document.generation.mode).toBe("rules");
    expect(rejected.document.generation.validationIssues.join(" ")).toContain("98765432");
    expect(rejected.document.headline).not.toContain("98765432");
    expect(rejected.usage.map((item) => item.outcome)).toEqual(["rejected_validation", "rejected_validation"]);

    const failing: NarrativeProvider = { provider: "test", model: "test-model", generate: async () => Promise.reject(new Error("timeout")) };
    const errored = await composeReport("stress_test", pkg, hash, failing, null, SYNTHETIC_NOW);
    expect(errored.document.generation.mode).toBe("rules");
    expect(errored.usage[0]!.outcome).toBe("error");
    expect(errored.document.sections).toEqual(rejected.document.sections);
  });
});
