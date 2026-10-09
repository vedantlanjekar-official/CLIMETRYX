import { fetchText } from "@/lib/ingestion/http";
import type { OfficialWarningInput } from "@/lib/hazards/flood";
import type { Provenance } from "@/lib/integrations/types";
import { isActive, parseCapAlert, parsePolygons, parseRssIdentifiers, pointInRing, type CapAlert } from "./cap";

const BASE = "https://sachet.ndma.gov.in/cap_public_website";
const RSS_URL = `${BASE}/rss/rss_india.xml`;
const FEED_CACHE_MS = 10 * 60_000;
const CONCURRENCY = 8;

interface ActiveAlert {
  alert: CapAlert;
  rings: Array<Array<[number, number]>> | null;
}

export interface OfficialAlertContext {
  status: "available" | "unavailable";
  coverage: string;
  alertsInFeed: number;
  activeAlerts: number;
  matched: OfficialWarningInput[];
  detail: string;
  provenance: Provenance;
}

let feed: { at: number; alerts: ActiveAlert[]; count: number } | null = null;
let inflight: Promise<{ alerts: ActiveAlert[]; count: number }> | null = null;
const capCache = new Map<string, CapAlert | null>();

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]!);
      }
    }),
  );
  return results;
}

async function loadFeed(now: Date): Promise<{ alerts: ActiveAlert[]; count: number }> {
  if (feed && Date.now() - feed.at < FEED_CACHE_MS) return feed;
  inflight ??= (async () => {
    const ids = parseRssIdentifiers(await fetchText(RSS_URL, { timeoutMs: 15000 }));
    const alerts = await mapLimit(ids, CONCURRENCY, async (id) => {
      if (!capCache.has(id)) {
        const xml = await fetchText(`${BASE}/FetchXMLFile?identifier=${id}`, { timeoutMs: 10000, retries: 1 }).catch(() => null);
        capCache.set(id, xml ? parseCapAlert(xml) : null);
      }
      const alert = capCache.get(id);
      return alert && isActive(alert, now) ? { id, alert } : null;
    });
    const active = alerts.filter((entry): entry is { id: string; alert: CapAlert } => entry !== null);
    const withPolygons = await mapLimit(active, CONCURRENCY, async ({ id, alert }) => {
      const xml = await fetchText(`${BASE}/FetchPolygonXMLFile?identifier=${id}`, { timeoutMs: 15000, retries: 1 }).catch(() => null);
      return { alert, rings: xml ? parsePolygons(xml) : null };
    });
    feed = { at: Date.now(), alerts: withPolygons, count: ids.length };
    return feed;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function officialAlertsAt(latitude: number, longitude: number, now = new Date()): Promise<OfficialAlertContext> {
  const provenance: Provenance = {
    sourceId: "sachet-ndma-cap",
    retrievedAt: now.toISOString(),
    validFrom: null,
    validTo: null,
    licence: "Public alerts published by NDMA (Government of India) through SACHET",
    attribution: "National Disaster Management Authority, SACHET Common Alerting Protocol feed",
    spatialResolution: "Alert polygons issued by IMD, CWC and State Disaster Management Authorities",
    temporalResolution: "Live feed, refreshed every 10 minutes here",
    transformationVersion: "sachet-cap-point-1.0.0",
  };
  const coverage = "India only. A point outside India will never match an alert.";
  try {
    const { alerts, count } = await loadFeed(now);
    const matched = alerts
      .filter(({ rings }) => rings?.some((ring) => pointInRing(longitude, latitude, ring)))
      .map(({ alert }) => ({
        event: alert.event,
        severity: alert.severity,
        source: alert.sender || "NDMA SACHET",
        issuedAt: alert.sent,
        validFrom: alert.effective ?? alert.onset,
        validTo: alert.expires,
        identifier: alert.identifier,
        headline: alert.headline,
        area: alert.areaDesc,
        urgency: alert.urgency,
        certainty: alert.certainty,
      }));
    const unmapped = alerts.filter(({ rings }) => !rings || rings.length === 0).length;
    return {
      status: "available",
      coverage,
      alertsInFeed: count,
      activeAlerts: alerts.length,
      matched,
      detail: `${alerts.length} active alerts checked against the pin${unmapped ? `; ${unmapped} had no polygon and could not be matched` : ""}. ${matched.length} cover this location.`,
      provenance,
    };
  } catch {
    return { status: "unavailable", coverage, alertsInFeed: 0, activeAlerts: 0, matched: [], detail: "The SACHET feed could not be read, so official alerts were not checked.", provenance };
  }
}
