import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AssessmentWorkspace } from "@/components/assessment/assessment-workspace";
import { loadInitialDraft } from "@/lib/assessments/draft-state";
import "@/components/assessment/assessment.css";

export const metadata = { title: "Create new business" };
/** Submitting runs the climate analysis and all AI reports in the background of this request. */
export const maxDuration = 300;

export default async function NewBusinessPage() {
  const initial = await loadInitialDraft({ newBusiness: true });
  return (
    <div className="space-y-6">
      <div className="space-y-2 px-5 sm:px-8 lg:px-12">
        <Link href="/businesses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft aria-hidden className="h-4 w-4" /> Your businesses</Link>
        <h1 className="text-3xl">Create new business</h1>
        <p className="text-sm text-muted">Answer the questions below and submit. The climate analysis and all AI reports are then generated automatically.</p>
      </div>
      <section className="ax ax-page" aria-label="New business form">
        <AssessmentWorkspace initial={initial} />
      </section>
    </div>
  );
}
