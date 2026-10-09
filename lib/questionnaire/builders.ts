import type { Option, QuestionDefinition } from "@/lib/questionnaire/types";

type QuestionInput = Omit<QuestionDefinition, "required" | "level" | "source" | "sensitivity" | "version" | "order" | "material" | "width"> &
  Partial<Pick<QuestionDefinition, "required" | "level" | "source" | "sensitivity" | "version" | "material" | "width">>;

/** Fills defaults. `order` is assigned by the registry from declaration order. */
export function q(input: QuestionInput): QuestionDefinition {
  return {
    required: false,
    level: "A",
    source: "business_reported",
    sensitivity: "internal",
    version: 1,
    material: false,
    width: "half",
    order: 0,
    ...input,
  };
}

export const opts = (pairs: Array<[string, string]>): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const MONTHS = opts([
  ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"], ["05", "May"], ["06", "June"],
  ["07", "July"], ["08", "August"], ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
]);

export const DEPENDENCY_LEVELS = opts([
  ["critical", "Critical: operations stop within an hour without it"],
  ["high", "High: operations degrade within a day"],
  ["moderate", "Moderate: workarounds last several days"],
  ["low", "Low: little effect on operations"],
  ["unknown", "Not sure"],
]);

export const EVIDENCE_TYPES = opts([
  ["records", "Written records or logs"],
  ["bills_or_invoices", "Bills, invoices or receipts"],
  ["insurance_claim", "Insurance claim or assessor report"],
  ["photos", "Dated photographs"],
  ["recollection", "Recollection, no records"],
  ["none", "No evidence available"],
]);

export const CURRENCIES = opts([
  ["INR", "INR · Indian rupee"],
  ["USD", "USD · US dollar"],
  ["EUR", "EUR · Euro"],
  ["GBP", "GBP · Pound sterling"],
  ["BDT", "BDT · Bangladeshi taka"],
  ["LKR", "LKR · Sri Lankan rupee"],
  ["NPR", "NPR · Nepalese rupee"],
  ["PKR", "PKR · Pakistani rupee"],
  ["AED", "AED · UAE dirham"],
  ["SGD", "SGD · Singapore dollar"],
  ["KES", "KES · Kenyan shilling"],
  ["NGN", "NGN · Nigerian naira"],
  ["ZAR", "ZAR · South African rand"],
  ["IDR", "IDR · Indonesian rupiah"],
  ["PHP", "PHP · Philippine peso"],
  ["VND", "VND · Vietnamese dong"],
  ["BRL", "BRL · Brazilian real"],
  ["MXN", "MXN · Mexican peso"],
]);

export const COUNTRIES = opts([
  ["IN", "India"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"], ["NP", "Nepal"], ["PK", "Pakistan"], ["BT", "Bhutan"],
  ["MV", "Maldives"], ["AF", "Afghanistan"], ["MM", "Myanmar"], ["TH", "Thailand"], ["VN", "Viet Nam"], ["KH", "Cambodia"],
  ["LA", "Lao PDR"], ["MY", "Malaysia"], ["SG", "Singapore"], ["ID", "Indonesia"], ["PH", "Philippines"], ["CN", "China"],
  ["JP", "Japan"], ["KR", "Republic of Korea"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["QA", "Qatar"],
  ["OM", "Oman"], ["KW", "Kuwait"], ["BH", "Bahrain"], ["EG", "Egypt"], ["KE", "Kenya"], ["TZ", "Tanzania"], ["UG", "Uganda"],
  ["ET", "Ethiopia"], ["RW", "Rwanda"], ["NG", "Nigeria"], ["GH", "Ghana"], ["SN", "Senegal"], ["ZA", "South Africa"],
  ["MA", "Morocco"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["FR", "France"], ["DE", "Germany"], ["NL", "Netherlands"],
  ["ES", "Spain"], ["IT", "Italy"], ["PT", "Portugal"], ["SE", "Sweden"], ["NO", "Norway"], ["FI", "Finland"], ["DK", "Denmark"],
  ["PL", "Poland"], ["US", "United States"], ["CA", "Canada"], ["MX", "Mexico"], ["BR", "Brazil"], ["AR", "Argentina"],
  ["CL", "Chile"], ["CO", "Colombia"], ["PE", "Peru"], ["AU", "Australia"], ["NZ", "New Zealand"],
]);

export const TRI_HELP = "Choose “Not sure” rather than guessing. Unknown answers are excluded from scoring, not treated as safe.";
