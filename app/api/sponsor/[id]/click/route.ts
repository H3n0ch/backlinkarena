import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { safeHttpUrl } from "@/lib/url";

/** "Visit sponsor" link: counts the click, then sends the visitor to the sponsor's site. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sponsor/[id]/click">) {
  const { id } = await ctx.params;
  const fallback = Response.redirect(`${SITE_URL}/arena`, 302);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fallback;

  const db = createSupabaseAdmin();
  const { data } = await db.from("sponsorships").select("website").eq("id", id).eq("status", "approved").maybeSingle();
  const url = safeHttpUrl(data?.website as string | undefined);
  if (!url) return fallback;

  await db.rpc("increment_sponsor_click", { p_id: id });
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
