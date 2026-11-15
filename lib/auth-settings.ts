import "server-only";
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from "@/lib/env";

let cached: { google: boolean; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** Whether Google sign-in is switched on in Supabase (cached for 5 minutes). */
export async function isGoogleLoginEnabled(): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return false;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.google;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(2000),
    });
    const j = (await res.json()) as { external?: { google?: boolean } };
    cached = { google: Boolean(j.external?.google), at: Date.now() };
  } catch {
    cached = { google: false, at: Date.now() };
  }
  return cached.google;
}
