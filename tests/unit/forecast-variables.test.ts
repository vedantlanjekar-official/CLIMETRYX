import { describe, expect, it } from "vitest";
import { assessDrought, forecastWaterBalance } from "@/lib/hazards/drought";
import { assessFlood } from "@/lib/hazards/flood";
import { assessHeat, WET_BULB_SCREENING_C } from "@/lib/hazards/heat";
import { assessStorm, CAPE_CONTEXT_SCORE } from "@/lib/hazards/storm";
import type { DailyWeather } from "@/lib/hazards/types";
import { dailyMeansFromHourly } from "@/lib/integrations/open-meteo/client";
import { openMeteoForecastSchema } from "@/lib/integrations/open-meteo/schema";

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

describe("open-meteo extended variables", () => {
  it("accepts the extended daily and hourly payload shape", () => {
    const parsed = openMeteoForecastSchema.safeParse({
      latitude: 18.5,
      longitude: 73.875,
      timezone: "Asia/Kolkata",
      daily: {
        time: ["2026-10-09"],
        wet_bulb_temperature_2m_max: [21.8],
        et0_fao_evapotranspiration: [5.24],
        precipitation_hours: [0],
        cape_max: [710],
      },
      daily_units: { wet_bulb_temperature_2m_max: "°C", et0_fao_evapotranspiration: "mm", cape_max: "J/kg" },
      hourly: { time: ["2026-10-09T00:00"], soil_moisture_27_to_81cm: [0.312] },
    });
    expect(parsed.success).toBe(true);
  });

  it("averages hourly soil moisture per local date and drops sparse days", () => {
    const time = [
      ...Array.from({ length: 24 }, (_, h) => `2026-10-09T${String(h).padStart(2, "0")}:00`),
      ...Array.from({ length: 24 }, (_, h) => `2026-10-10T${String(h).padStart(2, "0")}:00`),
    ];
    const values = [...Array.from({ length: 24 }, (_, h) => (h < 12 ? 0.3 : 0.32)), ...Array.from({ length: 24 }, (_, h) => (h < 10 ? 0.3 : null))];
    const means = dailyMeansFromHourly(time, values);
    expect(means.get("2026-10-09")).toBe(0.31);
    expect(means.has("2026-10-10")).toBe(false);
  });
});

describe("hazards with extended forecast variables", () => {
  it("raises heat from humid wet-bulb days that the air-temperature screen misses", () => {
    const days = [day({ temperatureMaxC: 34, wetBulbMaxC: WET_BULB_SCREENING_C + 0.5 }), day({ temperatureMaxC: 33, wetBulbMaxC: 27 })];
    const result = assessHeat(days, "general");
    expect(result.score).toBe(50);
    expect(result.raw?.daysAtWetBulbScreen).toBe(1);
    expect(result.limitations.join(" ")).toMatch(/not WBGT/);
  });

  it("keeps the air-temperature score when wet-bulb is missing", () => {
    expect(assessHeat([day({ temperatureMaxC: 40 })], "general").raw?.wetBulbMaxC).toBeNull();
  });

  it("lifts a quiet-wind storm score on strong instability but not past gust bands", () => {
    expect(assessStorm([day({ windGustMps: 8, capeMaxJkg: 3000 })], false).score).toBe(CAPE_CONTEXT_SCORE);
    expect(assessStorm([day({ windGustMps: 8, capeMaxJkg: 900 })], false).score).toBe(15);
    expect(assessStorm([day({ windGustMps: 22, capeMaxJkg: 3000 })], false).score).toBe(70);
  });

  it("reports rain probability and rain hours without changing the flood score", () => {
    const days = [day({ precipitationMm: 5, precipitationProbabilityPct: 90, precipitationHours: 14 }), day({ precipitationMm: 2 }), day({ precipitationMm: 1 })];
    const result = assessFlood({ days, officialWarnings: [], populationExposure: null });
    expect(result.score).toBe(15);
    expect(result.raw?.maxRainProbabilityPct).toBe(90);
    expect(result.summary).toMatch(/14 h/);
  });

  it("adds forecast water balance to drought as unscored context", () => {
    const balance = forecastWaterBalance([
      day({ precipitationMm: 2, et0Mm: 5, rootZoneSoilMoisture: 0.31 }),
      day({ precipitationMm: 0, et0Mm: 5.5, rootZoneSoilMoisture: 0.3 }),
      day({ precipitationMm: null, et0Mm: 6 }),
    ])!;
    expect(balance).toMatchObject({ days: 2, precipitationMm: 2, et0Mm: 10.5, balanceMm: -8.5, rootZoneSoilMoisture: 0.3 });
    const result = assessDrought({
      recent30DayMm: null,
      baselineMean30DayMm: null,
      baselineYears: 0,
      recentDryDays: null,
      waterStress: null,
      forecastBalance: balance,
    });
    expect(result.score).toBeNull();
    expect(result.raw?.waterBalanceUsedInScore).toBe(0);
    expect(result.summary).toMatch(/balance -8.5 mm/);
  });

  it("returns no balance when nothing usable was supplied", () => {
    expect(forecastWaterBalance([day({})])).toBeNull();
  });
});
