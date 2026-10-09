import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { workspaceContext } from "@/lib/data/queries";

/** Full-width workspace layout for pages that are a form edge to edge. */
export default async function FormLayout({ children }: { children: React.ReactNode }) {
  const context = await workspaceContext();
  return (
    <WorkspaceShell email={context.user?.email} wide>
      {children}
    </WorkspaceShell>
  );
}
