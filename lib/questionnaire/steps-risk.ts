import { CURRENCIES, EVIDENCE_TYPES, TRI_HELP, opts, q } from "@/lib/questionnaire/builders";
import type { Persistence, QuestionDefinition, StepDefinition } from "@/lib/questionnaire/types";

const p = (table: string, column: string, note?: string): Persistence => ({ table, column, note });
const INPUT = "assessment_input_versions";
const FIN = "financial_profiles";

const HAZARDS = opts([
  ["flood", "Flood or waterlogging"],
  ["heat", "Extreme heat"],
  ["drought", "Drought or water shortage"],
  ["storm", "Storm or high wind"],
  ["power_outage", "Power outage"],
  ["supplier_disruption", "Supplier or transport disruption"],
  ["other", "Other"],
]);

export const incidentsStep: StepDefinition = {
  id: "incidents",
  number: 6,
  title: "Historical incidents",
  short: "Past incidents",
  summary: "Weather or utility events that have disrupted the business in the last ten years.",
  why: "Past disruption is the strongest local evidence of sensitivity. Incidents are shown alongside hazard data; they are not scored in methodology 1.2.0.",
  dimensions: ["hazard_exposure", "operational_sensitivity"],
  external: [],
  optional: false,
  sections: [
    {
      key: "incidents.intro",
      title: "Disruption history",
      questions: [
        q({
          key: "incidents.any",
          label: "Has weather, a utility failure or a supplier problem disrupted the business in the last ten years?",
          type: "radio",
          required: true,
          width: "full",
          options: opts([["yes", "Yes"], ["no", "No"], ["unknown", "Not sure"]]),
          dimensions: ["hazard_exposure"],
          persistence: p(INPUT, "answers.incidents.any"),
        }),
      ],
    },
    {
      key: "incidents",
      title: "Incidents",
      visibleWhen: { field: "incidents.any", equals: "yes" },
      group: {
        key: "incidents",
        label: "Incidents",
        itemLabel: "Incident",
        minItems: 1,
        maxItems: 30,
        level: "A",
        persistenceTable: "business_incidents",
        questions: [
          q({ key: "hazard", label: "Cause", type: "select", required: true, options: HAZARDS, dimensions: ["hazard_exposure"], persistence: p("business_incidents", "hazard_type") }),
          q({ key: "site", label: "Site affected", type: "site_ref", dimensions: ["hazard_exposure"], persistence: p("business_incidents", "location_id") }),
          q({ key: "occurred_on", label: "Date, or first day", type: "date", required: true, validation: { notFuture: true }, dimensions: ["hazard_exposure"], persistence: p("business_incidents", "occurred_on") }),
          q({ key: "duration_hours", label: "Disruption length", type: "number", unit: "hours", validation: { min: 0, max: 8760 }, dimensions: ["operational_sensitivity"], persistence: p("business_incidents", "duration_hours") }),
          q({
            key: "impacts",
            label: "Effects",
            type: "multiselect",
            width: "full",
            options: opts([["closure", "Site closed"], ["stock_damage", "Stock damaged"], ["equipment_damage", "Equipment damaged"], ["staff_absence", "Staff could not work"], ["lost_sales", "Lost sales"], ["late_deliveries", "Late deliveries"], ["utility_loss", "Utility supply lost"]]),
            dimensions: ["operational_sensitivity"],
            persistence: p("business_incidents", "impacts"),
          }),
          q({ key: "recovery_days", label: "Days to return to normal", type: "number", unit: "days", validation: { min: 0, max: 3650 }, dimensions: ["adaptive_capacity"], persistence: p("business_incidents", "recovery_days") }),
          q({ key: "estimated_loss", label: "Estimated loss", type: "currency", sensitivity: "restricted_financial", validation: { min: 0 }, dimensions: ["financial_sensitivity"], persistence: p("business_incidents", "estimated_loss") }),
          q({ key: "loss_currency", label: "Loss currency", type: "select", options: CURRENCIES, visibleWhen: { field: ".estimated_loss", answered: true }, dimensions: ["financial_sensitivity"], persistence: p("business_incidents", "loss_currency") }),
          q({ key: "insured_claim", label: "Was an insurance claim paid?", type: "tristate", dimensions: ["adaptive_capacity"], persistence: p("business_incidents", "insurance_claim_paid") }),
          q({ key: "evidence_type", label: "Evidence available", type: "select", required: true, options: EVIDENCE_TYPES, dimensions: ["hazard_exposure"], persistence: p("business_incidents", "evidence_type") }),
          q({ key: "description", label: "What happened", type: "textarea", width: "full", validation: { maxLength: 800 }, dimensions: ["hazard_exposure"], persistence: p("business_incidents", "description") }),
        ],
      },
    },
  ],
};

export const hazardsStep: StepDefinition = {
  id: "hazards",
  number: 7,
  title: "Hazard-specific sensitivity",
  short: "Hazard sensitivity",
  summary: "How each hazard would affect the site in practice.",
  why: "Hazard data says how often thresholds are exceeded. These answers describe what an exceedance does to this business. They are shown as context and are not scored in methodology 1.2.0.",
  dimensions: ["hazard_exposure", "operational_sensitivity"],
  external: ["Heat: Open-Meteo forecast with local 1991–2020 percentiles", "Flood: rainfall screens against local wet-day climatology", "Drought: SPI-30 and SPI-90", "Storm: gusts and CAPE screens"],
  optional: false,
  sections: [
    {
      key: "hazard.flood",
      title: "Flood and heavy rain",
      questions: [
        q({ key: "hazard.flood.water_entry", label: "How often does water enter the premises or block access?", type: "select", required: true, options: opts([["never", "Never known"], ["rare", "Rarely, once in several years"], ["occasional", "Most monsoons"], ["frequent", "Several times a year"], ["unknown", "Not sure"]]), dimensions: ["hazard_exposure"], persistence: p("hazard_sensitivity_profiles", "responses.water_entry") }),
        q({ key: "hazard.flood.access_cut", label: "Does heavy rain cut road access for staff or deliveries?", type: "tristate", dimensions: ["hazard_exposure", "operational_sensitivity"], persistence: p("hazard_sensitivity_profiles", "responses.access_cut") }),
        q({ key: "hazard.flood.stock_height_cm", label: "Height of lowest stock above floor", type: "number", unit: "cm", level: "B", visibleWhen: { level: "B" }, validation: { min: 0, max: 1000 }, dimensions: ["adaptive_capacity"], persistence: p("hazard_sensitivity_profiles", "responses.stock_height_cm") }),
      ],
    },
    {
      key: "hazard.heat",
      title: "Heat",
      questions: [
        q({ key: "hazard.heat.cooling", label: "Indoor cooling", type: "select", required: true, options: opts([["none", "None"], ["fans", "Fans or evaporative coolers"], ["partial_ac", "Air conditioning in some areas"], ["full_ac", "Air conditioning throughout"]]), dimensions: ["adaptive_capacity"], persistence: p("hazard_sensitivity_profiles", "responses.cooling") }),
        q({ key: "hazard.heat.sensitive_processes", label: "Do any processes or products fail in high heat?", type: "tristate", dimensions: ["operational_sensitivity"], persistence: p("hazard_sensitivity_profiles", "responses.sensitive_processes") }),
        q({ key: "hazard.heat.stop_temp_c", label: "Temperature at which work is slowed or paused", help: "Your own operating threshold, if you have one.", type: "number", unit: "°C", level: "B", visibleWhen: { level: "B" }, source: "user_assumption", validation: { min: 20, max: 60 }, dimensions: ["operational_sensitivity"], persistence: p("hazard_sensitivity_profiles", "user_threshold") }),
      ],
    },
    {
      key: "hazard.drought",
      title: "Drought and water shortage",
      questions: [
        q({ key: "hazard.drought.effect", label: "Effect of a water shortage lasting a week", type: "select", required: true, options: opts([["stops", "Operations stop"], ["reduces", "Output falls"], ["minor", "Minor effect"], ["none", "No effect"], ["unknown", "Not sure"]]), dimensions: ["operational_sensitivity"], persistence: p("hazard_sensitivity_profiles", "responses.effect") }),
        q({ key: "hazard.drought.rainfall_dependent", label: "Does revenue depend on local rainfall, for example through farm customers?", type: "tristate", dimensions: ["financial_sensitivity", "hazard_exposure"], persistence: p("hazard_sensitivity_profiles", "responses.rainfall_dependent") }),
      ],
    },
    {
      key: "hazard.storm",
      title: "Storm and wind",
      questions: [
        q({ key: "hazard.storm.roof", label: "Roof construction", type: "select", required: true, options: opts([["rcc", "Reinforced concrete"], ["metal_sheet", "Metal or asbestos sheet"], ["tile", "Tile"], ["temporary", "Temporary or tarpaulin"], ["mixed", "Mixed"]]), dimensions: ["hazard_exposure"], persistence: p("hazard_sensitivity_profiles", "responses.roof") }),
        q({ key: "hazard.storm.outdoor_assets", label: "Signage, stock or equipment stored outside?", type: "tristate", dimensions: ["hazard_exposure"], persistence: p("hazard_sensitivity_profiles", "responses.outdoor_assets") }),
      ],
    },
    {
      key: "hazard.other",
      title: "Other hazards",
      questions: [
        q({ key: "hazard.other.description", label: "Other hazards you are concerned about", help: "For example landslide, coastal surge or smoke.", type: "textarea", width: "full", validation: { maxLength: 600 }, dimensions: ["hazard_exposure"], persistence: p("hazard_sensitivity_profiles", "responses.description") }),
      ],
    },
  ],
};

const OUTAGE_BANDS = opts([
  ["none", "None in the last 12 months"],
  ["yearly", "1–5 times a year"],
  ["monthly", "About monthly"],
  ["weekly", "Weekly"],
  ["daily", "Daily"],
  ["unknown", "Not sure"],
]);

function utilityQuestions(utility: "electricity" | "water" | "telecom", label: string): QuestionDefinition[] {
  const table = "utility_reliability_records";
  const required = utility !== "telecom";
  return [
    q({ key: `utility.${utility}.outages`, label: `${label} interruptions`, type: "select", required, options: OUTAGE_BANDS, dimensions: ["hazard_exposure", "operational_sensitivity"], persistence: p(table, "outage_frequency_band", `One row with utility_type = ${utility}.`) }),
    q({ key: `utility.${utility}.duration_hours`, label: "Typical interruption length", type: "number", unit: "hours", visibleWhen: { field: `utility.${utility}.outages`, in: ["yearly", "monthly", "weekly", "daily"] }, validation: { min: 0, max: 720 }, dimensions: ["operational_sensitivity"], persistence: p(table, "typical_duration_hours") }),
    q({ key: `utility.${utility}.backup`, label: "Backup", type: "select", options: opts([["none", "None"], ["partial", "Covers essential loads"], ["full", "Covers the whole site"]]), dimensions: ["adaptive_capacity"], persistence: p(table, "backup_level") }),
    q({ key: `utility.${utility}.evidence`, label: "Basis of this answer", type: "select", required, visibleWhen: { field: `utility.${utility}.outages`, in: ["none", "yearly", "monthly", "weekly", "daily"] }, options: opts([["utility_records", "Utility notices or bills"], ["own_logs", "Our own logs or generator records"], ["recollection", "Recollection"], ["none", "No basis"]]), dimensions: ["hazard_exposure"], persistence: p(table, "evidence_type") }),
  ];
}

export const utilitiesStep: StepDefinition = {
  id: "utilities",
  number: 8,
  title: "Utility reliability",
  short: "Utilities",
  summary: "How reliable power, water and connectivity are at the main site.",
  why: "No public outage feed is integrated, so reliability comes from you and is labelled business-reported. Heat or rain is never treated as proof that a utility failed.",
  dimensions: ["operational_sensitivity", "adaptive_capacity"],
  external: [],
  optional: false,
  sections: [
    { key: "utility.electricity", title: "Electricity", questions: [
      ...utilityQuestions("electricity", "Power"),
      q({ key: "utility.electricity.backup_hours", label: "Backup runtime at full essential load", type: "number", unit: "hours", level: "B", visibleWhen: { all: [{ level: "B" }, { field: "utility.electricity.backup", in: ["partial", "full"] }] }, validation: { min: 0, max: 720 }, dimensions: ["adaptive_capacity"], persistence: p("utility_reliability_records", "backup_runtime_hours") }),
    ] },
    { key: "utility.water", title: "Water", questions: utilityQuestions("water", "Water supply") },
    { key: "utility.telecom", title: "Telecoms", questions: utilityQuestions("telecom", "Internet or phone") },
  ],
};

export const suppliersStep: StepDefinition = {
  id: "suppliers",
  number: 9,
  title: "Suppliers and inputs",
  short: "Suppliers",
  summary: "Suppliers whose failure would interrupt the business.",
  why: "The supply-chain component uses the most exposed critical supplier. With no critical supplier entered, the component is excluded rather than scored as zero.",
  dimensions: ["supply_chain"],
  external: [],
  optional: false,
  sections: [
    {
      key: "suppliers.intro",
      title: "Supplier dependence",
      questions: [
        q({ key: "suppliers.has_critical", label: "Do you rely on any supplier that would be hard to replace within a week?", type: "radio", required: true, width: "full", options: opts([["yes", "Yes"], ["no", "No"], ["unknown", "Not sure"]]), dimensions: ["supply_chain"], persistence: p(INPUT, "answers.suppliers.has_critical") }),
      ],
    },
    {
      key: "suppliers",
      title: "Suppliers",
      visibleWhen: { field: "suppliers.has_critical", equals: "yes" },
      group: {
        key: "suppliers",
        label: "Suppliers",
        itemLabel: "Supplier",
        minItems: 1,
        maxItems: 25,
        level: "A",
        persistenceTable: "suppliers",
        questions: [
          q({ key: "name", label: "Supplier name", type: "text", required: true, validation: { maxLength: 160 }, dimensions: ["supply_chain"], persistence: p("suppliers", "name") }),
          q({ key: "product", label: "What they supply", type: "text", validation: { maxLength: 200 }, dimensions: ["supply_chain"], persistence: p("suppliers", "product_supplied") }),
          q({ key: "criticality", label: "Criticality", type: "select", required: true, material: true, options: opts([["critical", "Critical"], ["important", "Important"], ["optional", "Replaceable"]]), dimensions: ["supply_chain"], persistence: p("suppliers", "criticality") }),
          q({ key: "spend_share", label: "Share of purchases", type: "percentage", unit: "%", material: true, validation: { min: 0, max: 100 }, dimensions: ["supply_chain"], persistence: p("suppliers", "spend_share", "Stored as a fraction from 0 to 1.") }),
          q({ key: "single_source", label: "Only source for this input?", type: "tristate", required: true, material: true, dimensions: ["supply_chain"], persistence: p("suppliers", "single_source") }),
          q({ key: "alternative", label: "Alternative supplier identified?", type: "tristate", required: true, material: true, dimensions: ["supply_chain"], persistence: p("suppliers", "alternatives") }),
          q({ key: "substitution_days", label: "Days to switch supplier", type: "number", unit: "days", validation: { min: 0, max: 730 }, dimensions: ["supply_chain"], persistence: p("suppliers", "substitution_time_days") }),
          q({ key: "buffer_days", label: "Stock buffer for this input", type: "number", unit: "days", validation: { min: 0, max: 730 }, dimensions: ["supply_chain"], persistence: p("suppliers", "inventory_buffer_days") }),
          q({ key: "city", label: "Supplier city", type: "text", validation: { maxLength: 120 }, dimensions: ["supply_chain"], persistence: p("supplier_locations", "address_line") }),
          q({ key: "country", label: "Supplier country", type: "text", validation: { maxLength: 80 }, dimensions: ["supply_chain"], persistence: p("supplier_locations", "address_line", "Combined with city.") }),
          q({ key: "lead_time_days", label: "Normal lead time", type: "number", unit: "days", level: "B", visibleWhen: { level: "B" }, validation: { min: 0, max: 730 }, dimensions: ["supply_chain"], persistence: p("suppliers", "lead_time_days") }),
          q({ key: "transport_mode", label: "Transport mode", type: "select", level: "B", visibleWhen: { level: "B" }, options: opts([["road", "Road"], ["rail", "Rail"], ["sea", "Sea"], ["air", "Air"], ["mixed", "Mixed"]]), dimensions: ["supply_chain"], persistence: p("suppliers", "transport_mode") }),
          q({ key: "disruption_history", label: "Past disruptions from this supplier", type: "textarea", width: "full", level: "B", visibleWhen: { level: "B" }, validation: { maxLength: 600 }, dimensions: ["supply_chain"], persistence: p("suppliers", "disruption_history") }),
        ],
      },
    },
  ],
};

const fin = (input: Omit<Parameters<typeof q>[0], "dimensions">) =>
  q({ sensitivity: "restricted_financial", material: true, ...input, dimensions: ["financial_sensitivity"] });
const SHARE = { field: "fin.include", equals: "yes" } as const;
const SHARE_B = { all: [SHARE, { level: "B" as const }] };

export const financialsStep: StepDefinition = {
  id: "financials",
  number: 10,
  title: "Financial resilience",
  short: "Financials",
  summary: "Revenue, costs, liquidity and recovery capacity, if you choose to share them.",
  why: "Financial figures drive runway and hypothetical disruption scenarios. They are optional, visible only to owner, admin and analyst roles, and never used as a loan decision.",
  dimensions: ["financial_sensitivity"],
  external: [],
  optional: true,
  sections: [
    {
      key: "fin.consent",
      title: "Sharing",
      description: "Do not enter bank account numbers, passwords, card details or guarantor information. Only business-level totals are asked.",
      questions: [
        q({ key: "fin.include", label: "Share financial figures for this assessment?", type: "radio", required: true, width: "full", options: [{ value: "yes", label: "Yes, include financial figures" }, { value: "no", label: "No, skip the financial component", help: "The financial-sensitivity component is then excluded and weights are renormalised." }], dimensions: ["financial_sensitivity", "governance"], persistence: p(INPUT, "answers.fin.include") }),
      ],
    },
    {
      key: "fin.reporting",
      title: "Reporting basis",
      visibleWhen: SHARE,
      questions: [
        fin({ key: "fin.currency", label: "Currency", type: "select", required: true, options: CURRENCIES, persistence: p(FIN, "currency") }),
        fin({ key: "fin.period", label: "Figures cover", type: "radio", required: true, options: opts([["monthly", "A typical month"], ["annual", "A full year"]]), persistence: p(FIN, "reporting_period") }),
        fin({ key: "fin.period_start", label: "Period start", type: "date", validation: { notFuture: true }, persistence: p(FIN, "period_start") }),
        fin({ key: "fin.period_end", label: "Period end", type: "date", validation: { notFuture: true }, persistence: p(FIN, "period_end") }),
        fin({ key: "fin.basis", label: "Source of figures", type: "select", required: true, material: false, options: opts([["audited", "Audited accounts"], ["management", "Management accounts"], ["tax_return", "Tax return"], ["estimate", "Own estimate"]]), persistence: p(FIN, "figures_basis") }),
      ],
    },
    {
      key: "fin.pnl",
      title: "Revenue and costs",
      visibleWhen: SHARE,
      questions: [
        fin({ key: "fin.revenue", label: "Revenue", type: "currency", required: true, validation: { min: 0 }, persistence: p(FIN, "monthly_revenue | annual_revenue", "Column chosen by the period answer.") }),
        fin({ key: "fin.fixed_costs", label: "Fixed costs", help: "Costs that continue during a stoppage: rent, salaries, loan interest.", type: "currency", required: true, validation: { min: 0 }, persistence: p(FIN, "fixed_costs") }),
        fin({ key: "fin.variable_costs", label: "Variable costs", type: "currency", validation: { min: 0 }, persistence: p(FIN, "variable_costs") }),
        fin({ key: "fin.gross_margin_band", label: "Gross margin", type: "select", level: "B", visibleWhen: SHARE_B, options: opts([["lt10", "Under 10%"], ["10-25", "10–25%"], ["25-40", "25–40%"], ["gt40", "Over 40%"]]), persistence: p(FIN, "gross_margin_band") }),
        fin({ key: "fin.payroll", label: "Payroll", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "payroll") }),
        fin({ key: "fin.rent", label: "Rent", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "rent") }),
        fin({ key: "fin.utilities", label: "Utilities", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "utilities") }),
      ],
    },
    {
      key: "fin.liquidity",
      title: "Liquidity, working capital and debt",
      visibleWhen: SHARE,
      questions: [
        fin({ key: "fin.cash_reserves", label: "Cash and bank balances available", type: "currency", required: true, validation: { min: 0 }, persistence: p(FIN, "cash_reserves") }),
        fin({ key: "fin.undrawn_credit", label: "Undrawn credit lines", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "undrawn_credit") }),
        fin({ key: "fin.receivables", label: "Receivables", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "receivables") }),
        fin({ key: "fin.payables", label: "Payables", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "payables") }),
        fin({ key: "fin.inventory_value", label: "Inventory value", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "inventory_value") }),
        fin({ key: "fin.debt_service", label: "Loan repayments in the same period", type: "currency", level: "B", visibleWhen: SHARE_B, validation: { min: 0 }, persistence: p(FIN, "debt_service") }),
      ],
    },
    {
      key: "fin.recovery",
      title: "Recovery and insurance",
      visibleWhen: SHARE,
      questions: [
        fin({ key: "fin.recovery_cost", label: "Estimated cost to recover from a major disruption", type: "currency", source: "user_assumption", validation: { min: 0 }, persistence: p(FIN, "recovery_cost_estimate") }),
        fin({ key: "fin.expected_downtime_days", label: "Expected downtime after a major event", type: "number", unit: "days", source: "user_assumption", validation: { min: 0, max: 365 }, persistence: p(FIN, "expected_downtime_days") }),
        fin({ key: "fin.insurance", label: "Insurance cover", type: "select", required: true, material: true, options: opts([["none", "No insurance"], ["property", "Property or stock only"], ["property_bi", "Property and business interruption"], ["unknown", "Not sure"]]), persistence: p(FIN, "insurance_status") }),
        fin({ key: "fin.insurance_exclusions", label: "Known exclusions", help: "For example flood excluded or high deductible.", type: "textarea", width: "full", level: "B", visibleWhen: SHARE_B, validation: { maxLength: 600 }, persistence: p(FIN, "insurance_exclusions") }),
        fin({ key: "fin.lost_revenue_share", label: "Revenue lost per day of stoppage", help: "Assumption for hypothetical scenarios. Blank uses 100%.", type: "percentage", unit: "%", level: "B", visibleWhen: SHARE_B, source: "user_assumption", validation: { min: 0, max: 100 }, persistence: p(FIN, "lost_revenue_share") }),
        fin({ key: "fin.continuing_fixed_share", label: "Fixed costs that continue during stoppage", help: "Assumption for hypothetical scenarios. Blank uses 100%.", type: "percentage", unit: "%", level: "B", visibleWhen: SHARE_B, source: "user_assumption", validation: { min: 0, max: 100 }, persistence: p(FIN, "continuing_fixed_share") }),
      ],
    },
    {
      key: "revenue_history",
      title: "Monthly revenue history",
      description: "Optional. Actual monthly figures from your books let the reports compare revenue with past weather at your site. Twelve or more months are needed for that comparison; fewer months are shown but not analysed.",
      visibleWhen: SHARE,
      group: {
        key: "revenue_history",
        label: "Monthly revenue",
        itemLabel: "Month",
        minItems: 0,
        maxItems: 60,
        level: "A",
        persistenceTable: "monthly_financial_records",
        questions: [
          fin({ key: "month", label: "Month", placeholder: "2025-07", type: "text", required: true, material: false, validation: { maxLength: 7, pattern: { regex: "^\\d{4}-(0[1-9]|1[0-2])$", message: "Use the format YYYY-MM, for example 2025-07." } }, persistence: p("monthly_financial_records", "year, month") }),
          fin({ key: "revenue", label: "Revenue that month", type: "currency", required: true, material: false, validation: { min: 0 }, persistence: p("monthly_financial_records", "revenue") }),
          fin({ key: "costs", label: "Total costs that month", type: "currency", material: false, validation: { min: 0 }, persistence: p("monthly_financial_records", "costs") }),
        ],
      },
    },
  ],
};

export const MEASURE_CATALOGUE: Array<{ key: string; label: string; help: string }> = [
  { key: "drainage", label: "Site drainage maintained", help: "Drains cleared before the monsoon." },
  { key: "floodProtection", label: "Flood barriers or raised plinth", help: "Physical protection at entrances." },
  { key: "inventoryProtection", label: "Stock raised or protected", help: "Pallets, racking or sealed storage." },
  { key: "cooling", label: "Cooling for people or products", help: "Ventilation, shading or air conditioning." },
  { key: "backupPower", label: "Backup power", help: "Generator, inverter or solar with storage." },
  { key: "waterStorage", label: "Water storage", help: "Tanks sized for at least a day's use." },
  { key: "emergencyProcedures", label: "Written emergency procedures", help: "Who does what during an event." },
  { key: "alternateSuppliers", label: "Alternate suppliers agreed", help: "Named fallback for critical inputs." },
  { key: "bufferStock", label: "Buffer stock policy", help: "Extra stock before risky seasons." },
  { key: "backupSite", label: "Backup site or shared facility", help: "Somewhere to operate if the site is unusable." },
  { key: "workerSafety", label: "Heat and safety protocols for staff", help: "Breaks, water, shifted hours." },
  { key: "insurance", label: "Insurance covering climate events", help: "Check exclusions for flood or storm." },
  { key: "continuityPlan", label: "Business continuity plan", help: "Documented and known to staff." },
];

const MEASURE_STATUS = opts([
  ["implemented", "In place"],
  ["partial", "Partly in place"],
  ["planned", "Planned"],
  ["not_in_place", "Not in place"],
  ["not_applicable", "Not relevant"],
  ["unknown", "Not sure"],
]);

export const measuresStep: StepDefinition = {
  id: "measures",
  number: 11,
  title: "Continuity and adaptation measures",
  short: "Measures",
  summary: "Protections and plans already in place, partly in place or planned.",
  why: "These answers form the adaptive-capacity gap. Only measures in place close a gap; partly in place and planned count as gaps; not relevant and unsure are excluded.",
  dimensions: ["adaptive_capacity"],
  external: [],
  optional: false,
  sections: [
    {
      key: "measures.catalogue",
      title: "Standard measures",
      description: TRI_HELP,
      questions: MEASURE_CATALOGUE.map((measure) =>
        q({
          key: `measures.${measure.key}`,
          label: measure.label,
          help: measure.help,
          type: "select",
          required: true,
          material: true,
          options: MEASURE_STATUS,
          dimensions: ["adaptive_capacity"],
          persistence: p("resilience_measures", "implementation_status", `measure_key = ${measure.key}. status holds the scored yes/no/unknown value.`),
        }),
      ),
    },
    {
      key: "measures_other",
      title: "Other measures",
      group: {
        key: "measures_other",
        label: "Other measures",
        itemLabel: "Measure",
        description: "Site-specific measures not in the standard list.",
        minItems: 0,
        maxItems: 20,
        level: "A",
        persistenceTable: "resilience_measures",
        questions: [
          q({ key: "name", label: "Measure", type: "text", required: true, validation: { maxLength: 160 }, dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "notes", "measure_key = custom:<slug>.") }),
          q({ key: "status", label: "Status", type: "select", required: true, options: MEASURE_STATUS.filter((option) => option.value !== "not_applicable"), dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "implementation_status") }),
          q({ key: "hazards", label: "Hazards addressed", type: "multiselect", width: "full", options: HAZARDS.slice(0, 5), dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "hazards") }),
          q({ key: "site", label: "Site", type: "site_ref", dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "location_id") }),
          q({ key: "last_tested", label: "Last tested or maintained", type: "date", validation: { notFuture: true }, level: "B", visibleWhen: { level: "B" }, dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "last_tested") }),
          q({ key: "evidence_type", label: "Evidence", type: "select", level: "B", visibleWhen: { level: "B" }, options: EVIDENCE_TYPES, dimensions: ["adaptive_capacity"], persistence: p("resilience_measures", "evidence_type") }),
        ],
      },
    },
  ],
};

export const costsStep: StepDefinition = {
  id: "costs",
  number: 12,
  title: "Property and investment costs",
  short: "Costs",
  summary: "Quotations and assumptions for sites and adaptation investments.",
  why: "Costing uses only figures you enter, each with a currency, date and source. No land price or construction rate is looked up or invented.",
  dimensions: ["site_feasibility", "financial_sensitivity"],
  external: [],
  optional: true,
  sections: [
    {
      key: "costs",
      title: "Cost lines",
      group: {
        key: "costs",
        label: "Cost lines",
        itemLabel: "Cost line",
        minItems: 0,
        maxItems: 60,
        level: "A",
        persistenceTable: "property_cost_assumptions",
        questions: [
          q({ key: "item", label: "Cost item", type: "select", required: true, options: opts([["purchase", "Purchase price"], ["rent", "Rent"], ["construction", "Construction"], ["renovation", "Renovation"], ["preparation", "Site preparation"], ["utility_connection", "Utility connection"], ["backup_power", "Backup power"], ["cooling", "Cooling"], ["water_storage", "Water storage"], ["drainage", "Drainage or flood works"], ["transport", "Transport"], ["maintenance", "Maintenance"], ["insurance_premium", "Insurance premium"], ["other", "Other"]]), dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "cost_item") }),
          q({ key: "applies_to", label: "Applies to", type: "site_ref", dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "location_id | preference_id") }),
          q({ key: "description", label: "Description", type: "text", width: "full", validation: { maxLength: 240 }, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "description") }),
          q({ key: "amount", label: "Amount", type: "currency", required: true, sensitivity: "confidential", source: "user_assumption", validation: { min: 0 }, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "amount") }),
          q({ key: "currency", label: "Currency", type: "select", required: true, options: CURRENCIES, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "currency") }),
          q({ key: "nature", label: "Capital or operating", type: "radio", required: true, options: opts([["capex", "Capital (one-off investment)"], ["opex", "Operating (recurring)"]]), dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "cost_nature") }),
          q({ key: "recurrence", label: "Recurrence", type: "select", visibleWhen: { field: ".nature", equals: "opex" }, options: opts([["monthly", "Monthly"], ["quarterly", "Quarterly"], ["annual", "Annual"]]), dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "recurrence") }),
          q({ key: "estimate_type", label: "Type of figure", type: "select", required: true, options: opts([["quotation", "Written quotation"], ["internal_estimate", "Internal estimate"], ["published_rate", "Published rate or tariff"], ["assumption", "Planning assumption"]]), dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "estimate_type") }),
          q({ key: "source", label: "Source", help: "Vendor, document or person the figure came from.", type: "text", required: true, validation: { maxLength: 200 }, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "source") }),
          q({ key: "estimate_date", label: "Date of figure", type: "date", required: true, validation: { notFuture: true }, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "estimate_date") }),
          q({ key: "valid_until", label: "Valid until", type: "date", level: "B", visibleWhen: { all: [{ level: "B" }, { field: ".estimate_type", equals: "quotation" }] }, dimensions: ["site_feasibility"], persistence: p("property_cost_assumptions", "valid_until") }),
        ],
      },
    },
  ],
};

export const DOCUMENT_TYPES = opts([
  ["financial_statement", "Financial statement"],
  ["insurance_policy", "Insurance policy or schedule"],
  ["utility_record", "Utility bill or outage notice"],
  ["incident_evidence", "Incident photo or report"],
  ["quotation", "Cost quotation"],
  ["site_plan", "Site plan or drawing"],
  ["continuity_plan", "Continuity or emergency plan"],
  ["other", "Other supporting document"],
]);

export const uploadsStep: StepDefinition = {
  id: "uploads",
  number: 13,
  title: "Supporting documents",
  short: "Documents",
  summary: "Optional evidence that supports your answers.",
  why: "Documents raise evidence quality from self-reported to document-supported. Files are stored privately for your organisation. They are not read automatically or parsed for figures.",
  dimensions: ["governance"],
  external: ["Supabase Storage, private bucket business-uploads"],
  optional: true,
  sections: [
    {
      key: "documents",
      title: "Uploaded documents",
      description: "PDF, CSV, XLSX, PNG or JPEG, up to 10 MB each. Do not upload identity documents or bank statements showing account credentials.",
      group: {
        key: "documents",
        label: "Documents",
        itemLabel: "Document",
        minItems: 0,
        maxItems: 20,
        level: "A",
        managed: true,
        persistenceTable: "uploaded_data_assets",
        questions: [
          q({ key: "asset_id", label: "Stored file", type: "text", dimensions: ["governance"], persistence: p("uploaded_data_assets", "id") }),
          q({ key: "filename", label: "File", type: "text", dimensions: ["governance"], persistence: p("uploaded_data_assets", "filename") }),
          q({ key: "document_type", label: "Document type", type: "select", required: true, options: DOCUMENT_TYPES, dimensions: ["governance"], persistence: p("uploaded_data_assets", "document_type") }),
          q({ key: "related_step", label: "Supports", type: "select", options: opts([["incidents", "Historical incidents"], ["utilities", "Utility reliability"], ["financials", "Financials"], ["measures", "Measures"], ["costs", "Costs"], ["locations", "Locations"]]), dimensions: ["governance"], persistence: p("uploaded_data_assets", "related_step") }),
        ],
      },
    },
  ],
};

export const monitoringStep: StepDefinition = {
  id: "monitoring",
  number: 14,
  title: "Monitoring and reassessment",
  short: "Monitoring",
  summary: "Which conditions to watch and when to reassess.",
  why: "Monitoring compares new forecasts with your thresholds. Alerts are screening signals, not official warnings.",
  dimensions: ["monitoring"],
  external: ["Open-Meteo forecast (polled)", "Official warning feed, only if configured"],
  optional: false,
  sections: [
    {
      key: "monitor.main",
      title: "Alerts",
      questions: [
        q({ key: "monitor.enabled", label: "Watch forecasts for these sites?", type: "radio", required: true, options: opts([["yes", "Yes"], ["no", "Not now"]]), dimensions: ["monitoring"], persistence: p("monitoring_preferences", "enabled") }),
        q({ key: "monitor.hazards", label: "Conditions to watch", type: "multiselect", width: "full", required: true, visibleWhen: { field: "monitor.enabled", equals: "yes" }, validation: { minItems: 1 }, options: opts([["heavy_rain", "Heavy rain"], ["heat", "Heat"], ["dry_spell", "Dry spell"], ["wind", "High wind"]]), dimensions: ["monitoring"], persistence: p("monitoring_preferences", "hazards") }),
        q({ key: "monitor.channels", label: "Where to show alerts", help: "Email delivery needs an email provider to be configured; until then alerts appear in the workspace only.", type: "multiselect", visibleWhen: { field: "monitor.enabled", equals: "yes" }, options: opts([["in_app", "In the workspace"], ["email", "Email"]]), dimensions: ["monitoring"], persistence: p("monitoring_preferences", "channels") }),
        q({ key: "monitor.responsible_role", label: "Role responsible for responding", help: "A role, for example operations manager. No personal contact details are needed.", type: "text", visibleWhen: { field: "monitor.enabled", equals: "yes" }, validation: { maxLength: 120 }, dimensions: ["monitoring"], persistence: p("monitoring_preferences", "responsible_role") }),
        q({ key: "monitor.heat_threshold_c", label: "Custom heat threshold", type: "number", unit: "°C", level: "B", source: "user_assumption", visibleWhen: { all: [{ level: "B" }, { field: "monitor.hazards", includes: "heat" }] }, validation: { min: 20, max: 55 }, dimensions: ["monitoring"], persistence: p("monitoring_preferences", "thresholds.heat_c") }),
        q({ key: "monitor.rain_threshold_mm", label: "Custom 24-hour rain threshold", type: "number", unit: "mm", level: "B", source: "user_assumption", visibleWhen: { all: [{ level: "B" }, { field: "monitor.hazards", includes: "heavy_rain" }] }, validation: { min: 1, max: 1000 }, dimensions: ["monitoring"], persistence: p("monitoring_preferences", "thresholds.rain_24h_mm") }),
      ],
    },
    {
      key: "monitor.reassess",
      title: "Reassessment",
      questions: [
        q({ key: "monitor.reassessment", label: "Reassess", type: "select", required: true, options: opts([["quarterly", "Every quarter"], ["semiannual", "Every six months"], ["annual", "Every year"], ["on_change", "Only when inputs change"]]), dimensions: ["monitoring"], persistence: p("monitoring_preferences", "reassessment_frequency") }),
      ],
    },
  ],
};

export const reviewStep: StepDefinition = {
  id: "review",
  number: 15,
  title: "Review, consent and submission",
  short: "Review and submit",
  summary: "Check the summary, record consent and start the analysis.",
  why: "Submission freezes an input version. The analysis runs against that version with the current methodology, so results can be reproduced later.",
  dimensions: ["governance"],
  external: [],
  optional: false,
  sections: [
    {
      key: "consent",
      title: "Consent",
      questions: [
        q({ key: "consent.data_use", label: "I agree that these answers are stored for my organisation and used to produce this assessment.", type: "boolean", required: true, width: "full", dimensions: ["governance"], persistence: p("user_consents", "granted", "consent_type = assessment_data_use") }),
        q({ key: "consent.external_processing", label: "I agree that site coordinates are sent to the configured weather and satellite providers.", type: "boolean", required: true, width: "full", dimensions: ["governance"], persistence: p("user_consents", "granted", "consent_type = external_processing") }),
        q({ key: "consent.financial", label: "I agree that the financial figures entered are stored and visible to owner, admin and analyst roles.", type: "boolean", required: true, width: "full", visibleWhen: { field: "fin.include", equals: "yes" }, dimensions: ["governance"], persistence: p("user_consents", "granted", "consent_type = financial_data") }),
        q({ key: "consent.accuracy", label: "The answers are accurate to the best of my knowledge, and unknowns are marked as such.", type: "boolean", required: true, width: "full", dimensions: ["governance"], persistence: p("user_consents", "granted", "consent_type = accuracy_declaration") }),
        q({ key: "consent.not_credit_decision", label: "I understand the result is decision support, not a credit decision or probability of default.", type: "boolean", required: true, width: "full", dimensions: ["governance"], persistence: p("user_consents", "granted", "consent_type = decision_support_acknowledgement") }),
      ],
    },
  ],
};
