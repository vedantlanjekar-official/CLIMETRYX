import { workspaceContext } from "@/lib/data/queries";

export default async function ProfilePage() {
  const context = await workspaceContext();
  return (
    <div>
      <h1 className="text-4xl">Profile</h1>
      <p className="mt-3 text-sm">{context.user ? context.user.email : "No signed-in profile. Account identity comes from Supabase Auth."}</p>
    </div>
  );
}
