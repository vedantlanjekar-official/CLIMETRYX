import registry from "@/metadata/source-registry.json";
import { publicConfigStatus } from "@/lib/config/env";
import { Badge, Card } from "@/components/ui/primitives";

export default function SourcesPage() {
  const config = publicConfigStatus();
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">Data sources</h1>
      <p className="max-w-2xl text-sm">Status values describe implementation and verification. An adapter file is not treated as a live connection.</p>
      <Card>
        <p className="text-sm">Open-Meteo runtime: {config.openMeteo.detail}</p>
        <p className="text-sm">Copernicus runtime: {config.copernicus.detail}</p>
      </Card>
      <ul className="space-y-3">
        {registry.sources.map((source) => (
          <li key={source.id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl">{source.name}</h2>
                <Badge tone={source.status === "verified" ? "ok" : "warn"}>{source.status}</Badge>
              </div>
              <p className="mt-2 text-sm">
                {"limitations" in source ? source.limitations : ""}
                {"verification" in source ? ` ${source.verification}` : ""}
              </p>
              {source.docsUrl ? <p className="mt-2 text-sm"><a className="underline" href={source.docsUrl}>{source.docsUrl}</a></p> : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
