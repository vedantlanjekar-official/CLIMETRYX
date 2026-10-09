import { describe, expect, it } from "vitest";
import { currentSpi, fitClimatology, validateClimatology, type ClimatologySource, type DailyClimateRecord } from "@/lib/climatology/model";
import { fitGammaWithZeros, inverseNormalCdf, quantile, regularizedGammaP, standardizedIndex } from "@/lib/climatology/stats";
import { snapToGrid } from "@/lib/climatology/service";
import { assessDrought, spiBand } from "@/lib/hazards/drought";
import { assessFlood } from "@/lib/hazards/flood";
import { assessHeat } from "@/lib/hazards/heat";
import { assessStorm } from "@/lib/hazards/storm";
import type { DailyWeather } from "@/lib/hazards/types";

const source: ClimatologySource = {
  provider: "test",
  model: "synthetic",
  gridLatitude: 0,
  gridLongitude: 0,
  elevationM: null,
  retrievedAt: "2026-01-01T00:00:00.000Z",
  licence: "test",
  attribution: "test",
};

/** Deterministic synthetic series: seasonal temperature, rain every few days with a seasonal amplitude. */
function syntheticRecords(startYear: number, years: number): DailyClimateRecord[] {
  const records: DailyClimateRecord[] = [];
  const date = new Date(Date.UTC(startYear, 0, 1));
  let index = 0;
  while (date.getUTCFullYear() < startYear + years) {
    const doy = index % 365;
    const season = Math.sin((2 * Math.PI * doy) / 365);
    records.push({
      date: date.toISOString().slice(0, 10),
      tmaxC: 30 + 6 * season + ((index * 7919) % 17) / 4,
      precipMm: index % 3 === 0 ? Math.max(0, 8 + 10 * season + ((index * 104729) % 23)) : 0,
      gustMps: 8 + ((index * 31) % 11),
    });
    date.setUTCDate(date.getUTCDate() + 1);
    index += 1;
  }
  return records;
}

function day(overrides: Partial<DailyWeather>): DailyWeather {
  return {
    date: "2026-10-10",
    temperatureMaxC: null,
    temperatureMinC: null,
    precipitationMm: null,
    precipitationProbabilityPct: null,
    windGustMps: null,
    windSpeedMps: null,
    humidityMeanPct: null,
    apparentTemperatureMaxC: null,
    wetBulbMaxC: null,
    et0Mm: null,
    precipitationHours: null,
    capeMaxJkg: null,
    rootZoneSoilMoisture: null,
    ...overrides,
  };
}

describe("climatology statistics", () => {
  it("uses type-7 quantiles", () => {
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it("matches the exponential CDF for shape 1", () => {
    for (const x of [0.1, 1, 3, 8]) expect(regularizedGammaP(1, x)).toBeCloseTo(1 - Math.exp(-x), 10);
  });

  it("inverts the standard normal", () => {
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 8);
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 5);
    expect(inverseNormalCdf(0.02)).toBeCloseTo(-2.053749, 5);
  });

  it("recovers gamma parameters and maps the median to SPI near zero", () => {
    const n = 3000;
    const values = Array.from({ length: n }, (_, i) => -10 * Math.log(1 - (i + 0.5) / n));
    const fit = fitGammaWithZeros(values)!;
    expect(fit.alpha).toBeGreaterThan(0.9);
    expect(fit.alpha).toBeLessThan(1.1);
    expect(fit.beta).toBeGreaterThan(9);
    expect(fit.beta).toBeLessThan(11);
    expect(standardizedIndex(10 * Math.log(2), fit)).toBeCloseTo(0, 1);
  });

  it("handles a zero point mass", () => {
    const values = [...Array.from({ length: 20 }, () => 0), ...Array.from({ length: 80 }, (_, i) => i + 1)];
    const fit = fitGammaWithZeros(values)!;
    expect(fit.zeroFraction).toBeCloseTo(0.2, 5);
    expect(standardizedIndex(0, fit)).toBeLessThan(-0.8);
  });

  it("snaps coordinates to the 0.25° ERA5 grid", () => {
    expect(snapToGrid(18.52, 73.85)).toEqual({ latitude: 18.5, longitude: 73.75 });
  });
});

describe("climatology model", () => {
  const records = syntheticRecords(1991, 30);
  const model = fitClimatology(records, source);

  it("fits ordered thresholds and twelve monthly SPI fits per window", () => {
    expect(model.baseline.years).toBe(30);
    expect(model.heat.tmaxP95C!).toBeGreaterThan(model.heat.tmaxP90C!);
    expect(model.heat.tmaxP99C!).toBeGreaterThanOrEqual(model.heat.tmaxP95C!);
    expect(model.rain.wetDayP99Mm!).toBeGreaterThan(model.rain.wetDayP95Mm!);
    expect(model.spi["30"]).toHaveLength(12);
    expect(model.spi["90"]).toHaveLength(12);
  });

  it("refuses to fit fewer than ten years", () => {
    expect(() => fitClimatology(syntheticRecords(2000, 5), source)).toThrow(/ten years/);
  });

  it("returns a null SPI with a reason when the recent window has gaps", () => {
    const recent = syntheticRecords(2026, 1).slice(0, 60).map((record, index) => (index === 50 ? { ...record, precipMm: null } : record));
    const spi = currentSpi(model, recent, 30);
    expect(spi.value).toBeNull();
    expect(spi.reason).toMatch(/consecutive/);
  });

  it("evaluates SPI at the latest complete month-end, not a partial month", () => {
    const recent = syntheticRecords(2026, 1).slice(0, 95);
    const spi = currentSpi(model, recent, 30);
    expect(recent.at(-1)!.date).toBe("2026-04-05");
    expect(spi.endDate).toBe("2026-03-31");
    expect(spi.month).toBe(3);
    expect(spi.value).not.toBeNull();
  });

  it("validates out of time and stays calibrated on a stationary series", () => {
    const validation = validateClimatology(records, source, 2010);
    const heat = validation.checks.find((check) => check.key === "tmax_p95")!;
    expect(heat.ratio).toBeGreaterThan(0.5);
    expect(heat.ratio).toBeLessThan(1.5);
    expect(validation.trainPeriod.end).toBe("2010-12-31");
    expect(validation.testPeriod.start).toBe("2011-01-01");
  });
});

describe("hazards with local thresholds", () => {
  it("flags heat that is unusual locally even below the fixed threshold", () => {
    const days = [day({ temperatureMaxC: 31 }), day({ temperatureMaxC: 31.5 }), day({ temperatureMaxC: 25 }), day({ temperatureMaxC: 25 })];
    const fixedOnly = assessHeat(days, "general");
    const local = assessHeat(days, "general", { values: { tmaxP90C: 28, tmaxP95C: 30, tmaxP99C: 31.2 }, label: "test" });
    expect(fixedOnly.score).toBe(0);
    expect(local.score).toBe(75);
    expect(local.raw?.daysAboveLocalP95).toBe(2);
  });

  it("uses local rainfall percentiles for heavy-rain screening", () => {
    const days = [day({ precipitationMm: 30 }), day({ precipitationMm: 5 }), day({ precipitationMm: 5 })];
    const rain = { wetDayMm: 1, wetDayP95Mm: 15, wetDayP99Mm: 25, threeDayP99Mm: 60, annualMax1Day2yrMm: 35, annualMax1Day10yrMm: 55 };
    expect(assessFlood({ days, officialWarnings: [], populationExposure: null }).score).toBe(15);
    expect(assessFlood({ days, officialWarnings: [], populationExposure: null, local: { values: rain, label: "test" } }).score).toBe(60);
  });

  it("uses the local gust P99", () => {
    const gust = { p95Mps: 12, p99Mps: 15, annualMax2yrMps: 17, annualMax10yrMps: 19 };
    expect(assessStorm([day({ windGustMps: 16 })], false).score).toBe(15);
    expect(assessStorm([day({ windGustMps: 16 })], false, { values: gust, label: "test" }).score).toBe(70);
  });

  it("scores drought from the drier SPI window on the WMO scale", () => {
    const spi = (window: 30 | 90, value: number | null) => ({ window, value, totalMm: 10, normalMm: 40, endDate: "2026-10-03", month: 10 });
    const result = assessDrought({
      recent30DayMm: null,
      baselineMean30DayMm: null,
      baselineYears: 0,
      recentDryDays: null,
      waterStress: null,
      spi: { spi30: spi(30, -0.4), spi90: spi(90, -1.7), label: "test" },
    });
    expect(result.key).toBe("spi");
    expect(result.score).toBe(70);
    expect(spiBand(-2.3).label).toBe("extremely dry");
    expect(spiBand(0.2).score).toBe(15);
  });

  it("falls back to percent of normal when SPI is unavailable", () => {
    const spi = (window: 30 | 90) => ({ window, value: null, totalMm: null, normalMm: null, endDate: null, month: null, reason: "none" });
    const result = assessDrought({
      recent30DayMm: 10,
      baselineMean30DayMm: 40,
      baselineYears: 6,
      recentDryDays: 20,
      waterStress: null,
      spi: { spi30: spi(30), spi90: spi(90), label: "test" },
    });
    expect(result.key).toBe("rainfall_percent_of_normal");
  });
});
