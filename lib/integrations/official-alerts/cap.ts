export interface CapAlert {
  identifier: string;
  sender: string;
  sent: string;
  event: string;
  severity: string;
  urgency: string;
  certainty: string;
  effective: string | null;
  onset: string | null;
  expires: string | null;
  headline: string;
  areaDesc: string;
  category: string;
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<(?:cap:)?${name}>([\\s\\S]*?)</(?:cap:)?${name}>`).exec(block);
  return match ? decode(match[1]!) : "";
}

export function parseRssIdentifiers(xml: string): string[] {
  const ids = new Set<string>();
  for (const match of xml.matchAll(/FetchXMLFile\?identifier=([A-Za-z0-9_-]+)/g)) ids.add(match[1]!);
  return [...ids];
}

/** Parses a CAP 1.2 alert, preferring the English info block. */
export function parseCapAlert(xml: string): CapAlert | null {
  const infos = [...xml.matchAll(/<(?:cap:)?info>([\s\S]*?)<\/(?:cap:)?info>/g)].map((match) => match[1]!);
  if (infos.length === 0) return null;
  const info = infos.find((block) => /^en/i.test(tag(block, "language"))) ?? infos[0]!;
  const header = xml.split(/<(?:cap:)?info>/)[0]!;
  return {
    identifier: tag(header, "identifier"),
    sender: tag(header, "sender"),
    sent: tag(header, "sent"),
    event: tag(info, "event"),
    severity: tag(info, "severity"),
    urgency: tag(info, "urgency"),
    certainty: tag(info, "certainty"),
    effective: tag(info, "effective") || null,
    onset: tag(info, "onset") || null,
    expires: tag(info, "expires") || null,
    headline: tag(info, "headline"),
    areaDesc: tag(info, "areaDesc"),
    category: tag(info, "category"),
  };
}

/** Polygons as [lon, lat] rings. CAP lists points as "lat,lon" separated by spaces. */
export function parsePolygons(xml: string): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  for (const match of xml.matchAll(/<(?:cap:)?polygon>([\s\S]*?)<\/(?:cap:)?polygon>/g)) {
    const ring = match[1]!
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map(Number))
      .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isFinite))
      .map(([lat, lon]) => [lon, lat] as [number, number]);
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

export function pointInRing(longitude: number, latitude: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isActive(alert: CapAlert, now: Date): boolean {
  if (!alert.expires) return true;
  const expires = Date.parse(alert.expires);
  return Number.isNaN(expires) || expires > now.getTime();
}
