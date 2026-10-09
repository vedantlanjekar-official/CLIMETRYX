/**
 * Fit the FIN-05 location climatology from ERA5 (Open-Meteo Historical Weather API) and validate it out of time.
 *
 *   npm run train:climatology -- --lat 18.52 --lon 73.85 --name pune
 *
 * Requires OPEN_METEO_MODE in .env.local. Writes data/models/climatology/<name>.json.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fitClimatology, validateClimatology, currentSpi, type ClimatologySource } from "@/lib/climatology/model";
import { BASELINE_END, BASELINE_START, snapToGrid } from "@/lib/climatology/service";
import { fetchEra5Daily } from "@/lib/integrations/open-meteo/client";
import { ProviderError } from "@/lib/ingestion/http";

async function withRateLimitWait<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const limited = error instanceof ProviderError && error.status === 429;
      if (!limited || attempt >= 3) throw error;
      console.log("Open-Meteo per-minute limit reached. Waiting 65 seconds…");
      await new Promise((resolve) => setTimeout(resolve, 65_000));
    }
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const latitude = Number(argument("lat"));
  const longitude = Number(argument("lon"));
  const name = (argument("name") ?? `${latitude}_${longitude}`).replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("Pass --lat and --lon in decimal degrees.");
  }
  const grid = snapToGrid(latitude, longitude);
  console.log(`Fetching ERA5 daily ${BASELINE_START}..${BASELINE_END} for grid ${grid.latitude}, ${grid.longitude}`);
  const baseline = await withRateLimitWait(() => fetchEra5Daily({ ...grid, startDate: BASELINE_START, endDate: BASELINE_END }));
  const source: ClimatologySource = {
    provider: "Open-Meteo Historical Weather API",
    model: "ERA5 reanalysis (models=era5)",
    gridLatitude: baseline.gridLatitude,
    gridLongitude: baseline.gridLongitude,
    elevationM: baseline.elevationM,
    retrievedAt: baseline.retrievedAt,
    licence: `Open-Meteo ${baseline.licenceMode === "non_commercial" ? "free API, non-commercial use only" : "commercial plan"}. ERA5: Copernicus Climate Change Service.`,
    attribution: "Weather data by Open-Meteo.com; contains modified Copernicus Climate Change Service information (ERA5).",
  };
  const model = fitClimatology(baseline.records, source);
  const validation = validateClimatology(baseline.records, source, 2010);

  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 120);
  const recent = await withRateLimitWait(() =>
    fetchEra5Daily({ ...grid, startDate: start.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) }),
  );
  const spi = { spi30: currentSpi(model, recent.records, 30), spi90: currentSpi(model, recent.records, 90) };

  const directory = path.join(process.cwd(), "data", "models", "climatology");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${name}.json`);
  await writeFile(file, `${JSON.stringify({ requested: { latitude, longitude }, grid, model, validation, currentSpi: spi }, null, 2)}\n`);

  console.log(`\nBaseline: ${model.baseline.years} years, ${model.baseline.days} days, ${model.baseline.missingDays} missing.`);
  console.log(`Heat   P90/P95/P99 Tmax: ${model.heat.tmaxP90C} / ${model.heat.tmaxP95C} / ${model.heat.tmaxP99C} °C`);
  console.log(`Rain   wet-day P95/P99: ${model.rain.wetDayP95Mm} / ${model.rain.wetDayP99Mm} mm; 3-day P99 ${model.rain.threeDayP99Mm} mm; 2y/10y 1-day ${model.rain.annualMax1Day2yrMm} / ${model.rain.annualMax1Day10yrMm} mm`);
  console.log(`Gust   P95/P99: ${model.gust.p95Mps} / ${model.gust.p99Mps} m/s; 2y/10y ${model.gust.annualMax2yrMps} / ${model.gust.annualMax10yrMps} m/s`);
  console.log(`SPI fits: ${model.spi["30"].length} months (30-day), ${model.spi["90"].length} months (90-day)`);
  console.log(`Current SPI-30 ${spi.spi30.value} and SPI-90 ${spi.spi90.value} to ${spi.spi90.endDate}`);
  console.log(`\nOut-of-time validation: train ${validation.trainPeriod.start}..${validation.trainPeriod.end}, test ${validation.testPeriod.start}..${validation.testPeriod.end}`);
  for (const line of validation.interpretation) console.log(`  - ${line}`);
  console.log(`  - SPI-90 on test years: mean ${validation.spi90Test.mean}, sd ${validation.spi90Test.sd} (n=${validation.spi90Test.samples}); a well-fitted index is near 0 and 1.`);
  console.log(`\nWrote ${path.relative(process.cwd(), file)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
