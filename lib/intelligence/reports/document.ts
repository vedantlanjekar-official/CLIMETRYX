import type { ReportSource } from "@/lib/reports/model";
import type { ReportType } from "../catalogue";
import type { DataGap, Metric } from "../types";

export interface ChartSeries {
  key: string;
  label: string;
  type?: "bar" | "line" | "area";
  axis?: "left" | "right";
  stack?: string;
}

export interface ChartSpec {
  id: string;
  kind: "bar" | "line" | "composed" | "horizontalBar" | "radar";
  title: string;
  unit: string;
  rightUnit?: string;
  period: string;
  source: string;
  explanation: string;
  xKey: string;
  series: ChartSeries[];
  data: Array<Record<string, string | number | null>>;
  referenceLines?: Array<{ value: number; label: string; axis?: "left" | "right" }>;
}

export interface TableSpec {
  id: string;
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string | number | null>>;
  note?: string;
}

export type CalloutTone = "info" | "warning" | "risk" | "positive";

export interface ReportSection {
  id: string;
  title: string;
  narrative: string | null;
  paragraphs: string[];
  bullets: string[];
  metrics: Metric[];
  charts: ChartSpec[];
  tables: TableSpec[];
  callouts: Array<{ tone: CalloutTone; text: string }>;
}

export interface ReportFinding {
  text: string;
  evidence: string[];
}

export interface ReportAction {
  priority: "high" | "medium" | "low";
  horizon: "now" | "30_days" | "90_days" | "12_months";
  action: string;
  rationale: string;
  evidence: string[];
}

export interface GenerationInfo {
  mode: "ai" | "rules";
  provider: string | null;
  model: string | null;
  fallbackReason: string | null;
  validationIssues: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
}

export interface IntelligenceReport {
  schemaVersion: 1;
  reportType: ReportType;
  title: string;
  category: string;
  audience: string[];
  businessName: string;
  siteLabel: string;
  generatedAt: string;
  dataAsOf: string;
  assessmentId: string;
  engineVersion: string;
  snapshotHash: string;
  status: "completed" | "completed_with_limitations";
  headline: string;
  executiveSummary: string[];
  keyFindings: ReportFinding[];
  keyMetrics: Metric[];
  sections: ReportSection[];
  recommendations: ReportAction[];
  methodology: string[];
  assumptions: string[];
  limitations: string[];
  dataGaps: DataGap[];
  sources: ReportSource[];
  disclaimer: string;
  generation: GenerationInfo;
}

export const DISCLAIMER =
  "Decision-support analysis prepared from business-reported data and public climate sources. It is not a probability of default, a credit rating, an insurance assessment or a lending decision, and it does not approve, reject or price any loan. Hypothetical scenarios are not predictions. A qualified person must review it before any financial decision.";

export const HORIZON_LABEL: Record<ReportAction["horizon"], string> = {
  now: "Now",
  "30_days": "Within 30 days",
  "90_days": "Within 90 days",
  "12_months": "Within 12 months",
};

export function section(id: string, title: string, parts: Partial<Omit<ReportSection, "id" | "title">> = {}): ReportSection {
  return { id, title, narrative: null, paragraphs: [], bullets: [], metrics: [], charts: [], tables: [], callouts: [], ...parts };
}
