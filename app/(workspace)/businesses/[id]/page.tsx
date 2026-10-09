import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { JobStatusView } from "@/components/assessment/job-status";
import { BusinessReports } from "@/components/businesses/business-reports";
import { RefreshData } from "@/components/businesses/refresh-data";
import { Card } from "@/components/ui/primitives";
import { isTerminal } from "@/lib/assessments/job";
import { businessDetail } from "@/lib/businesses/queries";
import { formatDate } from "@/lib/datetime";
import "@/components/assessment/assessment.css";

export const metadata = { title: "Business" };
/** Regenerating reports runs in the background of this request. */
export const maxDuration = 300;

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await businessDetail(id);
  if (!detail) notFound();
  const back = <Link href="/businesses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft aria-hidden className="h-4 w-4" /> Your businesses</Link>;
  if ("error" in detail) return <div className="space-y-4">{back}<Card><p className="text-sm">{detail.error}</p></Card></div>;

  const { business, job, reports, assessmentId, canSeeReports } = detail;
  const analysing = Boolean(job && !isTerminal(job.status));

  return (
    <div className="space-y-6">
      {back}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{business.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[business.industry, `Added ${formatDate(business.createdAt)}`].filter(Boolean).join(" · ")}
          </p>
          {business.place ? <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin aria-hidden className="h-4 w-4" />{business.place}</p> : null}
        </div>
        {!analysing ? (
          <div className="flex flex-wrap items-center gap-4">
            {assessmentId ? <Link href={`/assessments/${assessmentId}`} className="text-sm font-semibold text-brand-700 underline">Climate analysis details</Link> : null}
            <Link href={`/businesses/${business.id}/edit`} className="text-sm font-semibold text-brand-700 underline">Update answers</Link>
            {assessmentId ? <RefreshData businessId={business.id} /> : null}
          </div>
        ) : null}
      </header>

      {job && (analysing || job.status === "failed") ? (
        <Card className="ax p-0">
          <JobStatusView initial={job} />
        </Card>
      ) : null}

      {!canSeeReports ? (
        <Card><p className="text-sm">AI reports include restricted financial figures and are available to owner, admin and analyst roles only.</p></Card>
      ) : analysing && !reports.length ? null : (
        <BusinessReports reports={reports} assessmentId={analysing ? null : assessmentId} />
      )}
      {!analysing && job?.result?.warnings?.length ? (
        <Card>
          <p className="text-sm font-semibold">Recorded limitations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {job.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
