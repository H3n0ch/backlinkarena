"use server";

import { after } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { PUBLIC_SITE_URL } from "@/lib/env";
import { getActiveTournament } from "@/lib/data";
import { skipQualifying } from "@/lib/entries";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchSiteMetadata } from "@/lib/metadata";
import { createSupabasePublic, createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { normalizeUrl, safeHttpUrl, slugify } from "@/lib/url";
import { friendlyDbError } from "./errors";

export type SitePreview = {
  url: string;
  domain: string;
  name: string;
  description: string;
  logoUrl: string | null;
};

async function domainTaken(domain: string) {
  const db = createSupabasePublic();
  const { data } = await db.from("products").select("slug").eq("domain", domain).maybeSingle();
  return data?.slug as string | undefined;
}

export async function previewSite(input: string): Promise<ActionResult<SitePreview>> {
  const n = normalizeUrl(String(input ?? "").slice(0, 300));
  if (!n) return { ok: false, error: "That doesn't look like a website address." };
  if (await domainTaken(n.domain)) {
    return { ok: false, error: `${n.domain} is already in the arena.` };
  }
  const meta = await fetchSiteMetadata(n.url, n.domain);
  return {
    ok: true,
    data: { url: n.url, domain: n.domain, name: meta.name, description: meta.description, logoUrl: meta.logoUrl },
  };
}

const ProductInput = z.object({
  url: z.string().max(300),
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(300).optional().default(""),
  logoUrl: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().max(60).optional().default(""),
});

export async function createProduct(
  input: z.input<typeof ProductInput>,
): Promise<ActionResult<{ slug: string; entered: boolean }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const parsed = ProductInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const n = normalizeUrl(parsed.data.url);
  if (!n) return { ok: false, error: "That doesn't look like a website address." };
  const supabase = await createSupabaseServer();

  // Already yours (e.g. saved in another tab after the login link): treat as success.
  const { data: mine } = await supabase
    .from("products")
    .select("id, slug")
    .eq("owner_id", user.id)
    .eq("domain", n.domain)
    .maybeSingle();
  if (mine) {
    const entered = await enterActiveTournament(mine.id as string);
    return { ok: true, data: { slug: mine.slug as string, entered } };
  }

  if (await domainTaken(n.domain)) return { ok: false, error: `${n.domain} is already in the arena.` };

  const base = slugify(n.domain);
  let slug = base;
  let productId: string | null = null;
  for (let attempt = 0; attempt < 3 && !productId; attempt++) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        owner_id: user.id,
        url: n.url,
        domain: n.domain,
        slug,
        name: parsed.data.name,
        description: parsed.data.description || null,
        logo_url: safeHttpUrl(parsed.data.logoUrl),
        category: parsed.data.category || null,
      })
      .select("id")
      .single();
    if (data) productId = data.id;
    else if (error?.code === "23505" && error.message.includes("slug")) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    } else {
      return { ok: false, error: friendlyDbError(error, `${n.domain} is already in the arena.`) };
    }
  }
  if (!productId) return { ok: false, error: "Could not save your product. Please try again." };

  const entered = await enterActiveTournament(productId);
  if (user.email) {
    const to = user.email;
    const name = parsed.data.name;
    after(() => sendWelcome(to, name, slug, entered));
  }
  return { ok: true, data: { slug, entered } };
}

/** First email after a website joins: what happens next + their page to share. */
async function sendWelcome(to: string, name: string, slug: string, entered: boolean) {
  await sendEmail(to, welcomeEmail({ name, slug, entered, siteUrl: PUBLIC_SITE_URL }));
}

/** Free entry into the open (draft or qualifying) tournament, if there is one. */
async function enterActiveTournament(productId: string): Promise<boolean> {
  const t = await getActiveTournament();
  if (!t || (t.status !== "draft" && t.status !== "qualifying")) return false;
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("entries")
    .insert({ tournament_id: t.id, product_id: productId, entry_path: "free" });
  if (error && error.code !== "23505") return false;

  // A verified badge carries over: skip qualifying in this tournament too.
  const { data: product } = await supabase.from("products").select("badge_status").eq("id", productId).maybeSingle();
  if (product?.badge_status === "verified") {
    await skipQualifying(createSupabaseAdmin(), productId, "badge");
  }
  return true;
}

export async function enterTournament(productId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in first." };
  const ok = await enterActiveTournament(String(productId));
  return ok ? { ok: true } : { ok: false, error: "No tournament is open for entries right now." };
}
