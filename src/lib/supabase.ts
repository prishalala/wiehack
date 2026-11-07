import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export type Portal = "teacher" | "student" | "parent";

const clients: Partial<Record<Portal, SupabaseClient>> = {};

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * Which signed-in account this page acts as. Teacher, student and parent sign-ins are
 * stored under separate keys so demo tabs can run side by side in one browser.
 */
export function currentPortal(): Portal {
  if (typeof window === "undefined") return "student";
  const path = window.location.pathname;
  if (path.startsWith("/teacher")) return "teacher";
  if (path.startsWith("/parent")) return "parent";
  return "student";
}

export function getSupabase(portal: Portal = currentPortal()): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
    );
  }
  let client = clients[portal];
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: portal === "teacher",
        storageKey: `classbridge-auth-${portal}`,
      },
    });
    clients[portal] = client;
  }
  return client;
}

export function functionsBaseUrl(): string {
  if (!url) throw new Error("VITE_SUPABASE_URL is not set");
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

/** Calls an Edge Function as the signed-in account when there is one, else with the anon key. */
export async function invokeFunction<T>(
  name: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  if (!anonKey) throw new Error("VITE_SUPABASE_ANON_KEY is not set");
  let bearer = anonKey;
  try {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) bearer = data.session.access_token;
  } catch {
    /* not signed in: anon key */
  }
  const res = await fetch(`${functionsBaseUrl()}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      apikey: anonKey,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `${name} failed (${res.status})`);
  }
  return data as T;
}
