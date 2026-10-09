import { afterEach, describe, expect, it, vi } from "vitest";
import { gatherEnvironment } from "@/lib/assessments/environment";
import { reportSources } from "@/lib/reports/model";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function allSourcesDown(failure: () => Promise<Response>) {
  vi.stubEnv("OPEN_METEO_MODE", "non_commercial");
  vi.stubGlobal("fetch", vi.fn(failure));
  return gatherEnvironment(18.5204, 73.8567);
}

describe("environment gathering when every data source is down", () => {
  for (const [label, failure] of [
    ["a network error", async () => { throw new TypeError("network down"); }],
    ["an HTTP 503", async () => new Response("unavailable", { status: 503 })],
  ] as const) {
    it(`resolves with every source marked missing after ${label}, never throwing`, async () => {
      const env = await allSourcesDown(failure);
      expect(env.forecastDays).toBeNull();
      expect(env.forecastRetrievedAt).toBeNull();
      expect(env.climatology).toBeNull();
      expect(env.historical).toBeNull();
      for (const item of [env.context.floodExposure, env.context.river, env.context.projections, env.context.alerts]) {
        expect(item === null || item.status === "unavailable").toBe(true);
      }
      expect(env.satellite?.status).not.toBe("available");
      expect(env.notes.length).toBeGreaterThan(0);
    }, 60_000);
  }

  it("never shows a retrieval time for a source that could not be read", async () => {
    const env = await allSourcesDown(async () => {
      throw new TypeError("network down");
    });
    const sources = reportSources(
      { forecastDays: null, forecastRetrievedAt: null, climatology: null } as unknown as Parameters<typeof reportSources>[0],
      { context: env.context, satellite: env.satellite } as unknown as Parameters<typeof reportSources>[1],
    );
    const failed = sources.filter((item) => item.name.endsWith("(not retrieved)"));
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((item) => item.retrievedAt === null)).toBe(true);
    expect(sources.some((item) => item.name === "Weather forecast")).toBe(false);
  }, 60_000);
});
