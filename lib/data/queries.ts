import { createClient } from "@/lib/supabase/server";

export async function workspaceContext() {
  const supabase = await createClient();
  if (!supabase) return { configured: false as const, user: null, supabase: null };
  const { data } = await supabase.auth.getUser();
  return { configured: true as const, user: data.user, supabase };
}

export async function orgRows<T>(table: string, columns: string, options: { excludeRemoved?: boolean } = {}): Promise<{ configured: boolean; rows: T[]; message?: string }> {
  const context = await workspaceContext();
  if (!context.configured || !context.supabase) return { configured: false, rows: [] };
  if (!context.user) return { configured: true, rows: [], message: "Sign in required." };
  const base = () => context.supabase.from(table).select(columns);
  let { data, error } = options.excludeRemoved ? await base().is("removed_at", null) : await base();
  // 42703 = undefined column: the questionnaire migration has not been applied yet.
  if (error?.code === "42703" && options.excludeRemoved) ({ data, error } = await base());
  if (error) return { configured: true, rows: [], message: error.message };
  return { configured: true, rows: (data ?? []) as T[] };
}
