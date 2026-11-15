import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SUPABASE_CONFIGURED } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null; isAdmin: boolean };

/** Current user or null. Reads cookies: call only inside a Suspense boundary or an action. */
export async function getUser(): Promise<SessionUser | null> {
  if (!SUPABASE_CONFIGURED) {
    await cookies(); // keep this a request-time read, like the configured path
    return null;
  }
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    isAdmin: Boolean(profile?.is_admin),
  };
}

export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getUser();
  if (!user?.isAdmin) notFound();
  return user;
}
