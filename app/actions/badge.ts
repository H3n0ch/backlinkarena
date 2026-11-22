"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { getUser } from "@/lib/auth";
import { checkPageForBadge } from "@/lib/badge-check";
import { sendEmail } from "@/lib/email";
import { badgeCheckAdminEmail } from "@/lib/email-templates";
import { skipQualifying } from "@/lib/entries";
import { CONTACT_EMAIL, PUBLIC_SITE_URL } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/** Same site or a subdomain of it (www., blog., ...). */
function belongsTo(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

/** The two social post links: real web addresses, two different ones, not on their own site. */
function parsePosts(input: string[], domain: string): { posts: string[] } | { error: string } {
  const posts: string[] = [];
  for (const raw of input.map((x) => x.trim()).filter(Boolean)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return { error: `"${raw}" doesn't look like a link to a post.` };
    }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) {
      return { error: `"${raw}" doesn't look like a link to a post.` };
    }
    if (belongsTo(u.hostname.toLowerCase(), domain)) {
      return { error: "The posts must be on social accounts, not on your own site." };
    }
    const link = u.toString();
    if (!posts.includes(link)) posts.push(link);
  }
  if (posts.length < 2) return { error: "Add links to two different social posts about Backlink Arena." };
  return { posts: posts.slice(0, 2) };
}

/**
 * Owner clicks "Check my badge": we save their two social post links (checked by hand by the admin),
 * then fetch the page and look for a dofollow link to Backlink Arena.
 *  - found + dofollow  -> badge verified, entry upgraded so the product skips qualifying
 *  - found + nofollow  -> tell them to remove rel="nofollow"
 *  - not found         -> marked pending for a manual check (e.g. sites that render with JavaScript)
 */
export async function checkBadge(productId: string, pageInput?: string, postInputs: string[] = []): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const db = createSupabaseAdmin();
  const { data: product } = await db
    .from("products")
    .select("id, owner_id, url, domain, name, badge_status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.owner_id !== user.id) return { ok: false, error: "Product not found." };
  if (product.badge_status === "verified") {
    const t = await skipQualifying(db, product.id, "badge");
    refresh();
    return { ok: true, message: t ? `Already verified. You're in ${t} without qualifying.` : "Already verified." };
  }

  // Which page to check: the given page on their own domain, or the homepage.
  let page = product.url as string;
  const raw = (pageInput ?? "").trim();
  if (raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!belongsTo(u.hostname.toLowerCase(), product.domain as string)) {
        return { ok: false, error: `The page must be on ${product.domain}.` };
      }
      page = u.toString();
    } catch {
      return { ok: false, error: "That page address doesn't look right." };
    }
  }

  const parsed = parsePosts(postInputs, product.domain as string);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Remember the page and the posts, so the admin checks the same ones by hand.
  await db.from("products").update({ badge_page: page, badge_posts: parsed.posts }).eq("id", product.id);
  const result = await checkPageForBadge(page);

  if (result.found && result.dofollow) {
    await db.from("products").update({ badge_status: "verified", badge_requested_at: null }).eq("id", product.id);
    const t = await skipQualifying(db, product.id, "badge");
    refresh();
    return {
      ok: true,
      message: t
        ? `✅ Badge found! You skip qualifying and go straight into the bracket of ${t}.`
        : "✅ Badge found and verified! When you enter the next tournament, you skip qualifying.",
    };
  }

  if (result.found && !result.dofollow) {
    return {
      ok: false,
      error: 'We found the link, but it has rel="nofollow" (or sponsored/ugc). Remove that and check again.',
    };
  }

  // Not found automatically: queue it for a manual check by the admin.
  if (product.badge_status === "none") {
    await db
      .from("products")
      .update({ badge_status: "pending", badge_requested_at: new Date().toISOString() })
      .eq("id", product.id);
    const admin = process.env.ADMIN_EMAIL || CONTACT_EMAIL;
    const owner = user.email ?? "";
    const info = {
      name: product.name as string,
      domain: product.domain as string,
      page,
      posts: parsed.posts,
      owner,
      siteUrl: PUBLIC_SITE_URL,
    };
    if (admin) after(() => sendEmail(admin, badgeCheckAdminEmail(info), { replyTo: owner || undefined }));
  }
  refresh();
  return {
    ok: true,
    message:
      "We couldn't find the badge on that page automatically. If you just added it, check the page address and try again. Otherwise we'll check it by hand and email you.",
  };
}
