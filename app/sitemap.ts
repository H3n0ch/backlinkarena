import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getBracket, getCurrentOrLastTournament } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { matchPath } from "@/lib/share";
import { createSupabasePublic } from "@/lib/supabase/server";

/** /sitemap.xml for Google Search Console: main pages, every brand page, current matchups. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // build it per request, so new brands and matchups show up without a redeploy

  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/arena`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/services`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/join`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/winners`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/founders`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/rules`,changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const db = createSupabasePublic();
    const [{ data: products }, tournament] = await Promise.all([
      db.from("products").select("slug, created_at").order("created_at", { ascending: false }).limit(5000),
      getCurrentOrLastTournament(),
    ]);
    for (const p of products ?? []) {
      pages.push({
        url: `${SITE_URL}/p/${p.slug}`,
        lastModified: p.created_at as string,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
    if (tournament) {
      const { matches, products: byId } = await getBracket(tournament.id);
      for (const m of matches) {
        if (!m.product_a || !m.product_b) continue;
        pages.push({
          url: `${SITE_URL}${matchPath(m, byId.get(m.product_a)?.slug, byId.get(m.product_b)?.slug)}`,
          lastModified: m.starts_at,
          changeFrequency: m.status === "open" ? "hourly" : "weekly",
          priority: m.status === "open" ? 0.7 : 0.4,
        });
      }
    }
  } catch (err) {
    console.error("sitemap: data unavailable, serving static pages only", err);
  }
  return pages;
}
