import { z } from "zod";

const numericOrNull = z.number().nullable();

export const openMeteoForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  timezone: z.string(),
  utc_offset_seconds: z.number().optional(),
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number().optional(),
      precipitation: z.number().optional(),
      wind_speed_10m: z.number().optional(),
    })
    .optional(),
  current_units: z.record(z.string(), z.string()).optional(),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(numericOrNull).optional(),
    temperature_2m_min: z.array(numericOrNull).optional(),
    precipitation_sum: z.array(numericOrNull).optional(),
    precipitation_probability_max: z.array(numericOrNull).optional(),
    wind_gusts_10m_max: z.array(numericOrNull).optional(),
    wind_speed_10m_max: z.array(numericOrNull).optional(),
    relative_humidity_2m_mean: z.array(numericOrNull).optional(),
    apparent_temperature_max: z.array(numericOrNull).optional(),
    wet_bulb_temperature_2m_max: z.array(numericOrNull).optional(),
    et0_fao_evapotranspiration: z.array(numericOrNull).optional(),
    precipitation_hours: z.array(numericOrNull).optional(),
    cape_max: z.array(numericOrNull).optional(),
  }),
  daily_units: z.record(z.string(), z.string()).optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      soil_moisture_27_to_81cm: z.array(numericOrNull).optional(),
    })
    .optional(),
  hourly_units: z.record(z.string(), z.string()).optional(),
});

export const openMeteoArchiveSchema = openMeteoForecastSchema;

export const openMeteoGeocodingSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
        feature_code: z.string().optional(),
      }),
    )
    .optional(),
});

export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;
