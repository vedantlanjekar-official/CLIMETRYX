import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig, supabaseSecretKey } from "@/lib/config/env";

export async function createClient() {
  const config = supabasePublicConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. proxy.ts refreshes the session.
        }
      },
    },
  });
}

export function createServiceClient() {
  const config = supabasePublicConfig();
  const secret = supabaseSecretKey();
  if (!config || !secret) return null;
  return createServerClient(config.url, secret, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
