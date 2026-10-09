import type { AdapterHealth } from "@/lib/integrations/types";

export const GLOBAL_FLOOD_DATABASE_PAPER = "https://www.nature.com/articles/s41597-021-00819-1";

export function globalFloodDatabaseHealth(): AdapterHealth {
  return {
    sourceId: "global-flood-database",
    status: "requires_license_check",
    configured: false,
    detail:
      "The 2021 scientific article is identified. A current download route, version, and redistribution licence were not verified, so no events are imported.",
  };
}
