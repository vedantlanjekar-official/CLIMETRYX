import { afterEach, describe, expect, it } from "vitest";
import { buildEvidencePack } from "@/lib/ai/evidence";
import { writeNarrative } from "@/lib/ai/narrative";
import { validateNarrative, type NarrativeBody } from "@/lib/ai/narrative-schema";
import { riversideSample } from "@/lib/demo/riverside";

const { request, result } = riversideSample();
const pack = buildEvidencePack(request, result, new Date("2026-10-09T08:00:00Z"));

const grounded = (): NarrativeBody => ({
  headline: `Vulnerability ${result.score.score} of 100`,
  summary: "Operations depend on power and the business has no backup supply.",
  drivers: [{ title: "Operational sensitivity", explanation: "Perishable stock and no backup power.", evidence: ["component.operational_sensitivity"] }],
  actions: [{ action: "Test a power cut.", rationale: "Perishable stock.", horizon: "30_days", evidence: ["action.1"] }],
  dataQuality: `Evidence completeness ${result.score.evidenceCompleteness}%.`,
  watchItems: [],
});

describe("evidence pack", () => {
  it("covers score, components, hazards, finance, actions and data quality", () => {
    const ids = pack.items.map((item) => item.id);
    expect(ids).toContain("score");
    expect(ids).toContain("component.hazard");
    expect(ids).toContain("hazard.flood");
    expect(ids).toContain("finance.runway");
    expect(ids).toContain("action.1");
    expect(ids).toContain("quality.coverage");
    expect(pack.items.find((item) => item.id === "score")!.text).toContain("not a probability of default");
  });
});

describe("narrative validation", () => {
  it("accepts a summary whose numbers and citations come from the evidence", () => {
    expect(validateNarrative(grounded(), pack)).toEqual([]);
  });

  it("rejects invented numbers", () => {
    const body = { ...grounded(), summary: "Losses could reach 4,750,000 next month." };
    expect(validateNarrative(body, pack).some((problem) => problem.includes("4750000"))).toBe(true);
  });

  it("rejects citations that are not in the evidence pack", () => {
    const body = grounded();
    body.drivers[0]!.evidence = ["made.up"];
    expect(validateNarrative(body, pack)).toContain("Unknown evidence id made.up.");
  });

  it("rejects lending and probability-of-default language", () => {
    for (const summary of ["The probability of default is low.", "We recommend you approve the loan.", "The site is safe from floods."]) {
      expect(validateNarrative({ ...grounded(), summary }, pack).length).toBeGreaterThan(0);
    }
  });
});

describe("narrative without AI credentials", () => {
  const saved = process.env.AI_GATEWAY_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = saved;
  });

  it("falls back to a rules summary that cites real evidence", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const narrative = await writeNarrative(pack, result);
    expect(narrative.generatedBy).toBe("rules");
    expect(narrative.fallbackReason).toContain("No AI Gateway credentials");
    const ids = new Set(pack.items.map((item) => item.id));
    for (const entry of [...narrative.drivers, ...narrative.actions]) for (const id of entry.evidence) expect(ids.has(id)).toBe(true);
  });
});
