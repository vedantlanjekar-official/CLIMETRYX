import { z } from "zod";
import { fetchJson, ProviderError } from "@/lib/ingestion/http";
import type { AdapterHealth, Provenance } from "@/lib/integrations/types";

const responseSchema = z.object({
  metadata: z
    .object({
      apiVersion: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
  data: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.number()))).optional(),
});

const COLLECTIONS = new Set(["cmip6-x0.25", "cru-x0.5", "era5-x0.25"]);
const TYPES = new Set(["climatology", "timeseries"]);
const PRODUCTS = new Set(["climatology", "anomaly", "timeseries"]);
const AGGREGATIONS = new Set(["annual", "monthly", "seasonal"]);
const SCENARIOS = new Set(["historical", "ssp126", "ssp245", "ssp370", "ssp585"]);

export interface CckpQuery {
  collection: string;
  type: string;
  variables: string[];
  product: string;
  aggregation: string;
  period: string;
  percentile: string;
  scenario: string;
  model: string;
  modelCalculation: string;
  statistic: string;
  geocode: string;
}

export function cckpHealth(): AdapterHealth {
  return {
    sourceId: "world-bank-cckp",
    status: "implemented_unverified",
    configured: true,
    detail:
      "The documented country climatology route can be requested. A successful response is still checked for time coverage before it is used. Projections stay separate from forecasts.",
  };
}

export function buildCckpUrl(query: CckpQuery): string {
  if (!COLLECTIONS.has(query.collection)) throw new ProviderError("Unsupported CCKP collection.", "invalid");
  if (!TYPES.has(query.type) || !PRODUCTS.has(query.product)) {
    throw new ProviderError("Unsupported CCKP type or product.", "invalid");
  }
  if (!AGGREGATIONS.has(query.aggregation) || !SCENARIOS.has(query.scenario)) {
    throw new ProviderError("Unsupported CCKP aggregation or scenario.", "invalid");
  }
  if (!/^[a-z0-9,-]+$/.test(query.variables.join(","))) {
    throw new ProviderError("Unsupported CCKP variable list.", "invalid");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(query.geocode)) throw new ProviderError("Invalid CCKP geocode.", "invalid");
  if (!/^[A-Za-z0-9-]+$/.test(query.period)) throw new ProviderError("Invalid CCKP period.", "invalid");
  const base = process.env.CCKP_API_BASE_URL?.trim() || "https://cckpapi.worldbank.org/cckp/v1";
  const path = [
    query.collection,
    query.type,
    query.variables.join(","),
    query.product,
    query.aggregation,
    query.period,
    query.percentile,
    query.scenario,
    query.model,
    query.modelCalculation,
    query.statistic,
  ].join("_");
  return `${base.replace(/\/$/, "")}/${path}/${query.geocode}?_format=json`;
}

export async function fetchCckp(query: CckpQuery, now = new Date()): Promise<{
  status: "partial" | "available";
  timeKeys: string[];
  variables: string[];
  provenance: Provenance;
  limitation: string;
}> {
  const url = buildCckpUrl(query);
  const raw = await fetchJson(url, { timeoutMs: 20000, retries: 1 });
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.metadata?.status !== "success" || !parsed.data.data) {
    throw new ProviderError("CCKP response was not a successful documented payload.", "invalid");
  }
  const firstVariable = parsed.data.data[query.variables[0] ?? ""];
  const place = firstVariable?.[query.geocode] ?? {};
  const timeKeys = Object.keys(place).sort();
  const [start, end] = query.period.split("-");
  const coversPeriod =
    timeKeys.length > 1 &&
    timeKeys.some((key) => key.startsWith(start ?? "")) &&
    timeKeys.some((key) => key.startsWith(end ?? ""));
  return {
    status: coversPeriod ? "available" : "partial",
    timeKeys,
    variables: Object.keys(parsed.data.data),
    limitation: coversPeriod
      ? "Projection or climatology values are long-term context, not a weather forecast."
      : `The response did not cover the requested period ${query.period}. Returned time keys: ${timeKeys.join(", ") || "none"}. The series is not filled in.`,
    provenance: {
      sourceId: "world-bank-cckp",
      retrievedAt: now.toISOString(),
      validFrom: timeKeys[0] ?? null,
      validTo: timeKeys[timeKeys.length - 1] ?? null,
      licence: "World Bank dataset terms. Attribute The World Bank and the named data source.",
      attribution: "The World Bank: Climate Change Knowledge Portal.",
      spatialResolution: "Spatially aggregated geography named by the geocode, not the business premises.",
      temporalResolution: query.aggregation,
      transformationVersion: "cckp-adapter-1.0.0",
    },
  };
}

export const DOCUMENTED_INDIA_HISTORICAL_QUERY: CckpQuery = {
  collection: "cmip6-x0.25",
  type: "climatology",
  variables: ["tas", "tasmin", "tasmax"],
  product: "climatology",
  aggregation: "annual",
  period: "1995-2014",
  percentile: "median",
  scenario: "historical",
  model: "ensemble",
  modelCalculation: "all",
  statistic: "mean",
  geocode: "IND",
};
