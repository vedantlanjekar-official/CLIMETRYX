import type { IndustryBranch, Option } from "@/lib/questionnaire/types";

/**
 * Activity list grouped by ISIC Rev.4 section (India's NIC 2008 uses the same
 * section letters). Branches decide which industry-specific questions appear.
 */
export interface Activity {
  value: string;
  label: string;
  isicSection: string;
  branches: IndustryBranch[];
}

export const ISIC_SECTIONS: Record<string, string> = {
  A: "Agriculture, forestry and fishing",
  C: "Manufacturing",
  F: "Construction",
  G: "Wholesale and retail trade",
  H: "Transportation and storage",
  I: "Accommodation and food service",
  J: "Information and communication",
  M: "Professional, scientific and technical",
  N: "Administrative and support services",
  Q: "Human health and social work",
  S: "Other service activities",
};

export const ACTIVITIES: Activity[] = [
  { value: "crop_farming", label: "Crop farming", isicSection: "A", branches: ["agriculture", "outdoor_work", "water_intensive"] },
  { value: "horticulture", label: "Horticulture, fruit and vegetables", isicSection: "A", branches: ["agriculture", "outdoor_work", "water_intensive"] },
  { value: "dairy_livestock", label: "Dairy and livestock", isicSection: "A", branches: ["agriculture", "outdoor_work", "water_intensive"] },
  { value: "poultry", label: "Poultry", isicSection: "A", branches: ["agriculture", "water_intensive"] },
  { value: "aquaculture", label: "Aquaculture and fishing", isicSection: "A", branches: ["agriculture", "outdoor_work", "water_intensive"] },
  { value: "food_processing", label: "Food and beverage processing", isicSection: "C", branches: ["manufacturing", "food_cold_chain", "water_intensive"] },
  { value: "bakery_confectionery", label: "Bakery and confectionery", isicSection: "C", branches: ["manufacturing", "food_cold_chain"] },
  { value: "pharmaceuticals", label: "Pharmaceuticals and medical products", isicSection: "C", branches: ["manufacturing", "food_cold_chain"] },
  { value: "textiles_apparel", label: "Textiles and apparel", isicSection: "C", branches: ["manufacturing", "water_intensive"] },
  { value: "leather", label: "Leather and footwear", isicSection: "C", branches: ["manufacturing", "water_intensive"] },
  { value: "chemicals_plastics", label: "Chemicals, rubber and plastics", isicSection: "C", branches: ["manufacturing", "water_intensive"] },
  { value: "metal_fabrication", label: "Metal fabrication and machining", isicSection: "C", branches: ["manufacturing"] },
  { value: "auto_components", label: "Automotive components", isicSection: "C", branches: ["manufacturing"] },
  { value: "electronics_assembly", label: "Electronics assembly", isicSection: "C", branches: ["manufacturing"] },
  { value: "furniture_wood", label: "Furniture and wood products", isicSection: "C", branches: ["manufacturing"] },
  { value: "printing_packaging", label: "Printing and packaging", isicSection: "C", branches: ["manufacturing"] },
  { value: "brick_ceramics", label: "Bricks, ceramics and building materials", isicSection: "C", branches: ["manufacturing", "outdoor_work"] },
  { value: "construction_contracting", label: "Construction contracting", isicSection: "F", branches: ["construction", "outdoor_work"] },
  { value: "grocery_retail", label: "Grocery and food retail", isicSection: "G", branches: ["retail", "food_cold_chain"] },
  { value: "pharmacy_retail", label: "Pharmacy retail", isicSection: "G", branches: ["retail", "food_cold_chain"] },
  { value: "general_retail", label: "General or specialist retail", isicSection: "G", branches: ["retail"] },
  { value: "wholesale_distribution", label: "Wholesale distribution", isicSection: "G", branches: ["retail", "logistics"] },
  { value: "fuel_retail", label: "Fuel and gas retail", isicSection: "G", branches: ["retail"] },
  { value: "road_freight", label: "Road freight and courier", isicSection: "H", branches: ["logistics", "outdoor_work"] },
  { value: "warehousing", label: "Warehousing and storage", isicSection: "H", branches: ["logistics"] },
  { value: "cold_storage", label: "Cold storage", isicSection: "H", branches: ["logistics", "food_cold_chain"] },
  { value: "restaurant_catering", label: "Restaurant and catering", isicSection: "I", branches: ["hospitality", "food_cold_chain"] },
  { value: "hotel_lodging", label: "Hotel and lodging", isicSection: "I", branches: ["hospitality", "water_intensive"] },
  { value: "software_it", label: "Software and IT services", isicSection: "J", branches: ["it_services"] },
  { value: "telecom_services", label: "Telecom and internet services", isicSection: "J", branches: ["it_services"] },
  { value: "professional_services", label: "Professional and consulting services", isicSection: "M", branches: ["it_services"] },
  { value: "facility_services", label: "Facility, cleaning and security services", isicSection: "N", branches: ["outdoor_work"] },
  { value: "clinic_diagnostics", label: "Clinic, laboratory or diagnostics", isicSection: "Q", branches: ["healthcare", "food_cold_chain"] },
  { value: "laundry_dry_cleaning", label: "Laundry and dry cleaning", isicSection: "S", branches: ["water_intensive"] },
  { value: "repair_services", label: "Repair and maintenance services", isicSection: "S", branches: [] },
  { value: "other", label: "Other activity", isicSection: "S", branches: [] },
];

export function activityOptions(): Option[] {
  return ACTIVITIES.map((activity) => ({
    value: activity.value,
    label: activity.label,
    help: `ISIC section ${activity.isicSection} · ${ISIC_SECTIONS[activity.isicSection] ?? ""}`,
  }));
}

export function findActivity(value: unknown): Activity | null {
  return ACTIVITIES.find((activity) => activity.value === value) ?? null;
}
