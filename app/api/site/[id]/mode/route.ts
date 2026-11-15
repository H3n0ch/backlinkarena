import { NextResponse, type NextRequest } from "next/server";
import { checkEmbeddable } from "@/lib/metadata";
import { createSupabasePublic } from "@/lib/supabase/server";
import { safeHttpUrl } from "@/lib/url";

/** How the vote window should load a product's site: directly (allows framing) or via /api/site/[id]. */

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { direct: boolean; at: number }>();

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/site/[id]/mode">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ direct: false }, { status: 400 });

  const hit = cache.get(id);
  let direct: boolean;
  if (hit && Date.now() - hit.at < TTL_MS) {
    direct = hit.direct;
  } else {
    const db = createSupabasePublic();
    const { data } = await db.from("products").select("url").eq("id", id).maybeSingle();
    direct = await checkEmbeddable(safeHttpUrl(data?.url as string | undefined));
    cache.set(id, { direct, at: Date.now() });
  }
  return NextResponse.json(
    { direct },
    { headers: { "cache-control": "public, max-age=600, s-maxage=3600" } },
  );
}
