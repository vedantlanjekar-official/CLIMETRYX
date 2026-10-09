import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { activeBranches } from "@/lib/questionnaire/engine";
import { sanitizeAnswers, validateAnswers } from "@/lib/questionnaire/validation";
import { bakeryAnswers, revenueHistory } from "./bakery-answers";

const answers = bakeryAnswers();
const clean = sanitizeAnswers(answers);
if (!clean.ok) throw new Error(clean.message);
const dropped = Object.keys(answers.values).filter((key) => !(key in clean.answers.values));
console.log("dropped by sanitizer:", dropped);
console.log("branches:", [...activeBranches(clean.answers)]);
console.log("draft issues:", validateAnswers(clean.answers, "draft"));
console.log("submit issues (no pin yet):", validateAnswers(clean.answers, "submit"));

const withPin = structuredClone(clean.answers);
Object.assign(withPin.groups.sites![0]!.values, { point_lat: 18.52, point_lon: 73.86, point_confirmation: "accepted_low_precision" });
console.log("submit issues (with pin):", validateAnswers(withPin, "submit"));

const history = revenueHistory();
for (const fy of ["2023", "2024", "2025"]) {
  const months = history.filter(({ month }) => {
    const [year, mm] = month.split("-").map(Number) as [number, number];
    return mm >= 4 ? year === Number(fy) : year === Number(fy) + 1;
  });
  console.log(`FY${fy}-${Number(fy) + 1 - 2000}:`, months.length, "months, total", months.reduce((sum, item) => sum + item.revenue, 0));
}

const out = join(tmpdir(), "bakery-backup.json");
writeFileSync(out, JSON.stringify({ answers: clean.answers, savedAt: new Date().toISOString(), revision: null, currentStep: "locations" }));
console.log("backup written:", out);
