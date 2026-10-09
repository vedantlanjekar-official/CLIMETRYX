export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export interface FreshnessPolicy {
  freshMs: number;
  staleMs: number;
}

export const FRESHNESS_POLICIES = {
  forecast: { freshMs: 3 * 60 * 60 * 1000, staleMs: 12 * 60 * 60 * 1000 },
  historical: { freshMs: 7 * 24 * 60 * 60 * 1000, staleMs: 40 * 24 * 60 * 60 * 1000 },
  satelliteCatalog: { freshMs: 24 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 },
  staticHazard: { freshMs: 365 * 24 * 60 * 60 * 1000, staleMs: 5 * 365 * 24 * 60 * 60 * 1000 },
  projection: { freshMs: 365 * 24 * 60 * 60 * 1000, staleMs: 5 * 365 * 24 * 60 * 60 * 1000 },
} as const;

export function freshnessOf(
  retrievedAtIso: string | null | undefined,
  now: Date,
  policy: FreshnessPolicy,
): Freshness {
  if (!retrievedAtIso) return "unknown";
  const retrieved = new Date(retrievedAtIso);
  if (Number.isNaN(retrieved.getTime())) return "unknown";
  const age = now.getTime() - retrieved.getTime();
  if (age < 0) return "unknown";
  if (age <= policy.freshMs) return "fresh";
  if (age <= policy.staleMs) return "aging";
  return "stale";
}

export function cacheKey(parts: Record<string, string | number | boolean | null>): string {
  return Object.keys(parts)
    .sort()
    .map((key) => `${key}=${String(parts[key])}`)
    .join("|");
}
