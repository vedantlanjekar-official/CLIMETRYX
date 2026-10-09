import Link from "next/link";
import { publicConfigStatus } from "@/lib/config/env";

export default function AdminPage() {
  const config = publicConfigStatus();
  return (
    <div className="space-y-3">
      <h1 className="text-4xl">Administration</h1>
      <p className="max-w-2xl text-sm">Ingestion and configuration stay on the server. Typing an email into a form does not grant administrator rights. Organization owners and admins are stored in organization membership.</p>
      <ul className="text-sm">
        <li>Service role key: {config.serviceRole.configured ? "present on the server" : "not set"}</li>
        <li>Cron secret: {config.cron.configured ? "set" : "not set"}</li>
        <li>Scheduled endpoint: /api/jobs/process</li>
      </ul>
      <Link className="underline" href="/admin/ingestion">Open ingestion panel</Link>
    </div>
  );
}
