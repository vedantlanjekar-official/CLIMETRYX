import { describe, expect, it } from "vitest";
import { summarizeFloodWindow, floodExposureSentence } from "@/lib/integrations/world-bank-flood/classes";
import { riverOutlook, riverStatistics } from "@/lib/integrations/open-meteo/river-stats";
import { ensembleChanges, periodMetrics } from "@/lib/integrations/open-meteo/projection-stats";
import { localCloudPercent, squareAround } from "@/lib/integrations/planetary-computer/geometry";
import { isActive, parseCapAlert, parsePolygons, parseRssIdentifiers, pointInRing } from "@/lib/integrations/official-alerts/cap";
import { runAssessment } from "@/lib/assessments/pipeline";
import { riversideSample } from "@/lib/demo/riverside";

describe("World Bank flood-exposure window", () => {
  // 3 cells, 6 bands. Cell 0: 10 people, no flooding. Cell 1: 30 people, high. Cell 2: unpopulated.
  const bands = [
    [10, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 30, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  it("counts each populated cell in exactly one class and reports shares", () => {
    const summary = summarizeFloodWindow(bands, 1);
    expect(summary.populatedCells).toBe(2);
    expect(summary.people).toBe(40);
    expect(summary.shares.none).toBe(25);
    expect(summary.shares.high).toBe(75);
    expect(summary.shareAtLeastModerate).toBe(75);
    expect(summary.pinClass).toBe("high");
  });

  it("gives an unpopulated pin no class instead of calling it safe", () => {
    const summary = summarizeFloodWindow(bands, 2);
    expect(summary.pinClass).toBeNull();
    expect(floodExposureSentence(summary, 500)).toContain("no exposure class");
  });

  it("ignores band 6, whose meaning is not confirmed", () => {
    const withBand6 = bands.map((band, index) => (index === 5 ? [99, 99, 99] : band));
    expect(summarizeFloodWindow(withBand6, 0).people).toBe(40);
  });
});

describe("GloFAS river statistics", () => {
  const times: string[] = [];
  const values: Array<number | null> = [];
  for (let year = 2000; year < 2020; year += 1) {
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(year, 0, 1 + day)).toISOString().slice(0, 10);
      times.push(date);
      values.push(day === 200 ? 100 + (year - 2000) * 10 : 5);
    }
  }

  it("uses annual maxima of complete years for empirical return levels", () => {
    const stats = riverStatistics(times, values)!;
    expect(stats.years).toBe(20);
    expect(stats.annualMaxMedianM3s).toBe(195);
    expect(stats.annualMax90thM3s).toBeCloseTo(271, 0);
    expect(stats.recordMaxM3s).toBe(290);
  });

  it("refuses to compute return levels from fewer than 15 complete years", () => {
    expect(riverStatistics(times.slice(0, 365 * 10), values.slice(0, 365 * 10))).toBeNull();
  });

  it("classifies a forecast peak against the historical levels", () => {
    const stats = riverStatistics(times, values)!;
    const day = (discharge: number) => [{ date: "2026-10-10", dischargeM3s: discharge, ensembleMaxM3s: discharge * 1.2 }];
    expect(riverOutlook(day(10), stats).level).toBe("below_typical_annual_peak");
    expect(riverOutlook(day(200), stats).level).toBe("above_typical_annual_peak");
    expect(riverOutlook(day(300), stats).level).toBe("above_10yr_level");
    expect(riverOutlook(day(300), null).level).toBe("unknown");
  });
});

describe("CMIP6 projection deltas", () => {
  const series = (from: number, to: number, tmax: number, rain: number) => {
    const times: string[] = [];
    const t: number[] = [];
    const p: number[] = [];
    for (let year = from; year <= to; year += 1) {
      for (let day = 0; day < 365; day += 1) {
        times.push(new Date(Date.UTC(year, 0, 1 + day)).toISOString().slice(0, 10));
        t.push(day < 30 ? tmax + 5 : tmax);
        p.push(day === 180 ? rain : 1);
      }
    }
    return { times, t, p };
  };

  it("computes per-model changes and reports agreement", () => {
    const models = [0, 1, 2].map((offset) => {
      const base = series(2000, 2014, 30 + offset, 70);
      const future = series(2036, 2050, 31 + offset, 80);
      return {
        baseline: periodMetrics(base.times, base.t, base.p, 2000, 2014)!,
        future: periodMetrics(future.times, future.t, future.p, 2036, 2050)!,
      };
    });
    const metrics = ensembleChanges(models);
    const tmax = metrics.find((metric) => metric.key === "meanTmaxC")!;
    expect(tmax.changeMedian).toBe(1);
    expect(tmax.modelsAgreeOnSign).toBe(3);
    expect(metrics.find((metric) => metric.key === "heavyRainDaysPerYear")!.changeMedian).toBe(0);
    expect(metrics.find((metric) => metric.key === "wettestDayMm")!.changeMedian).toBe(10);
  });

  it("returns null when a period is mostly missing", () => {
    const base = series(2000, 2004, 30, 70);
    expect(periodMetrics(base.times, base.t, base.p, 2000, 2014)).toBeNull();
  });
});

describe("Sentinel-2 helpers", () => {
  it("counts cloud, shadow, cirrus and no-data pixels as cloudy", () => {
    expect(localCloudPercent([73, 190, 2237], [2, 4, 5])).toBe(0);
    expect(localCloudPercent([50, 50], [4, 9])).toBe(50);
    expect(localCloudPercent([10, 90], [0, 5])).toBe(10);
    expect(localCloudPercent([], [])).toBe(100);
  });

  it("builds a closed square of the requested half-side", () => {
    const ring = squareAround(18.52, 73.85, 500).coordinates[0]!;
    expect(ring[0]).toEqual(ring[4]);
    expect((ring[2]![1]! - ring[0]![1]!) * 111_320).toBeCloseTo(1000, 0);
  });
});

describe("SACHET CAP parsing", () => {
  const cap = `<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
<cap:identifier>IN-1_9</cap:identifier><cap:sender>Uttarakhand-SDMA</cap:sender><cap:sent>2026-10-09T13:58:33+05:30</cap:sent>
<cap:info><cap:language>HI</cap:language><cap:event>Hindi block</cap:event><cap:severity>Minor</cap:severity><cap:headline>हिंदी</cap:headline></cap:info>
<cap:info><cap:language>en-IN</cap:language><cap:category>Met</cap:category><cap:event>Heavy Rain</cap:event><cap:urgency>Expected</cap:urgency><cap:severity>Severe</cap:severity><cap:certainty>Likely</cap:certainty>
<cap:effective>2026-10-09T13:47:00+05:30</cap:effective><cap:expires>2026-10-09T16:47:00+05:30</cap:expires><cap:headline>Heavy rain &amp; gusty winds likely</cap:headline>
<cap:area><cap:areaDesc>Almora,Nainital</cap:areaDesc></cap:area></cap:info></cap:alert>`;

  it("prefers the English info block and decodes entities", () => {
    const alert = parseCapAlert(cap)!;
    expect(alert.event).toBe("Heavy Rain");
    expect(alert.severity).toBe("Severe");
    expect(alert.headline).toBe("Heavy rain & gusty winds likely");
    expect(alert.sender).toBe("Uttarakhand-SDMA");
    expect(alert.areaDesc).toBe("Almora,Nainital");
  });

  it("treats an alert as active until it expires", () => {
    const alert = parseCapAlert(cap)!;
    expect(isActive(alert, new Date("2026-10-09T10:00:00Z"))).toBe(true);
    expect(isActive(alert, new Date("2026-10-09T12:00:00Z"))).toBe(false);
  });

  it("reads lat,lon polygons and tests point membership", () => {
    const rings = parsePolygons("<alert><polygon>29.0,79.0 29.0,80.0 30.0,80.0 30.0,79.0 29.0,79.0</polygon><polygon>bad</polygon></alert>");
    expect(rings).toHaveLength(1);
    expect(rings[0]![1]).toEqual([80, 29]);
    expect(pointInRing(79.5, 29.5, rings[0]!)).toBe(true);
    expect(pointInRing(78.5, 29.5, rings[0]!)).toBe(false);
  });

  it("extracts unique identifiers from the RSS feed", () => {
    const rss = "<item><link>https://x/FetchXMLFile?identifier=123</link></item><item><link>https://x/FetchXMLFile?identifier=123</link><link>https://x/FetchXMLFile?identifier=456</link></item>";
    expect(parseRssIdentifiers(rss)).toEqual(["123", "456"]);
  });
});

describe("official warnings in the pipeline", () => {
  const warning = (event: string) => ({ event, severity: "Moderate", source: "Test SDMA", issuedAt: "2026-10-09T08:00:00Z", validFrom: null, validTo: null });

  it("does not let a heat or lightning alert raise the flood score", () => {
    const { request } = riversideSample();
    const baseline = runAssessment(request).hazards.indicators.find((item) => item.hazard === "flood")!.score;
    const result = runAssessment({ ...request, officialWarnings: [warning("Thunderstorm with Lightning"), warning("Heat Wave")] });
    expect(result.hazards.indicators.find((item) => item.hazard === "flood")!.score).toBe(baseline);
  });

  it("uses a heavy-rain alert for flood and a wind alert for storm", () => {
    const { request } = riversideSample();
    const result = runAssessment({ ...request, officialWarnings: [warning("Heavy Rain"), warning("Squall / Gusty Wind")] });
    expect(result.hazards.indicators.find((item) => item.hazard === "flood")!.score).toBeGreaterThanOrEqual(85);
    expect(result.hazards.indicators.find((item) => item.hazard === "storm")!.source).toBe("configured official warning");
    const lightningOnly = runAssessment({ ...request, officialWarnings: [warning("Thunderstorm with Lightning")] });
    expect(lightningOnly.hazards.indicators.find((item) => item.hazard === "storm")!.source).toBe("configured official warning");
  });

  it("marks the satellite evidence slot present only for a real observation", () => {
    const { request } = riversideSample();
    const slot = (status: "available" | "not_available") =>
      runAssessment({ ...request, satellite: { ...request.satellite!, status } }).score.evidenceSlots.find((item) => item.id === "satellite")!.available;
    expect(slot("available")).toBe(true);
    expect(slot("not_available")).toBe(false);
  });
});
