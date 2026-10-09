import Link from "next/link";
import { Building2, FilePen, LoaderCircle, MapPin, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { businessList } from "@/lib/businesses/queries";
import { formatDateTime } from "@/lib/datetime";
import { REPORT_TYPES } from "@/lib/intelligence/catalogue";
import { STEPS } from "@/lib/questionnaire/registry";

const STEP_NUMBER = new Map(STEPS.map((step) => [step.id, step.number]));

export const metadata = { title: "Your businesses" };

const NEW_BUSINESS = "/businesses/new";

export default async function BusinessesPage() {
  const data = await businessList();
  if (data.state !== "ready") {
    return <Card><p className="text-sm">{data.state === "unconfigured" ? "Supabase is not configured, so businesses cannot be stored." : "Sign in to see your businesses."}</p></Card>;
  }
  const { businesses, draft } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Your businesses</h1>
          <p className="mt-1 text-sm text-muted">Each business gets a climate analysis and a full set of AI reports.</p>
        </div>
        {businesses.length ? (
          <Link href={NEW_BUSINESS} prefetch={false} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus aria-hidden className="h-4 w-4" /> Create new business
          </Link>
        ) : null}
      </div>
      {data.message ? <p className="text-sm text-warn-700">Businesses could not be loaded: {data.message}</p> : null}

      {draft ? (
        <Link href={NEW_BUSINESS} prefetch={false} className="group block">
          <Card className="flex flex-wrap items-center gap-4 border-dashed group-hover:-translate-y-0.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-100 text-warn-700"><FilePen aria-hidden className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{draft.name ?? "Unnamed business"} <Badge tone="warn">Draft</Badge></p>
              <p className="text-sm text-muted">
                Saved {formatDateTime(draft.savedAt)}
                {draft.currentStep ? ` · stopped at step ${STEP_NUMBER.get(draft.currentStep) ?? "?"} of ${STEPS.length}` : ""}. Not submitted yet, so no reports.
              </p>
            </div>
            <span className="text-sm font-semibold text-brand-600">Continue draft →</span>
          </Card>
        </Link>
      ) : null}

      {businesses.length === 0 && draft ? null : businesses.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Building2 aria-hidden className="h-7 w-7" /></span>
          <div>
            <h2 className="text-2xl">No business yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted">Fill in the business form once. The climate analysis runs on its own and all {REPORT_TYPES.length} AI reports are generated when it finishes.</p>
          </div>
          <Link href={NEW_BUSINESS} prefetch={false} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus aria-hidden className="h-4 w-4" /> Create new business
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {businesses.map((business) => (
            <Link key={business.id} href={`/businesses/${business.id}`} className="group">
              <Card className="h-full group-hover:-translate-y-0.5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Building2 aria-hidden className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl">{business.name}</h2>
                    {business.industry ? <p className="truncate text-sm text-muted">{business.industry}</p> : null}
                    {business.place ? <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin aria-hidden className="h-3.5 w-3.5" />{business.place}</p> : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {business.analysing ? (
                    <Badge><LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" /> Analysing</Badge>
                  ) : business.reportsPending ? (
                    <Badge><LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" /> Generating reports</Badge>
                  ) : business.analysisFailed ? (
                    <Badge tone="warn">Analysis failed</Badge>
                  ) : null}
                  {data.canSeeReports ? <Badge tone={business.reportsReady ? "ok" : "neutral"}>{business.reportsReady} of {REPORT_TYPES.length} reports ready</Badge> : null}
                  <span className="ml-auto text-sm font-semibold text-brand-600">Open →</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
