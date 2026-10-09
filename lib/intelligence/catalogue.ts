export const CORE_REPORTS = [
  { type: "msme_360", title: "MSME 360° Risk Profile", category: "business", audience: ["MSME", "Lender", "Risk team"], summary: "Business baseline, climate exposure, financial position, resilience and the main risks in one view." },
  { type: "climate_exposure", title: "Climate Exposure Assessment", category: "climate", audience: ["MSME", "Lender"], summary: "Hazard by hazard: forecast screens, regional flood, river and projection context, and how this business would feel each hazard." },
  { type: "climate_adjusted_financial_risk", title: "Climate-Adjusted Financial Risk", category: "financial", audience: ["Lender", "Risk team"], summary: "Climate event → disruption → revenue → cash flow → debt-service pressure, as separate, explained dimensions." },
  { type: "revenue_at_risk", title: "Revenue-at-Risk Analysis", category: "revenue", audience: ["MSME", "Lender"], summary: "Revenue and margin at risk per scenario, tolerance to downtime, seasonality and revenue-versus-weather history." },
  { type: "operational_vulnerability", title: "Operational Vulnerability Report", category: "operational", audience: ["MSME"], summary: "Dependencies, utility reliability, downtime tolerance, impact pathways and past incident effects." },
  { type: "supply_chain", title: "Supply-Chain Climate Risk", category: "supply_chain", audience: ["MSME", "Lender"], summary: "Critical suppliers, concentration, buffers, switching time and the supplier-disruption scenario." },
  { type: "stress_test", title: "Climate Stress-Test Report", category: "scenarios", audience: ["Lender", "Risk team"], summary: "Heatwave, flood, water-shortage, supplier and compound scenarios with liquidity and debt-service effects." },
  { type: "resilience", title: "Resilience Score & Assessment", category: "resilience", audience: ["MSME"], summary: "Financial, operational, supply-chain, preparedness, insurance, workforce and recovery resilience." },
  { type: "adaptation_plan", title: "Climate Adaptation & Investment Plan", category: "adaptation", audience: ["MSME"], summary: "Prioritised measures for exposed hazards, with business-supplied costs and the scenario each targets." },
  { type: "executive_one_page", title: "Executive One-Page Risk Report", category: "executive", audience: ["Management", "Lender"], summary: "Profile, indicators, key threats and vulnerabilities, and the top five actions on one page." },
] as const;

export type ReportType = (typeof CORE_REPORTS)[number]["type"];
export const REPORT_TYPES = CORE_REPORTS.map((report) => report.type) as ReportType[];
export const coreReport = (type: string) => CORE_REPORTS.find((report) => report.type === type) ?? null;

export const CATEGORIES = [
  { id: "business", number: 1, title: "MSME Business Profile", group: "Business Intelligence" },
  { id: "climate", number: 2, title: "Climate Exposure", group: "Climate Intelligence" },
  { id: "financial", number: 3, title: "Financial Risk", group: "Financial Intelligence" },
  { id: "revenue", number: 4, title: "Climate-Induced Revenue Volatility", group: "Financial Intelligence" },
  { id: "operational", number: 5, title: "Operational Risk", group: "Operational Intelligence" },
  { id: "workforce", number: 6, title: "Workforce & Productivity", group: "Operational Intelligence" },
  { id: "supply_chain", number: 7, title: "Supply-Chain Risk", group: "Supply-Chain Intelligence" },
  { id: "resources", number: 8, title: "Resource Dependency (Water & Energy)", group: "Operational Intelligence" },
  { id: "insurance", number: 9, title: "Insurance & Protection", group: "Financial Intelligence" },
  { id: "scenarios", number: 10, title: "Climate Scenario & Stress-Test", group: "Risk & Stress Testing" },
  { id: "forecast", number: 11, title: "Climate Forecast & Early Warning", group: "Climate Intelligence" },
  { id: "alerts", number: 12, title: "Real-Time Risk & Alerts", group: "Climate Intelligence" },
  { id: "resilience", number: 13, title: "MSME Resilience", group: "Resilience & Recommendations" },
  { id: "lender", number: 14, title: "Lender / Financial Institution", group: "Lender & Portfolio Intelligence" },
  { id: "financing", number: 15, title: "Loan & Financing Support", group: "Lender & Portfolio Intelligence" },
  { id: "adaptation", number: 16, title: "Climate Adaptation & Investment", group: "Resilience & Recommendations" },
  { id: "actions", number: 17, title: "Recommendations & Actions", group: "Resilience & Recommendations" },
  { id: "benchmarking", number: 18, title: "Comparative / Benchmarking", group: "Lender & Portfolio Intelligence" },
  { id: "geographic", number: 19, title: "Geographic / Portfolio Maps", group: "Lender & Portfolio Intelligence" },
  { id: "portfolio", number: 20, title: "Portfolio-Level Institution Reports", group: "Lender & Portfolio Intelligence" },
  { id: "esg", number: 21, title: "Compliance & ESG", group: "Lender & Portfolio Intelligence" },
  { id: "audit", number: 22, title: "Audit & Data Quality", group: "Business Intelligence" },
  { id: "ai", number: 23, title: "AI Intelligence", group: "Business Intelligence" },
  { id: "executive", number: 24, title: "Executive Reports", group: "Business Intelligence" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type CatalogueStatus =
  | { kind: "core"; type: ReportType }
  | { kind: "section"; within: ReportType; section: string }
  | { kind: "unavailable"; requires: string };

export interface CatalogueEntry {
  name: string;
  category: CategoryId;
  status: CatalogueStatus;
}

const core = (type: ReportType): CatalogueStatus => ({ kind: "core", type });
const within = (type: ReportType, section: string): CatalogueStatus => ({ kind: "section", within: type, section });
const needs = (requires: string): CatalogueStatus => ({ kind: "unavailable", requires });

const PEERS = "A peer dataset of comparable MSMEs (industry, region, size). None is integrated, and averages are never invented.";
const PORTFOLIO = "Multiple borrowers with loan exposures in one institution workspace. This workspace holds a single business.";
const CREDIT_MODEL = "A validated credit model with default history. Without one, PD, EAD and LGD are not calculated.";
const ASSET_VALUES = "Insured sums and asset replacement values for every asset class.";
const METERED = "Metered consumption history (water or electricity bills by month).";
const PRODUCTION = "Production or attendance records by day or month.";
const FORECAST_30 = "A sub-seasonal (30-day) or seasonal forecast feed. Only the 16-day forecast is integrated.";
const STREAMING = "Continuous monitoring with notifications. Reports are generated on request, not streamed.";

const entries: Array<[CategoryId, string, CatalogueStatus]> = [
  ["business", "MSME 360° Profile Report", core("msme_360")],
  ["business", "Business & Ownership Profile", within("msme_360", "Business profile")],
  ["business", "MSME Classification Report", within("msme_360", "Business profile")],
  ["business", "Business Operations Report", within("operational_vulnerability", "Operating pattern and dependencies")],
  ["business", "Revenue & Customer Profile", within("revenue_at_risk", "Revenue baseline")],
  ["business", "Workforce Profile", within("operational_vulnerability", "Workforce exposure")],
  ["business", "Asset & Infrastructure Profile", needs(ASSET_VALUES)],
  ["business", "Business Dependency Report", within("operational_vulnerability", "Operating pattern and dependencies")],
  ["business", "Historical Business Performance Report", within("revenue_at_risk", "Revenue and weather history")],

  ["climate", "Climate Exposure Assessment", core("climate_exposure")],
  ["climate", "Heat Exposure Report", within("climate_exposure", "Extreme heat")],
  ["climate", "Flood Exposure Report", within("climate_exposure", "Flood and heavy rain")],
  ["climate", "Extreme Rainfall Exposure", within("climate_exposure", "Flood and heavy rain")],
  ["climate", "Drought / Water-Stress Exposure", within("climate_exposure", "Drought and water stress")],
  ["climate", "Cyclone Exposure", within("climate_exposure", "Storm and wind")],
  ["climate", "Extreme Weather Exposure", within("climate_exposure", "Hazard overview")],
  ["climate", "Geographic Climate Risk Report", within("climate_exposure", "Regional context")],
  ["climate", "Climate Hazard Frequency Report", within("climate_exposure", "Long-term climate change")],
  ["climate", "Climate Vulnerability Map", needs(PORTFOLIO)],
  ["climate", "Climate Risk Hotspot Report", needs(PORTFOLIO)],

  ["financial", "Climate-Adjusted Financial Risk Report", core("climate_adjusted_financial_risk")],
  ["financial", "Financial Health Report", within("climate_adjusted_financial_risk", "Financial baseline")],
  ["financial", "Cash-Flow Risk Report", within("stress_test", "Liquidity under stress")],
  ["financial", "Revenue Volatility Report", within("revenue_at_risk", "Revenue and weather history")],
  ["financial", "Profitability Risk Report", within("climate_adjusted_financial_risk", "Financial baseline")],
  ["financial", "Working Capital Risk Report", within("climate_adjusted_financial_risk", "Financial baseline")],
  ["financial", "Liquidity Risk Report", within("stress_test", "Liquidity under stress")],
  ["financial", "Debt-Service Risk Report", within("climate_adjusted_financial_risk", "Debt-service pressure")],
  ["financial", "Credit Risk Report", needs(CREDIT_MODEL)],
  ["financial", "Climate-Adjusted Credit Risk Report", within("climate_adjusted_financial_risk", "Risk dimensions")],
  ["financial", "Financial Resilience Report", within("resilience", "Resilience dimensions")],

  ["revenue", "Revenue-at-Risk Report", core("revenue_at_risk")],
  ["revenue", "Revenue Volatility Analysis", within("revenue_at_risk", "Revenue and weather history")],
  ["revenue", "Climate vs Revenue Correlation", within("revenue_at_risk", "Revenue and weather history")],
  ["revenue", "Revenue Loss During Climate Events", within("revenue_at_risk", "Revenue and weather history")],
  ["revenue", "Historical Climate Impact on Revenue", within("revenue_at_risk", "Revenue and weather history")],
  ["revenue", "Climate-Adjusted Revenue Forecast", needs("A validated revenue forecasting model and at least 24 months of history.")],
  ["revenue", "Seasonal Revenue Risk", within("revenue_at_risk", "Seasonality")],
  ["revenue", "Extreme-Event Revenue Impact", within("revenue_at_risk", "Revenue at risk by scenario")],
  ["revenue", "Revenue Recovery Analysis", within("operational_vulnerability", "Past incidents")],

  ["operational", "Operational Risk Assessment", core("operational_vulnerability")],
  ["operational", "Production Disruption Report", within("operational_vulnerability", "Impact pathways")],
  ["operational", "Productivity Impact Report", needs(PRODUCTION)],
  ["operational", "Worker Heat-Stress Impact", within("operational_vulnerability", "Workforce exposure")],
  ["operational", "Factory Vulnerability Report", within("operational_vulnerability", "Impact pathways")],
  ["operational", "Equipment Vulnerability Report", within("operational_vulnerability", "Operating pattern and dependencies")],
  ["operational", "Business Continuity Report", within("resilience", "Resilience dimensions")],
  ["operational", "Operational Downtime Report", within("operational_vulnerability", "Downtime tolerance")],
  ["operational", "Recovery-Time Analysis", within("operational_vulnerability", "Past incidents")],
  ["operational", "Capacity-at-Risk Report", within("stress_test", "Scenario results")],

  ["workforce", "Workforce Climate Exposure", within("operational_vulnerability", "Workforce exposure")],
  ["workforce", "Heat Productivity Impact", needs(PRODUCTION)],
  ["workforce", "Employee Absenteeism Risk", needs(PRODUCTION)],
  ["workforce", "Heat-Stress Risk", within("climate_exposure", "Extreme heat")],
  ["workforce", "Worker Safety Exposure", within("operational_vulnerability", "Workforce exposure")],
  ["workforce", "Labour Productivity Trend", needs(PRODUCTION)],
  ["workforce", "Workforce Resilience Report", within("resilience", "Resilience dimensions")],
  ["workforce", "Climate-Related Workforce Cost Report", needs(PRODUCTION)],

  ["supply_chain", "Climate-Adjusted Supply Chain Risk Report", core("supply_chain")],
  ["supply_chain", "Supplier Risk Assessment", within("supply_chain", "Supplier register")],
  ["supply_chain", "Supply-Chain Climate Exposure", within("supply_chain", "Supplier register")],
  ["supply_chain", "Critical Supplier Risk", within("supply_chain", "Supplier register")],
  ["supply_chain", "Supplier Geographic Exposure", needs("Geocoded supplier locations. Supplier locations are currently free text.")],
  ["supply_chain", "Raw Material Vulnerability", within("supply_chain", "Supplier register")],
  ["supply_chain", "Inventory Buffer Analysis", within("supply_chain", "Buffers and switching time")],
  ["supply_chain", "Logistics Disruption Risk", within("operational_vulnerability", "Impact pathways")],
  ["supply_chain", "Transportation Exposure", within("climate_exposure", "Flood and heavy rain")],
  ["supply_chain", "Supply-Chain Concentration Report", within("supply_chain", "Concentration")],
  ["supply_chain", "Alternative Supplier Readiness", within("supply_chain", "Buffers and switching time")],
  ["supply_chain", "Supply-Chain Resilience Score", within("resilience", "Resilience dimensions")],

  ["resources", "Water Dependency Report", within("operational_vulnerability", "Operating pattern and dependencies")],
  ["resources", "Water Stress Exposure", within("climate_exposure", "Drought and water stress")],
  ["resources", "Water Availability Risk", within("stress_test", "Scenario results")],
  ["resources", "Water Consumption Analysis", needs(METERED)],
  ["resources", "Water Resilience Report", within("adaptation_plan", "Prioritised measures")],
  ["resources", "Energy Dependency Report", within("operational_vulnerability", "Utility reliability")],
  ["resources", "Electricity Consumption Analysis", needs(METERED)],
  ["resources", "Energy Cost Risk", needs(METERED)],
  ["resources", "Heat-Driven Energy Demand", needs(METERED)],
  ["resources", "Power Outage Exposure", within("operational_vulnerability", "Utility reliability")],
  ["resources", "Renewable Energy Resilience Report", needs("On-site generation and storage details.")],

  ["insurance", "Insurance Coverage Report", within("climate_adjusted_financial_risk", "Insurance position")],
  ["insurance", "Insurance Adequacy Assessment", needs(ASSET_VALUES)],
  ["insurance", "Property Risk Coverage", needs(ASSET_VALUES)],
  ["insurance", "Machinery Risk Coverage", needs(ASSET_VALUES)],
  ["insurance", "Business Interruption Coverage", within("stress_test", "Scenario results")],
  ["insurance", "Climate Insurance Gap", needs(ASSET_VALUES)],
  ["insurance", "Uninsured Loss Exposure", within("stress_test", "Scenario results")],
  ["insurance", "Insurance Readiness Report", within("resilience", "Resilience dimensions")],

  ["scenarios", "Climate Stress-Test Report", core("stress_test")],
  ["scenarios", "Scenario A — Moderate Heatwave", within("stress_test", "Scenario results")],
  ["scenarios", "Scenario B — Severe Heatwave", within("stress_test", "Scenario results")],
  ["scenarios", "Scenario C — Severe Flood", within("stress_test", "Scenario results")],
  ["scenarios", "Scenario D — Combined Shock", within("stress_test", "Scenario results")],

  ["forecast", "7-Day Climate Risk Outlook", within("climate_exposure", "Forecast outlook")],
  ["forecast", "Climate Risk Forecast", within("climate_exposure", "Forecast outlook")],
  ["forecast", "30-Day Risk Outlook", needs(FORECAST_30)],
  ["forecast", "Seasonal Risk Forecast", needs(FORECAST_30)],
  ["forecast", "Extreme Heat Warning", within("climate_exposure", "Official warnings")],
  ["forecast", "Flood Risk Warning", within("climate_exposure", "Official warnings")],
  ["forecast", "Supply-Chain Disruption Warning", needs(STREAMING)],
  ["forecast", "Revenue-at-Risk Forecast", needs("A validated revenue forecasting model.")],
  ["forecast", "Early Warning Report", within("climate_exposure", "Official warnings")],
  ["forecast", "Climate Risk Trend Report", within("climate_exposure", "Long-term climate change")],

  ["alerts", "Climate threshold breached", within("climate_exposure", "Forecast outlook")],
  ["alerts", "Flood / heatwave warning", within("climate_exposure", "Official warnings")],
  ["alerts", "Revenue, production or cash-flow anomaly alerts", needs(STREAMING)],
  ["alerts", "Supplier disruption and inventory shortage alerts", needs(STREAMING)],
  ["alerts", "Debt-service stress alert", within("climate_adjusted_financial_risk", "Debt-service pressure")],

  ["resilience", "Overall Business Resilience Report", core("resilience")],
  ["resilience", "Climate Resilience Score", within("resilience", "Resilience dimensions")],
  ["resilience", "Financial Resilience Score", within("resilience", "Resilience dimensions")],
  ["resilience", "Operational Resilience Score", within("resilience", "Resilience dimensions")],
  ["resilience", "Supply-Chain Resilience Score", within("resilience", "Resilience dimensions")],
  ["resilience", "Infrastructure Resilience Score", needs(ASSET_VALUES)],
  ["resilience", "Workforce Resilience Score", within("resilience", "Resilience dimensions")],

  ["lender", "Climate-Adjusted Credit Assessment", within("climate_adjusted_financial_risk", "Risk dimensions")],
  ["lender", "Borrower Climate Risk Report", within("msme_360", "Indicators")],
  ["lender", "Climate Stress-Test Report", within("stress_test", "Scenario results")],
  ["lender", "Borrower Resilience Report", within("resilience", "Resilience dimensions")],
  ["lender", "Probability-of-Default Risk Assessment", needs(CREDIT_MODEL)],
  ["lender", "Exposure-at-Default Analysis", needs(CREDIT_MODEL)],
  ["lender", "Loss-Given-Climate-Event Analysis", needs(CREDIT_MODEL)],
  ["lender", "Climate-Adjusted Loan Risk Report", needs("Loan terms (amount, tenor, schedule) and a validated credit model.")],
  ["lender", "Loan Portfolio Climate Exposure", needs(PORTFOLIO)],
  ["lender", "Sector Climate Risk Report", needs(PEERS)],
  ["lender", "Geographic Credit Risk Report", needs(PORTFOLIO)],

  ["financing", "Repayment Stress Analysis", within("stress_test", "Liquidity under stress")],
  ["financing", "Climate Adaptation Financing Requirement", within("adaptation_plan", "Investment summary")],
  ["financing", "Recommended Monitoring Frequency", within("climate_adjusted_financial_risk", "Monitoring")],
  ["financing", "Working Capital Requirement", within("climate_adjusted_financial_risk", "Financial baseline")],
  ["financing", "Loan Eligibility Support Report", needs("Lender eligibility criteria and loan terms. The platform never decides eligibility.")],
  ["financing", "Climate-Adjusted Loan Assessment", needs("Loan terms and a validated credit model.")],
  ["financing", "Financing Requirement Report", needs("Business plan and financing request details.")],
  ["financing", "Loan Tenure Risk Assessment", needs("Loan tenor and repayment schedule.")],
  ["financing", "Climate-Linked Financing Assessment", needs("Product terms from a lender.")],

  ["adaptation", "Climate Adaptation Plan", core("adaptation_plan")],
  ["adaptation", "Climate Investment Priority Report", within("adaptation_plan", "Prioritised measures")],
  ["adaptation", "Resilience Investment Plan", within("adaptation_plan", "Investment summary")],
  ["adaptation", "Infrastructure Improvement Plan", within("adaptation_plan", "Prioritised measures")],
  ["adaptation", "Water Resilience Plan", within("adaptation_plan", "Prioritised measures")],
  ["adaptation", "Supply-Chain Diversification Plan", within("supply_chain", "Actions")],
  ["adaptation", "Insurance Improvement Plan", within("adaptation_plan", "Prioritised measures")],
  ["adaptation", "Adaptation Cost-Benefit Analysis", needs("Measure effectiveness data. Without it, avoided losses and payback are not estimated.")],
  ["adaptation", "Energy Transition Plan", needs(METERED)],

  ["actions", "Priority Action Plan", within("adaptation_plan", "Action timeline")],
  ["actions", "30-Day Action Plan", within("adaptation_plan", "Action timeline")],
  ["actions", "90-Day Resilience Plan", within("adaptation_plan", "Action timeline")],
  ["actions", "1-Year Climate Adaptation Roadmap", within("adaptation_plan", "Action timeline")],
  ["actions", "Risk Mitigation Recommendations", within("msme_360", "Recommended actions")],
  ["actions", "Risk-to-Action Report", within("adaptation_plan", "Prioritised measures")],
  ["actions", "Management Recommendations", within("executive_one_page", "Top actions")],
  ["actions", "Cost-Priority Matrix", within("adaptation_plan", "Investment summary")],

  ["benchmarking", "Industry Benchmark Report", needs(PEERS)],
  ["benchmarking", "Regional Benchmark Report", needs(PEERS)],
  ["benchmarking", "Climate Resilience Benchmark", needs(PEERS)],
  ["benchmarking", "Financial Resilience Benchmark", needs(PEERS)],
  ["benchmarking", "Peer Risk Comparison", needs(PEERS)],
  ["benchmarking", "Sector Risk Comparison", needs(PEERS)],

  ["geographic", "Geographic Climate Exposure (site)", within("climate_exposure", "Regional context")],
  ["geographic", "District / State-wise Risk", needs(PORTFOLIO)],
  ["geographic", "Industrial Cluster Risk", needs(PORTFOLIO)],
  ["geographic", "Climate Risk Heatmap and Portfolio Exposure Map", needs(PORTFOLIO)],
  ["geographic", "Climate Risk Concentration Report", needs(PORTFOLIO)],

  ["portfolio", "MSME Climate Risk Portfolio", needs(PORTFOLIO)],
  ["portfolio", "Total Climate-Exposed Loan Book", needs(PORTFOLIO)],
  ["portfolio", "High-Risk Borrower Report", needs(PORTFOLIO)],
  ["portfolio", "Portfolio Stress Test", needs(PORTFOLIO)],
  ["portfolio", "Portfolio Revenue-at-Risk", needs(PORTFOLIO)],
  ["portfolio", "Portfolio Expected Loss", needs(CREDIT_MODEL)],
  ["portfolio", "Climate Risk Migration / Borrower Risk Movement", needs(PORTFOLIO)],

  ["esg", "Climate Exposure Disclosure (single business)", within("climate_exposure", "Hazard overview")],
  ["esg", "Climate Risk Disclosure / Regulatory Reporting Pack", needs("A chosen disclosure framework and legal review. Compliance is not claimed.")],
  ["esg", "ESG Risk Report", needs("Social and governance data, which are not collected.")],
  ["esg", "Green / Sustainable Financing Report", needs("Taxonomy eligibility criteria from a lender.")],

  ["audit", "Data Completeness Report", within("msme_360", "Data quality and coverage")],
  ["audit", "Missing Data Report", within("msme_360", "Data quality and coverage")],
  ["audit", "Data Source Verification", within("msme_360", "Sources")],
  ["audit", "Data Freshness Report", within("msme_360", "Sources")],
  ["audit", "Calculation Audit Report", within("climate_adjusted_financial_risk", "Methodology")],
  ["audit", "Risk Score Audit Trail", within("msme_360", "Indicators")],
  ["audit", "Model Input Report", within("msme_360", "Data quality and coverage")],
  ["audit", "Historical Data Changes", needs("Comparison across input versions; report versions can already be compared in the viewer.")],

  ["ai", "AI Business Risk Summary", within("msme_360", "Executive summary")],
  ["ai", "AI Climate Risk Explanation", within("climate_exposure", "Executive summary")],
  ["ai", "AI Financial Risk Explanation", within("climate_adjusted_financial_risk", "Executive summary")],
  ["ai", "AI Executive Summary / Lender Brief", within("executive_one_page", "Executive summary")],
  ["ai", "AI MSME Improvement Plan", within("adaptation_plan", "Executive summary")],
  ["ai", "AI Scenario Analysis", within("stress_test", "Executive summary")],
  ["ai", "AI Risk Q&A Report", needs("An interactive question-answering interface over the report snapshot.")],

  ["executive", "One-Page Climate Risk Report", core("executive_one_page")],
];

export const CATALOGUE: CatalogueEntry[] = entries.map(([category, name, status]) => ({ category, name, status }));
