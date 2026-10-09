import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreChart } from "@/components/assessments/score-chart";
import { ReportView } from "@/components/report/report-view";
import { Card } from "@/components/ui/primitives";
import { workspaceContext } from "@/lib/data/queries";
import type { ReportModel } from "@/lib/reports/model";

function storedModel(content: unknown): ReportModel | null {
  const detail = (content as { detail?: ReportModel } | null)?.detail;
  return detail && detail.version === 1 && detail.result?.score ? detail : null;
}

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await workspaceContext();
  if (!context.supabase) return <p>Database not configured.</p>;
  const [{ data: assessment }, { data: components }, { data: hazards }, { data: recommendations }, { data: report }] = await Promise.all([
    context.supabase.from("risk_assessments").select("id,business_id,status,score,score_band,evidence_completeness,limitations,change_explanation,methodology_version,created_at").eq("id", id).maybeSingle(),
    context.supabase.from("risk_component_scores").select("component,score,included,explanation").eq("assessment_id", id),
    context.supabase.from("hazard_indicators").select("hazard_type,status,summary,score").eq("assessment_id", id),
    context.supabase.from("assessment_recommendations").select("priority,action,verification_metric").eq("assessment_id", id),
    context.supabase.from("generated_reports").select("content").eq("assessment_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!assessment) notFound();
  const model = storedModel(report?.content);
  if (model) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-4xl">Assessment result</h1>
          <span className="flex gap-4">
            <Link className="text-sm font-semibold text-brand-700 underline" href={`/businesses/${assessment.business_id}`}>AI reports for this business</Link>
            <Link className="text-sm underline" href={`/assessments/${id}/report`}>Printable report</Link>
          </span>
        </div>
        <ReportView report={model} mode="saved" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">Assessment</h1>
      <Card>
        <p className="text-sm">{assessment.status} · {assessment.methodology_version}</p>
        <p className="mt-2 text-4xl">{assessment.score ?? "No score"}</p>
        <p>{assessment.score_band}</p>
        <p className="mt-2 text-sm">Evidence completeness {assessment.evidence_completeness}% — shown separately from the score.</p>
        <p className="mt-2 text-sm">{Array.isArray(assessment.limitations) ? assessment.limitations.join(" ") : ""}</p>
        <p className="mt-2 text-sm text-muted">The detailed report with satellite view, regional context and financial scenarios is available to owner, admin and analyst roles, or for assessments run after the detailed report was introduced.</p>
        <Link className="mt-3 inline-block underline" href={`/assessments/${id}/report`}>Open report</Link>
      </Card>
      <Card>
        <h2 className="text-2xl">Why this score</h2>
        <ScoreChart rows={(components ?? []).map((component) => ({ name: component.component, score: component.score }))} />
        <ul className="mt-3 space-y-2 text-sm">
          {(components ?? []).map((component) => (
            <li key={component.component}>{component.component}: {component.included ? component.score : "excluded"} — {component.explanation}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-2xl">Hazards</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(hazards ?? []).map((hazard) => (
            <li key={hazard.hazard_type}><strong>{hazard.hazard_type}</strong> · {hazard.status} · {hazard.summary}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-2xl">Next steps</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(recommendations ?? []).map((item) => (
            <li key={item.action}><strong>{item.priority}.</strong> {item.action} Check: {item.verification_metric}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
