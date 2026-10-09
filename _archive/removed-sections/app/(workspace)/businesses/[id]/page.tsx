import { notFound } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { workspaceContext } from "@/lib/data/queries";

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await workspaceContext();
  if (!context.supabase) return <p>Database not configured.</p>;
  const { data } = await context.supabase.from("businesses").select("id,name,industry,city,products_services,challenges").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <Card>
      <h1 className="text-4xl">{data.name}</h1>
      <p className="mt-2 text-sm">{data.industry} · {data.city}</p>
      <p className="mt-4 text-sm">{data.products_services}</p>
      <p className="mt-2 text-sm">{data.challenges}</p>
    </Card>
  );
}
