import Link from "next/link";
import { orgRows } from "@/lib/data/queries";

export default async function AssessmentsPage() {
  const result = await orgRows<{ id: string; status: string; score: number | null; evidence_completeness: number | null; created_at: string }>(
    "risk_assessments",
    "id,status,score,evidence_completeness,created_at",
  );
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">Assessments</h1>
        <Link className="font-semibold underline" href="/dashboard#assessment">New assessment</Link>
      </div>
      {result.rows.length === 0 ? <p className="mt-4 text-sm">No saved assessments.</p> : null}
      <ul className="mt-4 space-y-3">
        {result.rows.map((assessment) => (
          <li key={assessment.id}>
            <Link className="font-semibold underline" href={`/assessments/${assessment.id}`}>{assessment.id}</Link>
            <p className="text-sm">{assessment.status} · score {assessment.score ?? "not shown"} · completeness {assessment.evidence_completeness ?? "—"}% · {assessment.created_at}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
