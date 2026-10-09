import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClimatologyModel } from "@/lib/climatology/model";
import type { ClimatologyStore } from "@/lib/climatology/service";

export function supabaseClimatologyStore(supabase: SupabaseClient, organizationId: string): ClimatologyStore {
  return {
    async load(grid, version) {
      const { data } = await supabase
        .from("climatology_models")
        .select("model")
        .eq("organization_id", organizationId)
        .eq("grid_latitude", grid.latitude)
        .eq("grid_longitude", grid.longitude)
        .eq("version", version)
        .maybeSingle();
      return (data?.model as ClimatologyModel | undefined) ?? null;
    },
    async save(grid, model) {
      await supabase.from("climatology_models").upsert(
        {
          organization_id: organizationId,
          grid_latitude: grid.latitude,
          grid_longitude: grid.longitude,
          version: model.version,
          baseline_start: model.baseline.start,
          baseline_end: model.baseline.end,
          source_id: "open-meteo-era5-climatology",
          model,
          fitted_at: model.fittedAt,
        },
        { onConflict: "organization_id,grid_latitude,grid_longitude,version", ignoreDuplicates: true },
      );
    },
  };
}
