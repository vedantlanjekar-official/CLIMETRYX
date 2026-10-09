import { orgRows } from "@/lib/data/queries";

export default async function ConsentPage() {
  const consents = await orgRows<{ id: string; consent_type: string; version: string; granted: boolean; created_at: string }>(
    "user_consents",
    "id,consent_type,version,granted,created_at",
  );
  return (
    <div>
      <h1 className="text-4xl">Consent</h1>
      <p className="mt-2 max-w-2xl text-sm">Financial fields are optional. Exact locations and financial profiles are restricted by row-level security. Export and deletion steps are documented in the privacy page; this deployment does not claim a completed data-processing agreement.</p>
      <ul className="mt-4 text-sm">
        {consents.rows.map((consent) => <li key={consent.id}>{consent.consent_type} {consent.version} · granted {String(consent.granted)} · {consent.created_at}</li>)}
      </ul>
    </div>
  );
}
