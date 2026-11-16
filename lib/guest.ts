import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Guest (no sign-in) voting identity: a random id in an httpOnly cookie, plus a
// salted hash of the visitor's IP. The raw IP is never stored.

const COOKIE = "ba_voter";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser's guest id, or null if it has never voted. Safe in Server Components. */
export async function readGuestId(): Promise<string | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/** Reads the guest id, creating the cookie if needed. Server Actions / Route Handlers only. */
export async function getOrCreateGuestId(): Promise<string> {
  const existing = await readGuestId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}

/** Open, live matchups this browser hasn't voted in yet (like my_unvoted_open_matches for accounts). */
export async function guestUnvotedOpenMatches(guestId: string | null): Promise<string[]> {
  const db = createSupabaseAdmin();
  const now = new Date().toISOString();
  const [{ data: open }, { data: mine }] = await Promise.all([
    db
      .from("matches")
      .select("id")
      .eq("status", "open")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .not("product_a", "is", null)
      .not("product_b", "is", null)
      .order("round")
      .order("position"),
    guestId ? db.from("votes").select("match_id").eq("guest_id", guestId) : Promise.resolve({ data: [] }),
  ]);
  const done = new Set((mine ?? []).map((v) => v.match_id as string));
  return (open ?? []).map((m) => m.id as string).filter((id) => !done.has(id));
}

/** Salted hash of the client IP (Netlify / proxies), or null when unknown. */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  if (!ip) return null;
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "backlinkarena";
  return createHmac("sha256", salt).update(`ip:${ip}`).digest("base64url").slice(0, 43);
}
