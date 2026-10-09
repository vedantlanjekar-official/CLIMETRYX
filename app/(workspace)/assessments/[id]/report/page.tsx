import { notFound } from "next/navigation";
import { workspaceContext } from "@/lib/data/queries";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await workspaceContext();
  if (!context.supabase) return <p>Database not configured.</p>;
  const { data } = await context.supabase.from("generated_reports").select("content,created_at,version").eq("assessment_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!data) notFound();
  const content = data.content as { title?: string; sections?: Array<{ id: string; title: string; paragraphs: string[] }> };
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl">{content.title ?? "Report"}</h1>
      <p className="text-sm">Version {data.version} · {data.created_at}</p>
      <p className="text-sm"><a className="underline" href={`/api/reports/${id}/pdf`}>Download PDF</a> · <a className="underline" href={`/api/reports/${id}/csv`}>Download CSV</a></p>
      {(content.sections ?? []).map((section) => (
        <section key={section.id}>
          <h2 className="text-2xl">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 text-sm">{paragraph}</p>)}
        </section>
      ))}
    </article>
  );
}
