/**
 * SYNTHETIC TEST DATA. "Demo Bakery, Cakes & Biscuits" is an invented Pune bakery MSME used only for the
 * end-to-end test of the onboarding form and report pipeline. No figure here describes a real business,
 * a real registration or a verified weather event. Identifiers (GSTIN, PAN, Udyam, FSSAI) are deliberately left blank.
 */
import type { AnswerValue, AssessmentAnswers, RepeatRow } from "@/lib/questionnaire/types";

const row = (id: string, values: Record<string, AnswerValue>): RepeatRow => ({ id, values });

export const SITE_ID = "site-demo-bakery-pune";

/** Seasonal weights for an Indian bakery (Apr → Mar): festive peak Oct–Dec, monsoon dip Jun–Aug. They sum to 12. */
const WEIGHTS = [0.95, 0.9, 0.88, 0.85, 0.92, 0.98, 1.12, 1.15, 1.2, 1.02, 0.98, 1.05];

const FISCAL_YEARS = [
  { start: 2023, total: 5_500_000 },
  { start: 2024, total: 6_300_000 },
  { start: 2025, total: 7_200_000 },
];

/** 36 synthetic months whose fiscal-year sums equal the stated annual revenue exactly. */
export function revenueHistory(): Array<{ month: string; revenue: number }> {
  return FISCAL_YEARS.flatMap(({ start, total }) => {
    const months = WEIGHTS.map((weight, index) => {
      const calendar = ((index + 3) % 12) + 1;
      const year = calendar >= 4 ? start : start + 1;
      return { month: `${year}-${String(calendar).padStart(2, "0")}`, revenue: Math.round((total / 12) * weight) };
    });
    const drift = total - months.reduce((sum, item) => sum + item.revenue, 0);
    months[months.length - 1]!.revenue += drift;
    return months;
  });
}

const DESCRIPTION =
  "SYNTHETIC TEST PROFILE. Bread, cakes, cookies, biscuits, pastries and confectionery. Channels: retail counter 50%, wholesale to cafés and grocery stores 30%, online orders 12%, events and bulk orders 8%. Capacity 250 kg/day, normal output 180 kg/day (72% utilisation), about 300 operating days a year. Water about 25,000 L/month; electricity about 3,200 kWh/month; ovens fuelled by LPG/electricity. Humidity-sensitive biscuit and ingredient storage.";

export function bakeryAnswers(): AssessmentAnswers {
  return {
    values: {
      "purpose.goals": ["understand_current_risk", "continuity_planning", "lender_review", "insurance_review", "supplier_review"],
      "purpose.depth": "B",
      "purpose.respondent_role": "consultant",
      "purpose.horizons": ["forecast_7d", "historical", "projection"],
      "purpose.notes": "SYNTHETIC DEMONSTRATION PROFILE created for end-to-end system testing. Not a real registered business; every figure is illustrative.",

      "profile.legal_name": "Demo Bakery, Cakes & Biscuits",
      "profile.trading_name": "Demo Bakery (synthetic test profile)",
      "profile.legal_form": "proprietorship",
      "profile.registration_country": "IN",
      "profile.activity": "bakery_confectionery",
      "profile.activity_description": DESCRIPTION,
      "profile.established_year": 2018,
      "profile.size_band": "micro",
      "profile.employee_band": "10-49",
      "profile.employee_count": 14,
      "profile.customer_types": ["households", "businesses"],
      "profile.operating_days": "6",
      "profile.shift_pattern": "two",
      "profile.seasonality": "moderate",
      "profile.peak_months": ["10", "11", "12"],

      "prospects.planning": "no",

      "ops.electricity_dependency": "high",
      "ops.water_dependency": "moderate",
      "ops.cooling_dependency": "high",
      "ops.telecom_dependency": "moderate",
      "ops.transport_dependency": "high",
      "ops.perishable_inventory": "yes",
      "ops.outdoor_work": "no",
      "ops.max_downtime_hours": 12,
      "ops.workforce_commute": "mixed",
      "ops.inventory_days": 7,
      "ops.critical_equipment": "Deck ovens, planetary mixers, proofer, refrigerators and chillers for dairy and cream, display chillers, packaging sealer (synthetic list). Backup refrigeration is limited.",
      "mfg.process_cooling": "yes",
      "mfg.continuous_process": "no",
      "mfg.raw_material_storage": "indoor",
      "cold.temperature_range": "chilled",
      "cold.backup_refrigeration": "no",
      "cold.temperature_logging": "no",

      "incidents.any": "yes",

      "hazard.flood.water_entry": "unknown",
      "hazard.flood.access_cut": "yes",
      "hazard.heat.cooling": "fans",
      "hazard.heat.sensitive_processes": "yes",
      "hazard.drought.effect": "minor",
      "hazard.drought.rainfall_dependent": "no",
      "hazard.storm.roof": "rcc",
      "hazard.storm.outdoor_assets": "no",
      "hazard.other.description": "SYNTHETIC. Humidity is a key sensitivity: biscuits, flour and sugar absorb moisture (loss of crispness, caking, packaging failure) and chillers condense in monsoon months. Roof type RCC is an assumption for the synthetic premises.",

      "utility.electricity.outages": "monthly",
      "utility.electricity.duration_hours": 2,
      "utility.electricity.backup": "partial",
      "utility.electricity.evidence": "recollection",
      "utility.electricity.backup_hours": 1,
      "utility.water.outages": "yearly",
      "utility.water.duration_hours": 6,
      "utility.water.backup": "partial",
      "utility.water.evidence": "recollection",
      "utility.telecom.outages": "yearly",
      "utility.telecom.duration_hours": 2,
      "utility.telecom.backup": "partial",
      "utility.telecom.evidence": "recollection",

      "suppliers.has_critical": "yes",

      "fin.include": "yes",
      "fin.currency": "INR",
      "fin.period": "monthly",
      "fin.basis": "estimate",
      "fin.revenue": 600_000,
      "fin.fixed_costs": 235_000,
      "fin.variable_costs": 305_000,
      "fin.gross_margin_band": "gt40",
      "fin.payroll": 95_000,
      "fin.rent": 40_000,
      "fin.utilities": 55_000,
      "fin.cash_reserves": 200_000,
      "fin.undrawn_credit": 250_000,
      "fin.debt_service": 28_000,
      "fin.insurance": "unknown",
      "fin.insurance_exclusions": "Unknown: no policy documents were provided for this synthetic profile.",

      "measures.drainage": "unknown",
      "measures.floodProtection": "not_in_place",
      "measures.inventoryProtection": "partial",
      "measures.cooling": "partial",
      "measures.backupPower": "partial",
      "measures.waterStorage": "implemented",
      "measures.emergencyProcedures": "partial",
      "measures.alternateSuppliers": "partial",
      "measures.bufferStock": "partial",
      "measures.backupSite": "not_in_place",
      "measures.workerSafety": "partial",
      "measures.insurance": "unknown",
      "measures.continuityPlan": "partial",

      "monitor.enabled": "yes",
      "monitor.hazards": ["heavy_rain", "heat"],
      "monitor.channels": ["in_app"],
      "monitor.responsible_role": "Owner (synthetic)",
      "monitor.heat_threshold_c": 38,
      "monitor.rain_threshold_mm": 64.5,
      "monitor.reassessment": "quarterly",

      "consent.data_use": true,
      "consent.external_processing": true,
      "consent.financial": true,
      "consent.accuracy": true,
      "consent.not_credit_decision": true,
    },
    groups: {
      sites: [
        row(SITE_ID, {
          label: "Demo Bakery production and retail unit, Pune (synthetic)",
          site_type: "processing",
          is_primary: true,
          city: "Pune",
          admin_area: "Maharashtra",
          country: "IN",
          site_status: "active",
          tenure: "leased",
          criticality: "critical",
          activity: "Mixing, baking, cooling, packaging, cold storage of dairy and cream, and a retail counter (synthetic).",
          lowest_level: "ground",
          staff_count: 14,
          opening_hours: "Production about 05:00–14:00; retail 07:00–22:00 (synthetic)",
        }),
      ],
      assets: [
        row("asset-ovens", { asset_type: "machinery", description: "Deck ovens and planetary mixers (synthetic)", site: SITE_ID, below_ground_floor: "no", temperature_sensitive: "no" }),
        row("asset-cold", { asset_type: "cold_storage", description: "Refrigerators, chillers and display coolers for dairy, cream and cakes (synthetic)", site: SITE_ID, below_ground_floor: "no", temperature_sensitive: "yes" }),
        row("asset-stock", { asset_type: "inventory", description: "Dry ingredients and packaging stock, about 7 days (synthetic)", site: SITE_ID, below_ground_floor: "no", temperature_sensitive: "yes" }),
      ],
      incidents: [
        row("inc-heat-2024", {
          hazard: "heat", site: SITE_ID, occurred_on: "2024-05-10", duration_hours: 288, impacts: ["stock_damage", "lost_sales"],
          estimated_loss: 40_000, loss_currency: "INR", insured_claim: "no", evidence_type: "none",
          description: "SYNTHETIC Demonstration Event A, not a verified event. Heat-associated disruption over 12 days in May 2024 (start date is a placeholder): production down about 8%, extra electricity ₹22,000, spoilage ₹18,000.",
        }),
        row("inc-rain-2025", {
          hazard: "storm", site: SITE_ID, occurred_on: "2025-07-15", duration_hours: 48, impacts: ["lost_sales", "late_deliveries"], recovery_days: 1,
          estimated_loss: 40_000, loss_currency: "INR", insured_claim: "no", evidence_type: "none",
          description: "SYNTHETIC Demonstration Event B, not a verified event. Heavy-rainfall disruption over 2 days in July 2025 (date is a placeholder): delayed deliveries and reduced customer visits, revenue loss ₹40,000.",
        }),
        row("inc-heat-2026", {
          hazard: "heat", site: SITE_ID, occurred_on: "2026-04-15", duration_hours: 216,
          estimated_loss: 15_000, loss_currency: "INR", insured_claim: "no", evidence_type: "none",
          description: "SYNTHETIC Demonstration Event C, not a verified event. High temperatures over 9 days in April 2026 (start date is a placeholder): refrigeration pressure and extra cooling cost ₹15,000.",
        }),
      ],
      suppliers: [
        row("sup-flour", { name: "Synthetic Supplier A (flour and grains)", product: "Wheat flour, maida, grains", criticality: "critical", spend_share: 30, single_source: "no", alternative: "yes", substitution_days: 3, buffer_days: 7, city: "Pune region (unverified)", country: "India", lead_time_days: 2, transport_mode: "road" }),
        row("sup-dairy", { name: "Synthetic Supplier B (dairy, butter, cream)", product: "Milk, butter, fresh cream", criticality: "critical", spend_share: 17.5, single_source: "no", alternative: "yes", substitution_days: 2, buffer_days: 2, city: "Pune region (unverified)", country: "India", lead_time_days: 1, transport_mode: "road", disruption_history: "SYNTHETIC: one-day replenishment delay during the July 2025 heavy rain." }),
        row("sup-sugar", { name: "Synthetic Supplier C (sugar, cocoa, chocolate)", product: "Sugar, cocoa, chocolate", criticality: "important", spend_share: 17.5, single_source: "no", alternative: "yes", substitution_days: 5, buffer_days: 10, city: "Pune region (unverified)", country: "India", lead_time_days: 3, transport_mode: "road" }),
        row("sup-pack", { name: "Synthetic Supplier D (packaging)", product: "Boxes, films, labels", criticality: "important", spend_share: 17.5, single_source: "yes", alternative: "no", substitution_days: 7, buffer_days: 14, city: "Pune region (unverified)", country: "India", lead_time_days: 5, transport_mode: "road" }),
        row("sup-fresh", { name: "Synthetic Supplier E (eggs, fillings, yeast)", product: "Eggs, fruit fillings, yeast", criticality: "important", spend_share: 17.5, single_source: "no", alternative: "yes", substitution_days: 2, buffer_days: 3, city: "Pune region (unverified)", country: "India", lead_time_days: 1, transport_mode: "road" }),
      ],
      measures_other: [
        row("mo-sealed", { name: "Sealed airtight containers for flour, sugar and finished biscuits (synthetic)", status: "partial", hazards: ["flood", "heat"], site: SITE_ID }),
        row("mo-fifo", { name: "FIFO stock rotation and daily wastage log (synthetic)", status: "implemented", hazards: ["heat"], site: SITE_ID }),
      ],
      revenue_history: revenueHistory().map((item, index) => row(`rev-${index}`, item)),
    },
  };
}
