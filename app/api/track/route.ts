import { getUser } from "@/lib/auth";
import { clientIpHash, readGuestId } from "@/lib/guest";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

/**
 * Exposure events for the participant dashboard: matchup views and clicks to a brand's site.
 * Deduped per visitor per day by a unique index, so repeats are ignored. Owners don't count.
 */
export async function POST(req: Request) {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });

  let body: { kind?: string; matchId?: string; productId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const matchId = body.matchId && UUID.test(body.matchId) ? body.matchId : null;
  const productId = body.productId && UUID.test(body.productId) ? body.productId : null;
  if (body.kind !== "view" && body.kind !== "click") return new Response(null, { status: 400 });

  const [user, guestId, ipHash] = await Promise.all([getUser(), readGuestId(), clientIpHash()]);
  const visitor = user?.id ?? guestId ?? ipHash;
  if (!visitor) return new Response(null, { status: 204 });

  const db = createSupabaseAdmin();
  let ids: string[] = [];
  if (body.kind === "view") {
    if (!matchId) return new Response(null, { status: 400 });
    const { data: m } = await db.from("matches").select("product_a, product_b").eq("id", matchId).maybeSingle();
    ids = [m?.product_a, m?.product_b].filter(Boolean) as string[];
  } else if (productId) {
    ids = [productId];
  }
  if (!ids.length) return new Response(null, { status: 204 });

  // Skip the owner's own visits.
  const { data: products } = await db.from("products").select("id, owner_id").in("id", ids);
  const rows = (products ?? [])
    .filter((p) => !user || p.owner_id !== user.id)
    .map((p) => ({ product_id: p.id as string, match_id: matchId, kind: body.kind, visitor }));
  if (rows.length) {
    await db.from("site_events").upsert(rows, {
      onConflict: "product_id,kind,visitor,day,match_id",
      ignoreDuplicates: true,
    });
  }
  return new Response(null, { status: 204 });
}
