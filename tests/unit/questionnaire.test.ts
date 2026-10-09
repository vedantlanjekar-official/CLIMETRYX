import { describe, expect, it } from "vitest";
import { runAssessment } from "@/lib/assessments/pipeline";
import { activeBranches, contextFor, evaluate, isSectionVisible } from "@/lib/questionnaire/engine";
import {
  buildAssessmentRequest,
  changedFields,
  dependencyToTri,
  materialChanges,
  measureToTri,
  mergeRestricted,
  sitesForAnalysis,
  splitRestricted,
  stableStringify,
  type EnvironmentInputs,
} from "@/lib/questionnaire/mapping";
import { nextReassessment } from "@/lib/questionnaire/persist";
import { GROUPS, QUESTION_ENTRIES, STEPS, stepById } from "@/lib/questionnaire/registry";
import type { AnswerValue, AssessmentAnswers, RepeatRow } from "@/lib/questionnaire/types";
import { checkUpload, sanitizeFilename } from "@/lib/questionnaire/uploads";
import { containsRestrictedIdentifier, financialPeriodIssue, sanitizeAnswers, validateAnswers } from "@/lib/questionnaire/validation";

const answers = (values: Record<string, AnswerValue> = {}, groups: Record<string, RepeatRow[]> = {}): AssessmentAnswers => ({ values, groups });
const site = (id: string, values: Record<string, AnswerValue>): RepeatRow => ({ id, values: { label: `Site ${id}`, site_type: "factory", site_status: "active", ...values } });
const NOW = new Date("2026-10-09T12:00:00Z");

describe("question definitions", () => {
  it("has 15 ordered steps with unique ids", () => {
    expect(STEPS).toHaveLength(15);
    expect(STEPS.map((step) => step.number)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(15);
  });

  it("gives every question a unique path, an order and a persistence target", () => {
    const paths = QUESTION_ENTRIES.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const entry of QUESTION_ENTRIES) {
      expect(entry.question.order, entry.path).toBeGreaterThan(0);
      expect(entry.question.persistence?.table, entry.path).toBeTruthy();
      expect(entry.question.persistence?.column, entry.path).toBeTruthy();
      expect(entry.question.dimensions.length, entry.path).toBeGreaterThan(0);
    }
  });

  it("gives choice questions options with unique values", () => {
    for (const entry of QUESTION_ENTRIES) {
      if (!["select", "radio", "combobox", "multiselect"].includes(entry.question.type)) continue;
      const values = entry.question.options?.map((option) => option.value) ?? [];
      expect(values.length, entry.path).toBeGreaterThan(0);
      expect(new Set(values).size, entry.path).toBe(values.length);
    }
  });

  it("never asks for identity documents, credentials or card data", () => {
    const forbidden = /aadhaar|password|passcode|\bcvv\b|\botp\b|card number|bank account|account number|net banking|login/i;
    for (const entry of QUESTION_ENTRIES) {
      expect(`${entry.question.key} ${entry.question.label}`, entry.path).not.toMatch(forbidden);
    }
  });

  it("marks every financial-step figure as restricted", () => {
    const financial = stepById("financials")!;
    for (const section of financial.sections) {
      for (const question of section.questions ?? []) {
        if (question.key === "fin.include") continue;
        expect(question.sensitivity, question.key).toBe("restricted_financial");
      }
    }
  });
});

describe("conditions and industry branches", () => {
  it("derives branches from the activity and from answers", () => {
    expect(activeBranches(answers({ "profile.activity": "food_processing" }))).toEqual(new Set(["manufacturing", "food_cold_chain", "water_intensive"]));
    const software = activeBranches(answers({ "profile.activity": "software_it", "ops.outdoor_work": "yes", "fin.include": "yes", "purpose.goals": ["new_site"] }));
    expect(software.has("outdoor_work")).toBe(true);
    expect(software.has("financial")).toBe(true);
    expect(software.has("new_site")).toBe(true);
    expect(software.has("water_intensive")).toBe(false);
  });

  it("shows the water section only for water-intensive operations", () => {
    const water = stepById("operations")!.sections.find((section) => section.key === "water")!;
    expect(isSectionVisible(water, contextFor(answers({ "profile.activity": "software_it" })))).toBe(false);
    expect(isSectionVisible(water, contextFor(answers({ "profile.activity": "laundry_dry_cleaning" })))).toBe(true);
    expect(isSectionVisible(water, contextFor(answers({ "profile.activity": "software_it", "ops.water_dependency": "critical" })))).toBe(true);
  });

  it("evaluates level, compound and row-relative conditions", () => {
    const levelA = contextFor(answers());
    const levelB = contextFor(answers({ "purpose.depth": "B" }));
    expect(evaluate({ level: "B" }, levelA)).toBe(false);
    expect(evaluate({ level: "B" }, levelB)).toBe(true);
    expect(evaluate({ all: [{ level: "B" }, { field: "x", equals: "y" }] }, levelB)).toBe(false);
    expect(evaluate({ any: [{ level: "B" }, { not: { field: "x", answered: true } }] }, levelA)).toBe(true);
    expect(evaluate({ field: ".nature", equals: "opex" }, { ...levelA, row: { nature: "opex" } })).toBe(true);
    expect(evaluate({ field: "monitor.hazards", includes: "heat" }, contextFor(answers({ "monitor.hazards": ["heat"] })))).toBe(true);
  });

  it("does not require hidden questions", () => {
    const issues = validateAnswers(answers({ "incidents.any": "no" }), "submit", NOW);
    expect(issues.some((issue) => issue.stepId === "incidents" && issue.groupKey === "incidents")).toBe(false);
  });
});

describe("validation", () => {
  it("flags required answers only on submit", () => {
    expect(validateAnswers(answers(), "draft", NOW)).toHaveLength(0);
    const submit = validateAnswers(answers(), "submit", NOW);
    expect(submit.some((issue) => issue.key === "profile.legal_name" && issue.message === "Required.")).toBe(true);
    expect(submit.some((issue) => issue.groupKey === "sites")).toBe(true);
  });

  it("rejects out-of-range and 0,0 coordinates", () => {
    const at = (lat: number, lon: number) => validateAnswers(answers({}, { sites: [site("a", { point_lat: lat, point_lon: lon, point_confirmation: "confirmed_pin" })] }), "draft", NOW);
    expect(at(0, 0).map((issue) => issue.message).join(" ")).toMatch(/0, 0/);
    expect(at(91, 10).map((issue) => issue.message).join(" ")).toMatch(/Latitude/);
    expect(at(10, 181).map((issue) => issue.message).join(" ")).toMatch(/Longitude/);
    expect(at(18.52, 73.86)).toHaveLength(0);
  });

  it("requires pin confirmation before submission", () => {
    const issues = validateAnswers(answers({}, { sites: [site("a", { point_lat: 18.52, point_lon: 73.86 })] }), "submit", NOW);
    expect(issues.some((issue) => issue.key === "point" && /Confirm the pin/.test(issue.message))).toBe(true);
  });

  it("requires exactly one primary site when there are several", () => {
    const two = answers({}, { sites: [site("a", { is_primary: true }), site("b", { is_primary: true })] });
    expect(validateAnswers(two, "submit", NOW).some((issue) => issue.key === "is_primary")).toBe(true);
  });

  it("checks financial reporting periods", () => {
    expect(financialPeriodIssue({ "fin.period": "monthly", "fin.period_start": "2026-09-01", "fin.period_end": "2026-09-30" })).toBeNull();
    expect(financialPeriodIssue({ "fin.period": "monthly", "fin.period_start": "2026-09-01", "fin.period_end": "2026-10-30" })).toMatch(/28–31/);
    expect(financialPeriodIssue({ "fin.period": "annual", "fin.period_start": "2025-04-01", "fin.period_end": "2026-03-31" })).toBeNull();
    expect(financialPeriodIssue({ "fin.period": "annual", "fin.period_start": "2026-04-01", "fin.period_end": "2026-03-31" })).toMatch(/after/);
  });

  it("caps supplier shares at 100% and requires prospect weights to total 100", () => {
    const suppliers = answers({ "suppliers.has_critical": "yes" }, { suppliers: [{ id: "s1", values: { spend_share: 70 } }, { id: "s2", values: { spend_share: 45 } }] });
    expect(validateAnswers(suppliers, "draft", NOW).some((issue) => issue.key === "spend_share" && /115%/.test(issue.message))).toBe(true);
    const prospects = answers({}, { prospects: [{ id: "p1", values: { weight_cost: 50, weight_resilience: 30, weight_climate: 10 } }] });
    expect(validateAnswers(prospects, "draft", NOW).some((issue) => /total 90/.test(issue.message))).toBe(true);
  });

  it("rejects future dates where the question forbids them", () => {
    const issues = validateAnswers(answers({ "incidents.any": "yes" }, { incidents: [{ id: "i1", values: { occurred_on: "2027-01-01" } }] }), "draft", NOW);
    expect(issues.some((issue) => /future/.test(issue.message))).toBe(true);
  });

  it("detects personal ID and card numbers in free text", () => {
    expect(containsRestrictedIdentifier("ID 1234 5678 9012")).toBe(true);
    expect(containsRestrictedIdentifier("card 4111 1111 1111 1111")).toBe(true);
    expect(containsRestrictedIdentifier("We employ 120 people across 3 sites")).toBe(false);
    expect(containsRestrictedIdentifier("GSTIN 27AAPFU0939F1ZV")).toBe(false);
    const issues = validateAnswers(answers({ "profile.activity_description": "Contact 1234-5678-9012" }), "draft", NOW);
    expect(issues.some((issue) => issue.key === "profile.activity_description")).toBe(true);
  });

  it("drops unknown keys and fields when sanitising", () => {
    const result = sanitizeAnswers({ values: { "profile.legal_name": "Acme", "hack.field": "x" }, groups: { sites: [{ id: "a", values: { label: "A", evil: 1 } }], unknown_group: [] } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.values).toEqual({ "profile.legal_name": "Acme" });
    expect(result.answers.groups.sites?.[0]?.values).toEqual({ label: "A" });
    expect(result.answers.groups.unknown_group).toBeUndefined();
    expect(sanitizeAnswers({ values: "nope" }).ok).toBe(false);
  });
});

describe("mapping and reproducibility", () => {
  it("maps dependency and measure answers without inventing values", () => {
    expect(dependencyToTri("critical")).toBe("yes");
    expect(dependencyToTri("low")).toBe("no");
    expect(dependencyToTri(undefined)).toBe("unknown");
    expect(measureToTri("implemented")).toBe("yes");
    expect(measureToTri("planned")).toBe("no");
    expect(measureToTri("not_applicable")).toBe("unknown");
  });

  it("serialises deterministically regardless of key order", () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: null } })).toBe(stableStringify({ a: { c: null, d: [2, 1] }, b: 1 }));
  });

  it("reports changed and material fields", () => {
    const before = answers({ "profile.legal_name": "Acme", "profile.trading_name": "A" }, { sites: [site("a", { point_lat: 18.5 })] });
    const after = answers({ "profile.legal_name": "Acme Ltd", "profile.trading_name": "A" }, { sites: [site("a", { point_lat: 18.6 }), site("b", {})] });
    const changed = changedFields(before, after);
    expect(changed).toContain("profile.legal_name");
    expect(changed).toContain("sites[]");
    expect(changed).toContain("sites[].point");
    expect(changed).not.toContain("profile.trading_name");
    expect(materialChanges(changed)).toContain("sites[]");
  });

  it("splits restricted financial answers and merges them back losslessly", () => {
    const full = answers({ "profile.legal_name": "Acme", "fin.include": "yes", "fin.revenue": 1000 }, { sites: [site("a", {})] });
    const { general, restricted } = splitRestricted(full);
    expect(general.values["fin.revenue"]).toBeUndefined();
    expect(restricted.values["fin.revenue"]).toBe(1000);
    expect(stableStringify(mergeRestricted(general, restricted))).toBe(stableStringify(full));
  });

  it("orders the primary site first and skips closed or unpositioned sites", () => {
    const sites = sitesForAnalysis(
      answers({}, {
        sites: [
          site("a", { point_lat: 19, point_lon: 73, point_confirmation: "confirmed_pin" }),
          site("b", { point_lat: 18.5, point_lon: 73.8, point_confirmation: "confirmed_pin", is_primary: true }),
          site("c", { point_lat: 17, point_lon: 74, site_status: "closed" }),
          site("d", {}),
        ],
      }),
    );
    expect(sites.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("skips sites with null-island or out-of-range coordinates", () => {
    const sites = sitesForAnalysis(
      answers({}, {
        sites: [
          site("zero", { point_lat: 0, point_lon: 0 }),
          site("north", { point_lat: 91, point_lon: 73 }),
          site("east", { point_lat: 18, point_lon: 181 }),
          site("ok", { point_lat: 18.52, point_lon: 73.86 }),
        ],
      }),
    );
    expect(sites.map((item) => item.id)).toEqual(["ok"]);
  });

  it("produces identical scores for identical inputs", () => {
    const input = answers(
      { "profile.legal_name": "Acme", "profile.activity": "food_processing", "ops.water_dependency": "high", "measures.backup_power": "implemented" },
      { sites: [site("a", { point_lat: 18.52, point_lon: 73.86, point_confirmation: "confirmed_pin" })] },
    );
    const environment: EnvironmentInputs = { forecastDays: null, forecastRetrievedAt: null, historical: null, climatology: null, satellite: null };
    const [primary] = sitesForAnalysis(input);
    const first = runAssessment(buildAssessmentRequest(input, primary!, environment));
    const second = runAssessment(buildAssessmentRequest(input, primary!, environment));
    expect(stableStringify(first.score)).toBe(stableStringify(second.score));
    expect(first.methodologyVersion).toBe("fin05-vulnerability-1.2.0");
  });
});

describe("uploads and scheduling", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it("accepts files whose contents match the extension", () => {
    expect(checkUpload({ name: "report.pdf", size: 100, type: "application/pdf", head: bytes(0x25, 0x50, 0x44, 0x46, 0x2d) }).ok).toBe(true);
    expect(checkUpload({ name: "bills.csv", size: 10, type: "text/csv", head: new TextEncoder().encode("month,kwh\n") }).ok).toBe(true);
  });

  it("rejects mismatched, oversized, empty and unsupported files", () => {
    expect(checkUpload({ name: "report.pdf", size: 100, type: "application/pdf", head: bytes(0x4d, 0x5a) }).ok).toBe(false);
    expect(checkUpload({ name: "photo.png", size: 100, type: "application/pdf", head: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) }).ok).toBe(false);
    expect(checkUpload({ name: "big.pdf", size: 11 * 1024 * 1024, type: "application/pdf", head: bytes(0x25, 0x50, 0x44, 0x46, 0x2d) }).ok).toBe(false);
    expect(checkUpload({ name: "empty.pdf", size: 0, type: "application/pdf", head: bytes() }).ok).toBe(false);
    expect(checkUpload({ name: "tool.exe", size: 100, type: "application/octet-stream", head: bytes(0x4d, 0x5a) }).ok).toBe(false);
  });

  it("sanitises filenames", () => {
    expect(sanitizeFilename("..\\..\\etc/pass wd?.pdf")).toBe("pass-wd.pdf");
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("schedules reassessment from the chosen frequency", () => {
    const from = new Date("2026-10-09T00:00:00Z");
    expect(nextReassessment("quarterly", from)).toBe("2027-01-09");
    expect(nextReassessment("annual", from)).toBe("2027-10-09");
    expect(nextReassessment("on_change", from)).toBeNull();
  });

  it("keeps group definitions consistent with their rows", () => {
    for (const [key, entry] of GROUPS) {
      expect(entry.group.key).toBe(key);
      expect(entry.group.maxItems).toBeGreaterThanOrEqual(entry.group.minItems);
    }
  });
});
