import type { NextRequest } from "next/server";
import { fetchHtml } from "@/lib/metadata";
import { createSupabasePublic } from "@/lib/supabase/server";
import { safeHttpUrl } from "@/lib/url";

/**
 * Serves the homepage of an entered product so it can be shown in the vote window
 * even when the site forbids framing (X-Frame-Options / frame-ancestors).
 *
 * Safety:
 *  - Only the homepage URL stored for a product in the arena can be fetched (no open proxy).
 *  - The response carries `Content-Security-Policy: sandbox` WITHOUT allow-same-origin, so the
 *    page runs in an opaque origin: it cannot read our cookies, storage or session.
 *  - Scripts are stripped and blocked; the server-rendered page shows as-is.
 *  - Links open in a new tab via <base target="_blank">.
 */

// No allow-scripts: the site's JavaScript would crash on a foreign address (e.g. Next.js apps
// replace the page with "Application error"). Server-rendered HTML + CSS shows the full page.
const SANDBOX = "sandbox allow-popups allow-popups-to-escape-sandbox";

function page(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": SANDBOX,
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  });
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function notice(text: string, url?: string) {
  return page(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#fff8f1;color:#1c1917;text-align:center}a{color:#ea580c;font-weight:700}</style>
</head><body><div><p>${text}</p>${url ? `<p><a href="${escapeAttr(url)}" target="_blank" rel="noopener">Open the live site ↗</a></p>` : ""}</div></body></html>`,
  );
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/site/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notice("Unknown site.");

  const db = createSupabasePublic();
  const { data: product } = await db.from("products").select("url").eq("id", id).maybeSingle();
  const url = safeHttpUrl(product?.url as string | undefined);
  if (!url) return notice("Unknown site.");

  let html = "";
  let finalUrl = url;
  try {
    ({ html, finalUrl } = await fetchHtml(url, 5_000_000));
  } catch {
    return notice("This site took too long to load.", url);
  }
  if (!html) return notice("This site couldn't be loaded here.", url);

  // Scripts can't run here, so drop them and <noscript> fallbacks ("please enable JavaScript").
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, "")
    .replace(/<link[^>]*rel=["']?(?:modulepreload|preload)["']?[^>]*as=["']?script["']?[^>]*>/gi, "");

  // Resolve the site's relative assets/links against its real address; open links in a new tab.
  // Content hidden until JS runs (common fade-in animations) is forced visible.
  const head =
    `<base href="${escapeAttr(finalUrl)}" target="_blank">` +
    `<style>[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important}` +
    `[style*="visibility:hidden"],[style*="visibility: hidden"]{visibility:visible!important}</style>`;
  const out = /<head[^>]*>/i.test(cleaned)
    ? cleaned.replace(/<head[^>]*>/i, (m) => `${m}${head}`)
    : `${head}${cleaned}`;

  return page(out);
}
