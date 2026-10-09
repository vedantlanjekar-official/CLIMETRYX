import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { workspaceContext } from "@/lib/data/queries";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const context = await workspaceContext();
  return <WorkspaceShell email={context.user?.email}>{children}</WorkspaceShell>;
}
