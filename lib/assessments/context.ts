import type { FloodExposureContext } from "@/lib/integrations/world-bank-flood/sampler";
import type { RiverContext } from "@/lib/integrations/open-meteo/river";
import type { ProjectionContext } from "@/lib/integrations/open-meteo/climate";
import type { OfficialAlertContext } from "@/lib/integrations/official-alerts/sachet";
import type { PopulationExposureContext } from "@/lib/hazards/flood";
import { floodExposureSentence } from "@/lib/integrations/world-bank-flood/classes";

/** Regional context gathered for a site. None of it changes the business score. */
export interface SiteContext {
  floodExposure: FloodExposureContext | null;
  river: RiverContext | null;
  projections: ProjectionContext | null;
  alerts: OfficialAlertContext | null;
}

export const EMPTY_CONTEXT: SiteContext = { floodExposure: null, river: null, projections: null, alerts: null };

export function populationExposureFrom(context: SiteContext): PopulationExposureContext | null {
  const exposure = context.floodExposure;
  if (!exposure || exposure.status !== "available" || !exposure.summary) return null;
  return {
    source: `World Bank Global Flood Exposure (${exposure.file})`,
    summary: floodExposureSentence(exposure.summary, exposure.bufferMeters),
    resolution: exposure.provenance.spatialResolution,
  };
}

export const FLOOD_WARNING_PATTERN = /rain|flood|inundat|cloudburst|cyclone|storm surge|\bdam\b/i;
export const STORM_WARNING_PATTERN = /storm|wind|cyclone|squall|gust/i;
