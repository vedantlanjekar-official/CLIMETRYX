import Link from "next/link";
import { Bot, ShieldAlert } from "lucide-react";
import { ReportsCentre } from "@/components/intelligence/reports-centre";
import { Badge, Card } from "@/components/ui/primitives";
import { aiStatus } from "@/lib/ai/openai";
import { reportsCentreData } from "@/lib/intelligence/queries";

export const metadata = { title: "AI Reports Centre" };
export const maxDuration = 300;

export default async function ReportsCentrePage({ searchParams }: { searchParams: Promise<{ assessment?: string | string[] }> }) {
  const { assessment } = await searchParams;
  const data = await reportsCentreData();
  const ai = aiStatus();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>AI Reports Centre</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Ten core reports built from one analytical snapshot of the assessment: the business answers, live and historical climate data, and deterministic risk, scenario and resilience engines. AI writes the narrative only; every figure, chart and table comes from the engines.
          </p>
        </div>
      </header>

      <Card className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Bot aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">AI narrative service</p>
            <p className="mt-1 text-sm text-muted">{ai.detail}</p>
          </div>
        </div>
        <Badge tone={ai.configured ? "ok" : "warn"}>{ai.configured ? `Configured · ${ai.model}` : "Not configured"}</Badge>
      </Card>

      {data.state === "unconfigured" ? <Notice text="The database is not configured, so reports cannot be generated or stored." /> : null}
      {data.state === "signed_out" ? <Notice text="Sign in to generate and view reports." /> : null}
      {data.state === "no_org" ? (
        <Notice text="No business workspace yet. Complete the assessment on the dashboard first.">
          <Link className="font-semibold text-brand-600 underline" href="/dashboard">Go to the dashboard</Link>
        </Notice>
      ) : null}
      {data.state === "forbidden" ? <Notice text={`Reports contain restricted financial figures and are available to owner, admin and analyst roles. Your role is ${data.role}.`} /> : null}
      {data.state === "ready" ? (
        data.assessments.length ? (
          <ReportsCentre
            assessments={data.assessments}
            reports={data.reports}
            initialAssessmentId={typeof assessment === "string" && data.assessments.some((item) => item.id === assessment) ? assessment : data.assessments[0]!.id}
            aiConfigured={ai.configured}
          />
        ) : (
          <Notice text="No completed assessment yet. Submit the assessment on the dashboard; reports are generated from its saved analysis.">
            <Link className="font-semibold text-brand-600 underline" href="/dashboard">Go to the dashboard</Link>
          </Notice>
        )
      ) : null}
      {data.state === "ready" && data.message ? <p className="text-sm text-danger-700">{data.message}</p> : null}
    </div>
  );
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warn-700" />
      <div className="space-y-2 text-sm">
        <p>{text}</p>
        {children}
      </div>
    </Card>
  );
}
