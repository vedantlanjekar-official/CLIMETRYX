import { openMeteoReady } from "@/lib/config/env";
import type { DailyWeather } from "@/lib/hazards/types";
import { fetchJson, kmhToMps, ProviderError } from "@/lib/ingestion/http";
import { cacheKey } from "@/lib/ingestion/freshness";
import type { AdapterHealth, Provenance } from "@/lib/integrations/types";
import {
  openMeteoForecastSchema,
  openMeteoGeocodingSchema,
  type OpenMeteoForecast,
} from "@/lib/integrations/open-meteo/schema";

const DAILY = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_gusts_10m_max",
  "wind_speed_10m_max",
  "relative_humidity_2m_mean",
  "apparent_temperature_max",
  "wet_bulb_temperature_2m_max",
  "et0_fao_evapotranspiration",
  "precipitation_hours",
  "cape_max",
].join(",");

const HOURLY = "soil_moisture_27_to_81cm";

const EXPECTED_DAILY_UNITS: Record<string, string> = {
  temperature_2m_max: "°C",
  precipitation_sum: "mm",
  wet_bulb_temperature_2m_max: "°C",
  et0_fao_evapotranspiration: "mm",
  precipitation_hours: "h",
  cape_max: "J/kg",
};

export interface NormalizedForecast {
  days: DailyWeather[];
  provenance: Provenance;
  timezone: string;
  elevationM: number | null;
  units: Record<string, string>;
  cacheKey: string;
  licenceMode: "non_commercial" | "commercial";
}

export function openMeteoHealth(): AdapterHealth {
  const ready = openMeteoReady();
  if ("error" in ready) {
    return { sourceId: "open-meteo", status: "needs_configuration", detail: ready.error, configured: false };
  }
  return {
    sourceId: "open-meteo",
    status: "implemented_unverified",
    detail: `Mode ${ready.mode} is configured. A live response is verified only after a successful call in this process.`,
    configured: true,
  };
}

export function endpoint(base: string, apiKey: string | null, mode: "non_commercial" | "commercial"): string {
  if (mode === "non_commercial") return base;
  const url = new URL(base);
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export async function fetchForecast(input: {
  latitude: number;
  longitude: number;
  days: number;
  now?: Date;
}): Promise<NormalizedForecast> {
  const ready = openMeteoReady();
  if ("error" in ready) throw new ProviderError(ready.error, "configuration");
  if (input.days < 1 || input.days > 16) {
    throw new ProviderError("Forecast horizon must be 1–16 days.", "invalid");
  }
  const url = new URL(endpoint(ready.forecastBaseUrl, ready.apiKey, ready.mode));
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("daily", DAILY);
  url.searchParams.set("hourly", HOURLY);
  url.searchParams.set("current", "temperature_2m,precipitation,wind_speed_10m");
  url.searchParams.set("forecast_days", String(input.days));
  url.searchParams.set("timezone", "auto");
  const raw = await fetchJson(url.toString(), { timeoutMs: 12000, retries: 2 });
  const parsed = openMeteoForecastSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError("Open-Meteo forecast response did not match the expected schema.", "invalid");
  }
  return normalizeForecast(parsed.data, ready.mode, input, "forecast");
}

export async function fetchArchive(input: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  now?: Date;
}): Promise<NormalizedForecast> {
  const ready = openMeteoReady();
  if ("error" in ready) throw new ProviderError(ready.error, "configuration");
  const url = new URL(endpoint(ready.archiveBaseUrl, ready.apiKey, ready.mode));
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");
  const raw = await fetchJson(url.toString(), { timeoutMs: 20000, retries: 1 });
  const parsed = openMeteoForecastSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError("Open-Meteo archive response did not match the expected schema.", "invalid");
  }
  return normalizeForecast(parsed.data, ready.mode, { ...input, days: parsed.data.daily.time.length }, "archive");
}

export interface Era5DailySeries {
  records: Array<{ date: string; tmaxC: number | null; precipMm: number | null; gustMps: number | null }>;
  gridLatitude: number;
  gridLongitude: number;
  elevationM: number | null;
  retrievedAt: string;
  licenceMode: "non_commercial" | "commercial";
}

/** Daily ERA5 reanalysis (Open-Meteo Historical Weather API, models=era5) for climatology fitting. */
export async function fetchEra5Daily(input: { latitude: number; longitude: number; startDate: string; endDate: string }): Promise<Era5DailySeries> {
  const ready = openMeteoReady();
  if ("error" in ready) throw new ProviderError(ready.error, "configuration");
  const url = new URL(endpoint(ready.archiveBaseUrl, ready.apiKey, ready.mode));
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum,wind_gusts_10m_max");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("models", "era5");
  const raw = await fetchJson(url.toString(), { timeoutMs: 45000, retries: 1 });
  const parsed = openMeteoForecastSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError("Open-Meteo ERA5 response did not match the expected schema.", "invalid");
  const { daily, daily_units: units = {} } = parsed.data;
  if (units.temperature_2m_max && units.temperature_2m_max !== "°C") throw new ProviderError(`Unexpected temperature unit ${units.temperature_2m_max}.`, "invalid");
  if (units.precipitation_sum && units.precipitation_sum !== "mm") throw new ProviderError(`Unexpected precipitation unit ${units.precipitation_sum}.`, "invalid");
  if (units.wind_gusts_10m_max && units.wind_gusts_10m_max !== "m/s") throw new ProviderError(`Unexpected gust unit ${units.wind_gusts_10m_max}.`, "invalid");
  return {
    records: daily.time.map((date, index) => ({
      date,
      tmaxC: valueAt(daily.temperature_2m_max, index),
      precipMm: valueAt(daily.precipitation_sum, index),
      gustMps: valueAt(daily.wind_gusts_10m_max, index),
    })),
    gridLatitude: parsed.data.latitude,
    gridLongitude: parsed.data.longitude,
    elevationM: parsed.data.elevation ?? null,
    retrievedAt: new Date().toISOString(),
    licenceMode: ready.mode,
  };
}

export async function geocodePlace(name: string): Promise<
  Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
    matchQuality: "place_name_candidate";
  }>
> {
  const ready = openMeteoReady();
  if ("error" in ready) throw new ProviderError(ready.error, "configuration");
  const url = new URL(endpoint(ready.geocodingBaseUrl, ready.apiKey, ready.mode));
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const raw = await fetchJson(url.toString(), { timeoutMs: 10000, retries: 1 });
  const parsed = openMeteoGeocodingSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError("Geocoding response was invalid.", "invalid");
  return (parsed.data.results ?? []).map((result) => ({
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    country: result.country,
    admin1: result.admin1,
    timezone: result.timezone,
    matchQuality: "place_name_candidate" as const,
  }));
}

function valueAt(values: Array<number | null> | undefined, index: number): number | null {
  const value = values?.[index];
  return value === undefined ? null : value;
}

/** Mean of hourly values per local calendar date. A date needs at least 18 of 24 hours to get a value. */
export function dailyMeansFromHourly(time: string[], values: Array<number | null> | undefined): Map<string, number> {
  const buckets = new Map<string, number[]>();
  if (!values) return new Map();
  time.forEach((stamp, index) => {
    const value = values[index];
    if (value === null || value === undefined) return;
    const date = stamp.slice(0, 10);
    const bucket = buckets.get(date) ?? [];
    bucket.push(value);
    buckets.set(date, bucket);
  });
  const means = new Map<string, number>();
  for (const [date, bucket] of buckets) {
    if (bucket.length >= 18) means.set(date, Math.round((bucket.reduce((a, b) => a + b, 0) / bucket.length) * 1000) / 1000);
  }
  return means;
}

function normalizeForecast(
  data: OpenMeteoForecast,
  mode: "non_commercial" | "commercial",
  input: { latitude: number; longitude: number; days: number; now?: Date },
  kind: "forecast" | "archive",
): NormalizedForecast {
  const units = data.daily_units ?? {};
  for (const [variable, expected] of Object.entries(EXPECTED_DAILY_UNITS)) {
    if (units[variable] && units[variable] !== expected) {
      throw new ProviderError(`Unexpected unit ${units[variable]} for ${variable}.`, "invalid");
    }
  }
  const soilUnit = data.hourly_units?.soil_moisture_27_to_81cm;
  if (soilUnit && soilUnit !== "m³/m³" && soilUnit !== "m3/m3") {
    throw new ProviderError(`Unexpected soil moisture unit ${soilUnit}.`, "invalid");
  }
  const soilByDate = data.hourly ? dailyMeansFromHourly(data.hourly.time, data.hourly.soil_moisture_27_to_81cm) : new Map<string, number>();
  const gustUnit = units.wind_gusts_10m_max;
  const days: DailyWeather[] = data.daily.time.map((date, index) => {
    const gust = valueAt(data.daily.wind_gusts_10m_max, index);
    const speed = valueAt(data.daily.wind_speed_10m_max, index);
    const gustMps =
      gust === null ? null : gustUnit === "m/s" ? gust : gustUnit === "km/h" || !gustUnit ? kmhToMps(gust) : null;
    const speedMps = speed === null ? null : kmhToMps(speed);
    if (gust !== null && gustMps === null) {
      throw new ProviderError(`Unsupported wind unit ${gustUnit}.`, "invalid");
    }
    return {
      date,
      temperatureMaxC: valueAt(data.daily.temperature_2m_max, index),
      temperatureMinC: valueAt(data.daily.temperature_2m_min, index),
      precipitationMm: valueAt(data.daily.precipitation_sum, index),
      precipitationProbabilityPct: valueAt(data.daily.precipitation_probability_max, index),
      windGustMps: gustMps,
      windSpeedMps: speedMps,
      humidityMeanPct: valueAt(data.daily.relative_humidity_2m_mean, index),
      apparentTemperatureMaxC: valueAt(data.daily.apparent_temperature_max, index),
      wetBulbMaxC: valueAt(data.daily.wet_bulb_temperature_2m_max, index),
      et0Mm: valueAt(data.daily.et0_fao_evapotranspiration, index),
      precipitationHours: valueAt(data.daily.precipitation_hours, index),
      capeMaxJkg: valueAt(data.daily.cape_max, index),
      rootZoneSoilMoisture: soilByDate.get(date) ?? null,
    };
  });
  const now = input.now ?? new Date();
  return {
    days,
    timezone: data.timezone,
    elevationM: data.elevation ?? null,
    units,
    licenceMode: mode,
    cacheKey: cacheKey({
      kind,
      latitude: input.latitude,
      longitude: input.longitude,
      days: input.days,
      mode,
    }),
    provenance: {
      sourceId: kind === "forecast" ? "open-meteo-forecast" : "open-meteo-archive",
      retrievedAt: now.toISOString(),
      validFrom: days[0]?.date ?? null,
      validTo: days[days.length - 1]?.date ?? null,
      licence:
        mode === "non_commercial"
          ? "Open-Meteo free API, non-commercial use only. Data attribution CC BY 4.0 as stated by Open-Meteo. Confirm terms before any other use."
          : "Open-Meteo commercial plan. Confirm the contract for the selected endpoint.",
      attribution: "Weather data by Open-Meteo.com",
      spatialResolution: "Model grid selected by the provider. Not a measurement inside the building.",
      temporalResolution: kind === "forecast" ? "Daily forecast aggregates over the requested horizon." : "Daily reanalysis aggregates. Not a station observation.",
      transformationVersion: "open-meteo-normalize-1.1.0",
    },
  };
}

export function rainfallBaseline(days: DailyWeather[]): {
  recent30DayMm: number | null;
  baselineMean30DayMm: number | null;
  baselineYears: number;
  recentDryDays: number | null;
} {
  const usable = days.filter((day) => day.precipitationMm !== null);
  if (usable.length < 30) {
    return { recent30DayMm: null, baselineMean30DayMm: null, baselineYears: 0, recentDryDays: null };
  }
  const recent = usable.slice(-30);
  const recent30DayMm = recent.reduce((sum, day) => sum + (day.precipitationMm ?? 0), 0);
  const recentDryDays = recent.filter((day) => (day.precipitationMm ?? 0) === 0).length;
  const prior = usable.slice(0, -30);
  const windows: number[] = [];
  for (let index = 0; index + 30 <= prior.length; index += 365) {
    const slice = prior.slice(index, index + 30);
    if (slice.length === 30) windows.push(slice.reduce((sum, day) => sum + (day.precipitationMm ?? 0), 0));
  }
  if (windows.length < 5) {
    return { recent30DayMm, baselineMean30DayMm: null, baselineYears: windows.length, recentDryDays };
  }
  const baselineMean30DayMm = windows.reduce((sum, value) => sum + value, 0) / windows.length;
  return { recent30DayMm, baselineMean30DayMm, baselineYears: windows.length, recentDryDays };
}
