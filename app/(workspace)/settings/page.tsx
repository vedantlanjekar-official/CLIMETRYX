import Link from "next/link";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-4xl">Settings</h1>
      <ul className="mt-4 space-y-2 text-sm">
        <li><Link className="underline" href="/settings/profile">Profile</Link></li>
        <li><Link className="underline" href="/settings/organization">Organization</Link></li>
        <li><Link className="underline" href="/settings/consent">Consent and privacy</Link></li>
      </ul>
    </div>
  );
}
