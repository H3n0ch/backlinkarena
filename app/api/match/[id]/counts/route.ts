import { NextResponse, type NextRequest } from "next/server";
import { getCounts } from "@/lib/data";
import { createSupabasePublic } from "@/lib/supabase/server";

/** Live counts for polling. Public: counts only, never voter IDs. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/match/[id]/counts">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = createSupabasePublic();
  const [counts, { data: match }] = await Promise.all([
    getCounts(id),
    db.from("matches").select("status, winner_product_id").eq("id", id).maybeSingle(),
  ]);
  return NextResponse.json(
    { ...counts, status: match?.status ?? null, winner: match?.winner_product_id ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
