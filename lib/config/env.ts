/**
 * Runtime configuration. Nothing here is required at build time.
 * Secret values are never returned to callers.
 */

export type OpenMeteoMode = "non_commercial" | "commercial";

export type ConfigFlag = {
  configured: boolean;
  detail: string;
};

export type PublicConfigStatus = {
  appUrl: string;
  supabase: ConfigFlag;
  openMeteo: ConfigFlag & { mode: OpenMeteoMode | "unset" | "invalid" };
  mapStyle: ConfigFlag;
  copernicus: ConfigFlag;
  cds: ConfigFlag;
  nasaEarthdata: ConfigFlag;
  cron: ConfigFlag;
  serviceRole: ConfigFlag;
};

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export function supabasePublicConfig():
  | { url: string; publishableKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function supabaseSecretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key || null;
}

export function openMeteoMode(): OpenMeteoMode | "unset" | "invalid" {
  const raw = process.env.OPEN_METEO_MODE?.trim();
  if (!raw) return "unset";
  if (raw === "non_commercial" || raw === "commercial") return raw;
  return "invalid";
}

export function openMeteoReady():
  | {
      mode: OpenMeteoMode;
      forecastBaseUrl: string;
      archiveBaseUrl: string;
      geocodingBaseUrl: string;
      floodBaseUrl: string;
      climateBaseUrl: string;
      apiKey: string | null;
    }
  | { error: string } {
  const mode = openMeteoMode();
  if (mode === "unset") {
    return {
      error:
        "OPEN_METEO_MODE is unset. Set non_commercial or commercial before any Open-Meteo request. The free API is restricted to non-commercial use.",
    };
  }
  if (mode === "invalid") {
    return { error: "OPEN_METEO_MODE must be non_commercial or commercial." };
  }
  const apiKey = process.env.OPEN_METEO_CUSTOMER_API_KEY?.trim() || null;
  const forecastBaseUrl =
    process.env.OPEN_METEO_FORECAST_BASE_URL?.trim() ||
    "https://api.open-meteo.com/v1/forecast";
  const archiveBaseUrl =
    process.env.OPEN_METEO_ARCHIVE_BASE_URL?.trim() ||
    "https://archive-api.open-meteo.com/v1/archive";
  const geocodingBaseUrl =
    process.env.OPEN_METEO_GEOCODING_BASE_URL?.trim() ||
    "https://geocoding-api.open-meteo.com/v1/search";
  const floodBaseUrl =
    process.env.OPEN_METEO_FLOOD_BASE_URL?.trim() ||
    "https://flood-api.open-meteo.com/v1/flood";
  const climateBaseUrl =
    process.env.OPEN_METEO_CLIMATE_BASE_URL?.trim() ||
    "https://climate-api.open-meteo.com/v1/climate";
  if (mode === "commercial" && !apiKey) {
    return {
      error:
        "Commercial Open-Meteo mode requires OPEN_METEO_CUSTOMER_API_KEY and the customer endpoint for your plan.",
    };
  }
  return { mode, forecastBaseUrl, archiveBaseUrl, geocodingBaseUrl, floodBaseUrl, climateBaseUrl, apiKey };
}

export function mapStyleUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  return url || null;
}

export function publicConfigStatus(): PublicConfigStatus {
  const supabase = supabasePublicConfig();
  const meteo = openMeteoReady();
  const mode = openMeteoMode();
  return {
    appUrl: appUrl(),
    supabase: supabase
      ? { configured: true, detail: "Publishable URL and key are set." }
      : {
          configured: false,
          detail: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
        },
    openMeteo:
      "error" in meteo
        ? { configured: false, mode, detail: meteo.error }
        : {
            configured: true,
            mode: meteo.mode,
            detail:
              meteo.mode === "non_commercial"
                ? "Non-commercial mode is explicit. Do not use this mode for a commercial deployment."
                : "Commercial mode is explicit.",
          },
    mapStyle: mapStyleUrl()
      ? { configured: true, detail: "Basemap style URL is set." }
      : {
          configured: false,
          detail: "Set NEXT_PUBLIC_MAP_STYLE_URL after accepting the provider licence.",
        },
    copernicus: present(process.env.COPERNICUS_CLIENT_ID)
      ? {
          configured: true,
          detail: "A Copernicus client id is set. Token retrieval still has to succeed before imagery download.",
        }
      : {
          configured: false,
          detail: "Catalog search can be attempted without a token. Asset download needs Copernicus credentials.",
        },
    cds: present(process.env.CDSAPI_KEY)
      ? { configured: true, detail: "CDSAPI_KEY is set. Requests are still subject to CDS terms and queue limits." }
      : { configured: false, detail: "ERA5-Land programmatic access needs CDSAPI_KEY." },
    nasaEarthdata: present(process.env.NASA_EARTHDATA_USERNAME)
      ? { configured: true, detail: "An Earthdata username is set. IMERG retrieval is not verified until a product request succeeds." }
      : { configured: false, detail: "IMERG programmatic access needs Earthdata credentials." },
    cron: present(process.env.CRON_SECRET)
      ? { configured: true, detail: "CRON_SECRET is set." }
      : { configured: false, detail: "Scheduled job endpoint stays disabled until CRON_SECRET is set." },
    serviceRole: supabaseSecretKey()
      ? { configured: true, detail: "Server-only secret key is set. It is not exposed to the browser." }
      : { configured: false, detail: "SUPABASE_SECRET_KEY is unset. User-scoped access still works through RLS when the publishable key is set." },
  };
}
