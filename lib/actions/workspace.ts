"use server";

import { geocodePlace } from "@/lib/integrations/open-meteo/client";
import { rateLimit } from "@/lib/security/rate-limit";

export async function geocodeAction(name: string): Promise<{ ok: boolean; message: string; results?: Awaited<ReturnType<typeof geocodePlace>> }> {
  const query = name.trim().slice(0, 120);
  if (query.length < 2) return { ok: false, message: "Enter at least two characters." };
  const limited = rateLimit(`geocode:${query.slice(0, 40)}`, 15, 10 * 60 * 1000);
  if (!limited.ok) return { ok: false, message: "Too many geocoding requests. Wait a few minutes." };
  try {
    const results = await geocodePlace(query);
    return { ok: true, message: results.length ? "Select a candidate, then confirm the pin." : "No candidates returned. Enter coordinates manually.", results };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Geocoding failed." };
  }
}
