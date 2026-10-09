import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AssessmentWorkspace } from "@/components/assessment/assessment-workspace";
import { Card } from "@/components/ui/primitives";
import { loadInitialDraft } from "@/lib/assessments/draft-state";
import "@/components/assessment/assessment.css";

export const metadata = { title: "Update business answers" };
/** Submitting runs the climate analysis and all AI reports in the background of this request. */
export const maxDuration = 300;

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await loadInitialDraft({ businessId: id });
  return (
    <div className="space-y-6">
      <div className="space-y-2 px-5 sm:px-8 lg:px-12">
        <Link href={`/businesses/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft aria-hidden className="h-4 w-4" /> Back to the business</Link>
        <h1 className="text-3xl">Update answers{initial.businessName ? ` · ${initial.businessName}` : ""}</h1>
        <p className="text-sm text-muted">Change any answer and submit. A new input version is saved, the climate analysis runs again and the reports are regenerated; earlier versions and reports are kept.</p>
      </div>
      {initial.businessId === id ? (
        <section className="ax ax-page" aria-label="Business answers form">
          <AssessmentWorkspace initial={initial} />
        </section>
      ) : (
        <div className="px-5 sm:px-8 lg:px-12">
          <Card>
            <p className="text-sm">{initial.notice ?? "Sign in to update this business."}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
