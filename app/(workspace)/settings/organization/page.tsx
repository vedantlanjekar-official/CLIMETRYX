import { orgRows } from "@/lib/data/queries";

export default async function OrganizationPage() {
  const members = await orgRows<{ id: string; role: string; status: string }>("organization_members", "id,role,status");
  return (
    <div>
      <h1 className="text-4xl">Organization</h1>
      <p className="mt-2 text-sm">The first saved assessment creates an organization and makes the signed-in user the owner. Invitations are recorded as pending until a mail provider is configured. No email is sent.</p>
      <ul className="mt-4 text-sm">
        {members.rows.map((member) => <li key={member.id}>{member.role} · {member.status}</li>)}
      </ul>
    </div>
  );
}
