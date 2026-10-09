/**
 * Runs the full analysis for a point with live providers and the synthetic Riverside business answers.
 * Usage: npx tsx --env-file=.env.local scripts/run-report.ts <lat> <lon> [out.json]
 */
import { writeFileSync } from "node:fs";
import { gatherEnvironment } from "@/lib/assessments/environment";
import { runAssessment } from "@/lib/assessments/pipeline";
import { populationExposureFrom } from "@/lib/assessments/context";
import { riversideSample } from "@/lib/demo/riverside";
import { buildEvidencePack } from "@/lib/ai/evidence";
import { buildReportModel } from "@/lib/reports/model";

async function main() {
  const [lat, lon] = process.argv.slice(2, 4).map(Number) as [number, number];
  const out = process.argv[4];
  const started = Date.now();
  const environment = await gatherEnvironment(lat, lon);
  const base = riversideSample().request;
  const request = {
    ...base,
    location: { ...base.location, latitude: lat, longitude: lon, label: `Point ${lat}, ${lon}` },
    forecastDays: environment.forecastDays,
    forecastRetrievedAt: environment.forecastRetrievedAt,
    historical: environment.historical,
    climatology: environment.climatology,
    satellite: environment.satellite,
    officialWarnings: environment.context.alerts?.matched ?? [],
    populationExposure: populationExposureFrom(environment.context),
    context: environment.context,
  };
  const result = runAssessment(request);
  result.limitations.push(...environment.notes);
  const report = await buildReportModel(request, result);
  const pack = buildEvidencePack(request, result);
  console.log(`elapsed ${Date.now() - started} ms; notes: ${environment.notes.join(" | ") || "none"}`);
  console.log(`score ${result.score.score} (${result.score.band}); completeness ${result.score.evidenceCompleteness}%; status ${result.status}`);
  console.log(`evidence items: ${pack.items.length} (${pack.items.map((item) => item.id).join(", ")})`);
  console.log(`report JSON size: ${Math.round(JSON.stringify(report).length / 1024)} KB`);
  console.log(JSON.stringify(report.narrative, null, 1));
  if (out) writeFileSync(out, JSON.stringify(report));
}

void main();
