import { z } from "zod";
import { fetchJson, ProviderError } from "@/lib/ingestion/http";
import type { AdapterHealth } from "@/lib/integrations/types";

const alertSchema = z.object({
  id: z.string(),
  event: z.string(),
  severity: z.string(),
  issuedAt: z.string(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  area: z.string(),
  authority: z.string(),
});

export function officialAlertsHealth(): AdapterHealth {
  const url = process.env.OFFICIAL_ALERTS_FEED_URL?.trim();
  return {
    sourceId: "official-alerts",
    status: url ? "implemented_unverified" : "needs_configuration",
    configured: Boolean(url),
    detail: url
      ? "A feed URL is set. Alerts are official only if that feed is the responsible authority. A weather forecast is never relabelled as a warning."
      : "No official meteorological or hydrological warning feed is configured.",
  };
}

export async function fetchOfficialAlerts(): Promise<z.infer<typeof alertSchema>[]> {
  const url = process.env.OFFICIAL_ALERTS_FEED_URL?.trim();
  if (!url) throw new ProviderError("Official alert feed is not configured.", "configuration");
  const raw = await fetchJson(url, { timeoutMs: 10000, retries: 1 });
  const parsed = z.array(alertSchema).safeParse(raw);
  if (!parsed.success) throw new ProviderError("Official alert feed did not match the expected JSON list.", "invalid");
  return parsed.data;
}
