import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { io } from "next/cache";
import { cookies } from "next/headers";

// Second lock on /admin: besides an admin account, the ADMIN_PASSWORD env var.
// After the password is entered we set an httpOnly cookie, signed with the password
// and the server-only service key, and tied to the user's id. Changing ADMIN_PASSWORD
// logs every admin session out.

export const ADMIN_COOKIE = "ba_admin";
export const ADMIN_SESSION_HOURS = 12;

function secret(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null; // No password set: the panel stays locked.
  return `${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${pw}`;
}

function sign(userId: string, exp: number, key: string): string {
  return createHmac("sha256", key).update(`${userId}:${exp}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Constant-time check of a typed password against ADMIN_PASSWORD. */
export function checkAdminPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Compare digests so the lengths always match.
  const h = (s: string) => createHmac("sha256", "admin-pw").update(s).digest("base64url");
  return safeEqual(h(input), h(pw));
}

export function makeAdminToken(userId: string): { value: string; maxAge: number } | null {
  const key = secret();
  if (!key) return null;
  const maxAge = ADMIN_SESSION_HOURS * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return { value: `${exp}.${sign(userId, exp, key)}`, maxAge };
}

/** True when this request carries a valid, unexpired admin-password cookie for this user. */
export async function hasAdminPasswordSession(userId: string): Promise<boolean> {
  const key = secret();
  if (!key) return false;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [expStr, sig] = raw.split(".");
  const exp = Number(expStr);
  // Reading the clock: keep this out of prerenders (runtime prefetches can have cookies).
  await io();
  if (!sig || !Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(userId, exp, key));
}
