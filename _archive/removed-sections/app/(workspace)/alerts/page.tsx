import { orgRows } from "@/lib/data/queries";

export default async function AlertsPage() {
  const result = await orgRows<{ id: string; severity: string; rationale: string; evidence_origin: string; created_at: string }>(
    "risk_alerts",
    "id,severity,rationale,evidence_origin,created_at",
  );
  return (
    <div>
      <h1 className="text-4xl">Alerts</h1>
      <p className="mt-2 max-w-2xl text-sm">An alert is created from a documented rule and stored evidence. Email and SMS are not sent. A database update is not the same thing as a live weather feed.</p>
      {result.rows.length === 0 ? <p className="mt-4 text-sm">No alerts stored.</p> : null}
      <ul className="mt-4 space-y-3 text-sm">
        {result.rows.map((alert) => (
          <li key={alert.id}><strong>{alert.severity}</strong> · {alert.evidence_origin} · {alert.rationale}</li>
        ))}
      </ul>
    </div>
  );
}
