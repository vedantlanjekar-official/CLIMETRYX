import { sampleFloodExposure } from "@/lib/integrations/world-bank-flood/sampler";
import { fetchRiverContext } from "@/lib/integrations/open-meteo/river";
import { fetchProjections } from "@/lib/integrations/open-meteo/climate";
import { observeSentinel2 } from "@/lib/integrations/planetary-computer/sentinel2";
import { officialAlertsAt } from "@/lib/integrations/official-alerts/sachet";

async function timed<T>(label: string, task: Promise<T>): Promise<T> {
  const start = Date.now();
  const value = await task;
  console.log(`\n== ${label} (${Date.now() - start} ms)`);
  return value;
}

async function main() {
  const [lat, lon] = process.argv.slice(2).map(Number) as [number, number];
  const [flood, river, projections, satellite, alerts] = await Promise.all([
    timed("flood exposure", sampleFloodExposure(lat, lon)),
    timed("river", fetchRiverContext(lat, lon)),
    timed("projections", fetchProjections(lat, lon)),
    timed("satellite", observeSentinel2(lat, lon)),
    timed("alerts", officialAlertsAt(lat, lon)),
  ]);
  console.log(JSON.stringify({ flood: { status: flood.status, file: flood.file, detail: flood.detail, summary: flood.summary } }, null, 1));
  console.log(JSON.stringify({ river: { status: river.status, detail: river.detail, statistics: river.statistics, firstDays: river.forecast.slice(0, 3) } }, null, 1));
  console.log(JSON.stringify({ projections: { status: projections.status, detail: projections.detail, metrics: projections.metrics } }, null, 1));
  console.log(JSON.stringify({ satellite: { status: satellite.status, reason: satellite.reason, latest: satellite.latest && { ...satellite.latest, tiles: undefined }, previousYear: satellite.previousYear && { ...satellite.previousYear, tiles: undefined } } }, null, 1));
  console.log(JSON.stringify({ alerts: { status: alerts.status, detail: alerts.detail, matched: alerts.matched } }, null, 1));
}

void main();
