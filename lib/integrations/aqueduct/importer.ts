import { z } from "zod";
import type { AdapterHealth } from "@/lib/integrations/types";

const rowSchema = z.object({
  geography: z.string().min(1),
  indicator: z.string().min(1),
  label: z.string().min(1),
  period: z.string().min(1),
  scenario: z.string().optional(),
});

export function aqueductHealth(): AdapterHealth {
  return {
    sourceId: "wri-aqueduct-4",
    status: "needs_download",
    configured: false,
    detail:
      "Aqueduct 4.0 is an authorized CSV or GeoPackage import. There is no invented API. Labels are regional water-risk context, not a live utility outage.",
  };
}

export function validateAqueductRows(rows: unknown[]): { accepted: number; rejected: number; errors: string[] } {
  const errors: string[] = [];
  let accepted = 0;
  rows.forEach((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push(`Row ${index + 1} does not match the expected geography, indicator, label, and period fields.`);
      return;
    }
    accepted += 1;
  });
  return { accepted, rejected: rows.length - accepted, errors };
}
