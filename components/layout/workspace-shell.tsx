import { LogOut } from "lucide-react";
import { publicConfigStatus } from "@/lib/config/env";
import { BrandMark } from "@/components/layout/brand-mark";

export function WorkspaceShell({ children, email, wide = false }: { children: React.ReactNode; email?: string | null; wide?: boolean }) {
  const config = publicConfigStatus();
  const initial = (email ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="min-h-screen">
      <header className="surface-dark sticky top-0 z-30 border-b border-white/10">
        <div className={wide ? "flex items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12" : "mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8"}>
          <BrandMark />
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent-300 to-accent-600 text-sm font-bold text-white">{initial}</span>
            <span className="hidden truncate text-sm font-semibold text-white sm:block">{email ?? "Not signed in"}</span>
            <form action="/auth/signout" method="post">
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-100/80 transition hover:bg-white/10 hover:text-white"
                type="submit"
              >
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {!config.supabase.configured ? (
        <p className="border-b border-warn-700/15 bg-warn-100 px-8 py-3 text-sm text-warn-700">
          Supabase is not configured. Pages explain what they store, and nothing is written to a local database.
        </p>
      ) : null}
      {wide ? (
        <div className="w-full animate-rise pt-8">{children}</div>
      ) : (
        <div className="workspace-main mx-auto max-w-6xl animate-rise px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      )}
      <p className="pb-8 text-center text-xs text-muted">Decision support for review and preparedness — not a credit decision.</p>
    </div>
  );
}
