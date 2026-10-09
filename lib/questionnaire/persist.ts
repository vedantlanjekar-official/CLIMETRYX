import type { SupabaseClient } from "@supabase/supabase-js";
import { missingData } from "@/lib/questionnaire/completeness";
import { geopointKeys } from "@/lib/questionnaire/engine";
import { findActivity } from "@/lib/questionnaire/industries";
import { dependencyToTri, measureToTri } from "@/lib/questionnaire/mapping";
import { MEASURE_CATALOGUE } from "@/lib/questionnaire/steps-risk";
import { CONSENT_VERSION, type AnswerValue, type AssessmentAnswers, type RepeatRow } from "@/lib/questionnaire/types";

const str = (value: AnswerValue | undefined): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: AnswerValue | undefined): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const list = (value: AnswerValue | undefined): string[] => (Array.isArray(value) ? value : []);
const triOrNull = (value: AnswerValue | undefined): string | null => (value === "yes" || value === "no" || value === "unknown" ? value : null);

export interface PersistContext {
  supabase: SupabaseClient;
  organizationId: string;
  businessId: string;
  inputVersionId: string;
  userId: string;
  answers: AssessmentAnswers;
  canWriteFinancials: boolean;
}

export interface PersistResult {
  locationIds: Record<string, string>;
  warnings: string[];
}

export function businessColumns(answers: AssessmentAnswers) {
  const values = answers.values;
  const activity = findActivity(values["profile.activity"]);
  const seasonality = str(values["profile.seasonality"]);
  const peaks = list(values["profile.peak_months"]);
  const days = str(values["profile.operating_days"]);
  const shift = str(values["profile.shift_pattern"]);
  const primary = (answers.groups.sites ?? []).find((row) => row.values.is_primary === true) ?? answers.groups.sites?.[0];
  return {
    name: str(values["profile.legal_name"]) ?? "Business",
    trading_name: str(values["profile.trading_name"]),
    legal_type: str(values["profile.legal_form"]),
    registration_country: str(values["profile.registration_country"]),
    registration_identifier: str(values["profile.registration_identifier"]),
    industry: activity?.label ?? "",
    sub_industry: activity?.value ?? null,
    products_services: str(values["profile.activity_description"]),
    established_year: num(values["profile.established_year"]),
    msme_size_band: str(values["profile.size_band"]),
    employee_band: str(values["profile.employee_band"]),
    employee_count: num(values["profile.employee_count"]),
    customer_types: list(values["profile.customer_types"]).join(", ") || null,
    operating_model: [days ? `${days} days per week` : null, shift ? `${shift} shift` : null].filter(Boolean).join(", ") || null,
    seasonality: seasonality ? `${seasonality}${peaks.length ? `; peak months ${peaks.join(", ")}` : ""}` : null,
    objectives: list(values["purpose.goals"]).join(", ") || null,
    country: str(primary?.values.country),
    admin_area: str(primary?.values.admin_area),
    city: str(primary?.values.city),
  };
}

function inList(ids: string[]): string {
  return `(${ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;
}

async function softRemoveMissing(ctx: PersistContext, table: string, keepIds: string[], warnings: string[]) {
  let query = ctx.supabase.from(table).update({ removed_at: new Date().toISOString() }).eq("business_id", ctx.businessId).is("removed_at", null);
  if (keepIds.length) query = query.not("client_row_id", "in", inList(keepIds));
  const { error } = await query;
  if (error) warnings.push(`${table}: earlier rows could not be marked as removed (${error.message}).`);
}

function rowsOf(answers: AssessmentAnswers, key: string): RepeatRow[] {
  return answers.groups[key] ?? [];
}

export async function persistAnswers(ctx: PersistContext): Promise<PersistResult> {
  const { supabase, organizationId, businessId, inputVersionId, answers } = ctx;
  const values = answers.values;
  const warnings: string[] = [];
  const base = { organization_id: organizationId, business_id: businessId };
  const point = geopointKeys("point");

  // Locations ---------------------------------------------------------------
  const sites = rowsOf(answers, "sites");
  const locationIds: Record<string, string> = {};
  if (sites.length) {
    const { data, error } = await supabase
      .from("business_locations")
      .upsert(
        sites.map((row) => ({
          ...base,
          client_row_id: row.id,
          removed_at: null,
          label: str(row.values.label) ?? "Site",
          site_type: str(row.values.site_type) ?? "other",
          is_primary: row.values.is_primary === true || sites.length === 1,
          address_line: str(row.values.address_line),
          city: str(row.values.city),
          admin_area: str(row.values.admin_area),
          postal_code: str(row.values.postal_code),
          country: str(row.values.country),
          latitude: num(row.values[point.lat]),
          longitude: num(row.values[point.lon]),
          geocoder_name: str(row.values[point.source]),
          match_quality: str(row.values[point.match]) ?? (row.values[point.confirmation] === "confirmed_pin" ? "user_confirmed_point" : "low_precision_accepted"),
          geocoded_at: str(row.values[point.source]) ? new Date().toISOString() : null,
          user_confirmed: row.values[point.confirmation] === "confirmed_pin",
          accepted_low_precision: row.values[point.confirmation] === "accepted_low_precision",
          site_status: str(row.values.site_status) ?? "active",
          tenure: str(row.values.tenure),
          criticality: str(row.values.criticality),
          activity: str(row.values.activity),
          lowest_occupied_level: str(row.values.lowest_level),
          building_area: num(row.values.building_area),
          land_area: num(row.values.land_area),
          land_area_unit: num(row.values.land_area) === null ? null : "m2",
          staff_count: num(row.values.staff_count),
          opening_hours: str(row.values.opening_hours),
        })),
        { onConflict: "business_id,client_row_id" },
      )
      .select("id, client_row_id");
    if (error) throw new Error(`Locations were not saved: ${error.message}`);
    for (const row of data ?? []) locationIds[row.client_row_id as string] = row.id as string;
  }
  await softRemoveMissing(ctx, "business_locations", sites.map((row) => row.id), warnings);

  // Prospective locations ---------------------------------------------------
  const prospects = values["prospects.planning"] === "yes" ? rowsOf(answers, "prospects") : [];
  const preferenceIds: Record<string, string> = {};
  if (prospects.length) {
    const { data, error } = await supabase
      .from("location_preferences")
      .upsert(
        prospects.map((row) => ({
          ...base,
          client_row_id: row.id,
          removed_at: null,
          name: str(row.values.name) ?? "Candidate",
          city: str(row.values.city),
          region: str(row.values.region),
          latitude: num(row.values[point.lat]),
          longitude: num(row.values[point.lon]),
          geocoder_name: str(row.values[point.source]),
          match_quality: str(row.values[point.match]),
          user_confirmed: row.values[point.confirmation] === "confirmed_pin",
          intended_activity: str(row.values.intended_activity),
          acquisition_preference: str(row.values.acquisition),
          desired_area: num(row.values.desired_area),
          budget_amount: num(row.values.budget_amount),
          budget_currency: num(row.values.budget_amount) === null ? null : str(row.values.budget_currency),
          decision_date: str(row.values.decision_date),
          utility_needs: { needs: list(row.values.utility_needs) },
          workforce_requirements: num(row.values.workforce) === null ? null : String(num(row.values.workforce)),
          max_acceptable_risk: str(row.values.max_risk),
          weights: { cost: num(row.values.weight_cost), resilience: num(row.values.weight_resilience), climate: num(row.values.weight_climate) },
        })),
        { onConflict: "business_id,client_row_id" },
      )
      .select("id, client_row_id");
    if (error) warnings.push(`Candidate sites were not saved: ${error.message}`);
    for (const row of data ?? []) preferenceIds[row.client_row_id as string] = row.id as string;
  }
  await softRemoveMissing(ctx, "location_preferences", prospects.map((row) => row.id), warnings);

  const locationFor = (ref: AnswerValue | undefined) => (typeof ref === "string" ? (locationIds[ref] ?? null) : null);

  // Suppliers -----------------------------------------------------------------
  const suppliers = values["suppliers.has_critical"] === "yes" ? rowsOf(answers, "suppliers") : [];
  if (suppliers.length) {
    const { data, error } = await supabase
      .from("suppliers")
      .upsert(
        suppliers.map((row) => ({
          ...base,
          client_row_id: row.id,
          removed_at: null,
          name: str(row.values.name) ?? "Supplier",
          product_supplied: str(row.values.product),
          criticality: str(row.values.criticality) ?? "unknown",
          spend_share: num(row.values.spend_share) === null ? null : num(row.values.spend_share)! / 100,
          single_source: triOrNull(row.values.single_source) ?? "unknown",
          alternatives: triOrNull(row.values.alternative),
          substitution_time_days: num(row.values.substitution_days),
          inventory_buffer_days: num(row.values.buffer_days),
          lead_time_days: num(row.values.lead_time_days),
          transport_mode: str(row.values.transport_mode),
          disruption_history: str(row.values.disruption_history),
        })),
        { onConflict: "business_id,client_row_id" },
      )
      .select("id, client_row_id");
    if (error) warnings.push(`Suppliers were not saved: ${error.message}`);
    const supplierLocations = (data ?? []).flatMap((saved) => {
      const row = suppliers.find((item) => item.id === saved.client_row_id);
      const address = [str(row?.values.city), str(row?.values.country)].filter(Boolean).join(", ");
      return address ? [{ organization_id: organizationId, supplier_id: saved.id, client_row_id: saved.client_row_id, address_line: address }] : [];
    });
    if (supplierLocations.length) {
      const { error: locationError } = await supabase.from("supplier_locations").upsert(supplierLocations, { onConflict: "supplier_id,client_row_id" });
      if (locationError) warnings.push(`Supplier locations were not saved: ${locationError.message}`);
    }
  }
  await softRemoveMissing(ctx, "suppliers", suppliers.map((row) => row.id), warnings);

  // Operations ------------------------------------------------------------------
  const details = Object.fromEntries(
    Object.entries(values).filter(([key]) => /^(ops|agri|mfg|cold|retail|it|water|outdoor)\./.test(key)),
  );
  const coldRange = str(values["cold.temperature_range"]);
  const { error: operationsError } = await supabase.from("operational_profiles").upsert(
    {
      ...base,
      input_version_id: inputVersionId,
      electricity_critical: dependencyToTri(values["ops.electricity_dependency"]),
      water_critical: dependencyToTri(values["ops.water_dependency"]),
      cooling_critical: dependencyToTri(values["ops.cooling_dependency"]),
      refrigeration: coldRange ? (coldRange === "ambient" ? "no" : "yes") : "unknown",
      network_dependence: str(values["ops.telecom_dependency"]),
      transport_dependence: str(values["ops.transport_dependency"]),
      perishable_inventory: triOrNull(values["ops.perishable_inventory"]) ?? "unknown",
      outdoor_workforce: triOrNull(values["ops.outdoor_work"]) ?? "unknown",
      max_tolerable_downtime_hours: num(values["ops.max_downtime_hours"]),
      inventory_characteristics: num(values["ops.inventory_days"]) === null ? null : `${num(values["ops.inventory_days"])} days of stock`,
      machinery: str(values["ops.critical_equipment"]),
      seasonal_windows: list(values["agri.growing_months"]).join(", ") || null,
      details,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (operationsError) warnings.push(`Operational profile was not saved: ${operationsError.message}`);

  // Financials ------------------------------------------------------------------
  if (values["fin.include"] === "yes" && ctx.canWriteFinancials) {
    const annual = values["fin.period"] === "annual";
    const { error } = await supabase.from("financial_profiles").upsert(
      {
        ...base,
        input_version_id: inputVersionId,
        currency: str(values["fin.currency"]) ?? "INR",
        reporting_period: annual ? "annual" : "monthly",
        period_start: str(values["fin.period_start"]),
        period_end: str(values["fin.period_end"]),
        figures_basis: str(values["fin.basis"]),
        monthly_revenue: annual ? null : num(values["fin.revenue"]),
        annual_revenue: annual ? num(values["fin.revenue"]) : null,
        gross_margin_band: str(values["fin.gross_margin_band"]),
        fixed_costs: num(values["fin.fixed_costs"]),
        variable_costs: num(values["fin.variable_costs"]),
        payroll: num(values["fin.payroll"]),
        rent: num(values["fin.rent"]),
        utilities: num(values["fin.utilities"]),
        cash_reserves: num(values["fin.cash_reserves"]),
        undrawn_credit: num(values["fin.undrawn_credit"]),
        receivables: num(values["fin.receivables"]),
        payables: num(values["fin.payables"]),
        inventory_value: num(values["fin.inventory_value"]),
        debt_service: num(values["fin.debt_service"]),
        recovery_cost_estimate: num(values["fin.recovery_cost"]),
        expected_downtime_days: num(values["fin.expected_downtime_days"]),
        insurance_status: str(values["fin.insurance"]),
        insurance_exclusions: str(values["fin.insurance_exclusions"]),
        lost_revenue_share: num(values["fin.lost_revenue_share"]),
        continuing_fixed_share: num(values["fin.continuing_fixed_share"]),
        consent_recorded: values["consent.financial"] === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );
    if (error) warnings.push(`Financial profile was not saved: ${error.message}`);

    const currency = str(values["fin.currency"]) ?? "INR";
    const months = new Map<string, { year: number; month: number; revenue: number | null; costs: number | null }>();
    for (const row of rowsOf(answers, "revenue_history")) {
      const match = str(row.values.month)?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) continue;
      months.set(match[0], { year: Number(match[1]), month: Number(match[2]), revenue: num(row.values.revenue), costs: num(row.values.costs) });
    }
    if (months.size) {
      const { error: historyError } = await supabase.from("monthly_financial_records").upsert(
        [...months.values()].map((entry) => ({ ...base, ...entry, currency, source: "business_reported" })),
        { onConflict: "business_id,year,month" },
      );
      if (historyError) warnings.push(`Monthly revenue history was not saved: ${historyError.message}`);
    }
  }

  // Measures ----------------------------------------------------------------------
  const measureRows = [
    ...MEASURE_CATALOGUE.map((measure) => {
      const status = str(values[`measures.${measure.key}`]) ?? "unknown";
      return { ...base, location_id: null as string | null, measure_key: measure.key, status: measureToTri(status), implementation_status: status, hazards: [] as string[], last_tested: null as string | null, evidence_type: null as string | null, notes: null as string | null, input_version_id: inputVersionId };
    }),
    ...rowsOf(answers, "measures_other").map((row) => {
      const status = str(row.values.status) ?? "unknown";
      const name = str(row.values.name) ?? "Measure";
      return {
        ...base,
        location_id: locationFor(row.values.site),
        measure_key: `custom:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
        status: measureToTri(status),
        implementation_status: status,
        hazards: list(row.values.hazards),
        last_tested: str(row.values.last_tested),
        evidence_type: str(row.values.evidence_type),
        notes: name,
        input_version_id: inputVersionId,
      };
    }),
  ];
  const uniqueMeasures = [...new Map(measureRows.map((row) => [`${row.location_id ?? ""}|${row.measure_key}`, row])).values()];
  const { error: measuresError } = await supabase.from("resilience_measures").upsert(uniqueMeasures, { onConflict: "business_id,location_id,measure_key" });
  if (measuresError) warnings.push(`Measures were not saved: ${measuresError.message}`);

  // Version-scoped rows -------------------------------------------------------------
  const scoped = { ...base, input_version_id: inputVersionId };
  const inserts: Array<[string, Record<string, unknown>[]]> = [
    [
      "business_incidents",
      values["incidents.any"] === "yes"
        ? rowsOf(answers, "incidents").map((row) => ({
            ...scoped,
            location_id: locationFor(row.values.site),
            hazard_type: str(row.values.hazard) ?? "other",
            occurred_on: str(row.values.occurred_on),
            duration_hours: num(row.values.duration_hours),
            impacts: list(row.values.impacts),
            recovery_days: num(row.values.recovery_days),
            estimated_loss: num(row.values.estimated_loss),
            loss_currency: num(row.values.estimated_loss) === null ? null : str(row.values.loss_currency),
            insurance_claim_paid: triOrNull(row.values.insured_claim),
            evidence_type: str(row.values.evidence_type) ?? "none",
            description: str(row.values.description),
          }))
        : [],
    ],
    [
      "business_assets",
      rowsOf(answers, "assets").map((row) => ({
        ...scoped,
        location_id: locationFor(row.values.site),
        asset_type: str(row.values.asset_type) ?? "other",
        description: str(row.values.description) ?? "Asset",
        replacement_value: num(row.values.replacement_value),
        currency: num(row.values.replacement_value) === null ? null : str(row.values.currency),
        value_basis: str(row.values.value_basis),
        at_or_below_ground: triOrNull(row.values.below_ground_floor),
        temperature_sensitive: triOrNull(row.values.temperature_sensitive),
      })),
    ],
    [
      "hazard_sensitivity_profiles",
      (["flood", "heat", "drought", "storm", "other"] as const).flatMap((hazard) => {
        const prefix = `hazard.${hazard}.`;
        const responses = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
        if (!Object.keys(responses).length) return [];
        const threshold = hazard === "heat" ? num(values["hazard.heat.stop_temp_c"]) : null;
        return [{ ...scoped, hazard, responses, user_threshold: threshold, threshold_unit: threshold === null ? null : "degC" }];
      }),
    ],
    [
      "utility_reliability_records",
      (["electricity", "water", "telecom"] as const).flatMap((utility) => {
        const band = str(values[`utility.${utility}.outages`]);
        if (!band) return [];
        const primarySite = sites.find((row) => row.values.is_primary === true) ?? sites[0];
        return [{
          ...scoped,
          location_id: primarySite ? (locationIds[primarySite.id] ?? null) : null,
          utility_type: utility,
          information_origin: "business_reported",
          description: `Business-reported ${utility} interruptions: ${band}.`,
          outage_frequency_band: band,
          typical_duration_hours: num(values[`utility.${utility}.duration_hours`]),
          backup_level: str(values[`utility.${utility}.backup`]),
          backup_runtime_hours: utility === "electricity" ? num(values["utility.electricity.backup_hours"]) : null,
          evidence_type: str(values[`utility.${utility}.evidence`]),
        }];
      }),
    ],
    [
      "property_cost_assumptions",
      rowsOf(answers, "costs").map((row) => {
        const ref = typeof row.values.applies_to === "string" ? row.values.applies_to : null;
        return {
          ...scoped,
          location_id: ref ? (locationIds[ref] ?? null) : null,
          preference_id: ref ? (preferenceIds[ref] ?? null) : null,
          cost_item: str(row.values.item),
          description: str(row.values.description),
          amount: num(row.values.amount),
          currency: str(row.values.currency) ?? "INR",
          cost_nature: str(row.values.nature),
          recurrence: row.values.nature === "opex" ? str(row.values.recurrence) : null,
          estimate_type: str(row.values.estimate_type),
          source: str(row.values.source) ?? "not stated",
          estimate_date: str(row.values.estimate_date),
          valid_until: str(row.values.valid_until),
        };
      }),
    ],
    [
      "assessment_missing_data",
      missingData(answers).map((item) => ({
        organization_id: organizationId,
        input_version_id: inputVersionId,
        step_id: item.stepId,
        question_path: item.groupKey ? `${item.groupKey}[].${item.key}` : item.key,
        row_id: item.rowId,
        dimension: item.dimension,
        reason: item.reason,
      })),
    ],
  ];
  for (const [table, rows] of inserts) {
    if (!rows.length) continue;
    const { error } = await supabase.from(table).insert(rows);
    if (error) warnings.push(`${table} was not saved: ${error.message}`);
  }

  // Monitoring ----------------------------------------------------------------------
  const enabled = values["monitor.enabled"] === "yes";
  const { error: monitoringError } = await supabase.from("monitoring_preferences").upsert(
    {
      ...base,
      input_version_id: inputVersionId,
      enabled,
      hazards: enabled ? list(values["monitor.hazards"]) : [],
      channels: enabled ? list(values["monitor.channels"]) : [],
      responsible_role: enabled ? str(values["monitor.responsible_role"]) : null,
      thresholds: { heat_c: num(values["monitor.heat_threshold_c"]), rain_24h_mm: num(values["monitor.rain_threshold_mm"]) },
      reassessment_frequency: str(values["monitor.reassessment"]),
      next_reassessment_due: nextReassessment(str(values["monitor.reassessment"])),
    },
    { onConflict: "business_id" },
  );
  if (monitoringError) warnings.push(`Monitoring preferences were not saved: ${monitoringError.message}`);

  // Uploaded documents ---------------------------------------------------------------
  for (const row of rowsOf(answers, "documents")) {
    const assetId = str(row.values.asset_id);
    if (!assetId) continue;
    const { error } = await supabase
      .from("uploaded_data_assets")
      .update({ business_id: businessId, document_type: str(row.values.document_type), related_step: str(row.values.related_step) })
      .eq("id", assetId)
      .eq("organization_id", organizationId);
    if (error) warnings.push(`Document ${str(row.values.filename) ?? assetId} was not linked: ${error.message}`);
  }

  // Consents ---------------------------------------------------------------------------
  const consents: Array<[string, string]> = [
    ["consent.data_use", "assessment_data_use"],
    ["consent.external_processing", "external_processing"],
    ["consent.financial", "financial_data"],
    ["consent.accuracy", "accuracy_declaration"],
    ["consent.not_credit_decision", "decision_support_acknowledgement"],
  ];
  const consentRows = consents
    .filter(([key]) => values[key] === true)
    .map(([, type]) => ({ user_id: ctx.userId, organization_id: organizationId, consent_type: type, version: CONSENT_VERSION, granted: true, input_version_id: inputVersionId }));
  if (consentRows.length) {
    const { error } = await supabase.from("user_consents").insert(consentRows);
    if (error) warnings.push(`Consent records were not saved: ${error.message}`);
  }

  return { locationIds, warnings };
}

export function nextReassessment(frequency: string | null, from = new Date()): string | null {
  const months = frequency === "quarterly" ? 3 : frequency === "semiannual" ? 6 : frequency === "annual" ? 12 : null;
  if (months === null) return null;
  const due = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()));
  return due.toISOString().slice(0, 10);
}
