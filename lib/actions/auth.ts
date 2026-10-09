"use server";

import { redirect } from "next/navigation";
import { appUrl } from "@/lib/config/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  message: string;
  ok?: boolean;
}

export async function signIn(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!rateLimit(`signin:${email}`, 8, 10 * 60 * 1000).ok) return { message: "Too many sign-in attempts." };
  const supabase = await createClient();
  if (!supabase) return { message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: error.message };
  redirect(safeNextPath(formData.get("next")));
}

/** Only same-origin absolute paths are accepted, so `next` cannot become an open redirect. */
function safeNextPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/businesses";
  return path;
}

export async function signUp(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  if (password.length < 8) return { message: "Use at least 8 characters." };
  const supabase = await createClient();
  if (!supabase) return { message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
      data: { display_name: displayName },
    },
  });
  if (error) return { message: error.message };
  redirect("/verify-email");
}

export async function requestReset(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  if (!supabase) return { message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/reset-password`,
  });
  if (error) return { message: error.message };
  return { message: "If the account exists, a reset message has been requested from Supabase Auth.", ok: true };
}

export async function updatePassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  if (!supabase) return { message: "Supabase Auth is not configured." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: error.message };
  redirect("/businesses");
}
