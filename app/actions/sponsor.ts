"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sponsorApprovedEmail } from "@/lib/email-templates";
import { PUBLIC_SITE_URL } from "@/lib/env";
import { clientIpHash } from "@/lib/guest";
import { fetchSiteMetadata } from "@/lib/metadata";
import { createSponsorCheckoutUrl, SPONSOR_PAYMENTS_CONFIGURED } from "@/lib/payments";
import { SPONSOR_LIMITS } from "@/lib/sponsor-offer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url";

/** Adds https:// when missing, keeps the path (sponsors may link a landing page). */
function toHttpUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const url = safeHttpUrl(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  if (!url) return null;
  const host = new URL(url).hostname;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) && !/^[\d.]+$/.test(host) ? url : null;
}

const SponsorInput = z.object({
  brandName: z.string().trim().min(1, "Enter your brand name.").max(SPONSOR_LIMITS.brandName),
  website: z
    .string()
    .trim()
    .max(SPONSOR_LIMITS.website)
    .transform((v) => toHttpUrl(v))
    .refine((v): v is string => v !== null, "Enter a valid website, like yourbrand.com."),
  tagline: z
    .string()
    .trim()
    .min(1, "Add a one-line pitch.")
    .max(SPONSOR_LIMITS.tagline, `Keep the pitch under ${SPONSOR_LIMITS.tagline} characters.`),
  logoUrl: z
    .string()
    .trim()
    .max(SPONSOR_LIMITS.logoUrl)
    .optional()
    .default("")
    .transform((v) => (v ? toHttpUrl(v) : ""))
    .refine((v) => v !== null, "The logo link must be an https:// image URL."),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  // Honeypot: real people never fill this hidden field.
  company: z.string().max(0).optional().default(""),
});

export type SponsorFormState = { error: string | null };

/**
 * /sponsor form: saves the sponsorship as 'pending_payment' and sends the browser to the
 * hosted checkout. The webhook marks it paid; an admin approves it for a tournament.
 */
export async function startSponsorCheckout(_prev: SponsorFormState, formData: FormData): Promise<SponsorFormState> {
  const parsed = SponsorInput.safeParse({
    brandName: formData.get("brandName") ?? "",
    website: formData.get("website") ?? "",
    tagline: formData.get("tagline") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
    email: formData.get("email") ?? "",
    company: formData.get("company") ?? "",
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "company")) return { error: null };
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  if (!SPONSOR_PAYMENTS_CONFIGURED) redirect("/sponsor?status=unavailable");
  const d = parsed.data;

  const db = createSupabaseAdmin();
  const ipHash = await clientIpHash();
  // Max 5 checkouts per network per hour.
  if (ipHash) {
    const { count } = await db
      .from("sponsorships")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 5) return { error: "Too many attempts. Please try again later." };
  }

  const logoUrl = d.logoUrl || (await siteLogo(d.website));
  const { data: row, error } = await db
    .from("sponsorships")
    .insert({
      brand_name: d.brandName,
      website: d.website,
      tagline: d.tagline,
      logo_url: logoUrl,
      email: d.email,
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("startSponsorCheckout: insert failed", error);
    return { error: "Couldn't start the checkout. Please try again." };
  }

  let url: string | null = null;
  try {
    url = await createSponsorCheckoutUrl({ sponsorshipId: row.id as string, brandName: d.brandName, email: d.email });
  } catch (e) {
    console.error("startSponsorCheckout: provider error", e);
  }
  if (!url) return { error: "Couldn't start the checkout. Please try again." };
  redirect(url);
}

/** The website's own icon (apple-touch-icon, favicon or og:image). Never throws. */
async function siteLogo(website: string): Promise<string | null> {
  try {
    const u = new URL(website);
    const meta = await fetchSiteMetadata(u.origin, u.hostname.replace(/^www\./, ""));
    return safeHttpUrl(meta.logoUrl);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function adminDb() {
  const user = await getUser();
  return user?.isAdmin ? createSupabaseAdmin() : null;
}

/** Admin preview: finds the logo of a website. */
export async function previewSponsorLogo(website: string): Promise<ActionResult<string>> {
  if (!(await adminDb())) return { ok: false, error: "Not allowed." };
  const url = toHttpUrl(String(website));
  if (!url) return { ok: false, error: "Enter a valid website." };
  const logo = await siteLogo(url);
  return logo ? { ok: true, data: logo } : { ok: false, error: "No logo found on that site." };
}

const ManualInput = SponsorInput.omit({ company: true }).extend({
  amount: z.coerce.number().min(0, "Amount can't be negative.").max(100000),
  reference: z.string().trim().max(120).optional().default(""),
  method: z.enum(["card", "wire", "free"]).optional().default("wire"),
  tournamentId: z.string().trim().optional().default(""),
});

/**
 * Admin: a sponsor paid outside the checkout (card link, wire) or given the slot for free.
 * Saved as paid and approved right away when a tournament is picked. Refund webhooks never
 * touch these: handle refunds by hand.
 */
export async function addManualSponsorship(formData: FormData): Promise<ActionResult<string>> {
  const db = await adminDb();
  if (!db) return { ok: false, error: "Not allowed." };
  const parsed = ManualInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const { data: row, error } = await db
    .from("sponsorships")
    .insert({
      status: "paid",
      brand_name: d.brandName,
      website: d.website,
      tagline: d.tagline,
      logo_url: d.logoUrl || (await siteLogo(d.website)),
      email: d.email,
      provider: d.method,
      payment_ref: d.reference || null,
      amount_total: d.method === "free" ? 0 : Math.round(d.amount * 100),
      currency: "usd",
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "That transfer reference is already used." };
  if (error || !row) return { ok: false, error: "Couldn't save the sponsor." };

  const id = row.id as string;
  if (!d.tournamentId) return { ok: true, data: id, message: "Saved as paid. Approve it for a tournament below." };
  const approved = await approveSponsorship(id, d.tournamentId);
  if (approved.ok) return { ok: true, data: id, message: "Live on the site." };
  // Not live: undo the save so switching on again doesn't create duplicates.
  await db.from("sponsorships").delete().eq("id", id);
  return { ok: false, error: approved.error };
}

/** Admin: a sponsor who filled in /sponsor but paid by bank transfer instead of the checkout. */
export async function markSponsorshipWired(id: string, amountDollars: number): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return { ok: false, error: "Not allowed." };
  const amount = Number(amountDollars);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter the amount received." };
  const { data, error } = await db
    .from("sponsorships")
    .update({
      status: "paid",
      provider: "wire",
      amount_total: Math.round(amount * 100),
      currency: "usd",
      paid_at: new Date().toISOString(),
    })
    .eq("id", String(id))
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't update." };
  return data ? { ok: true } : { ok: false, error: "Only unpaid sponsorships can be marked as wired." };
}

/** Puts a paid sponsorship live for one tournament (one sponsor per tournament). */
export async function approveSponsorship(id: string, tournamentId: string): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return { ok: false, error: "Not allowed." };
  const { data: t } = await db.from("tournaments").select("id, name, status").eq("id", String(tournamentId)).maybeSingle();
  if (!t) return { ok: false, error: "Pick a tournament." };
  if (t.status === "finished") return { ok: false, error: "That tournament is already finished." };

  const { data, error } = await db
    .from("sponsorships")
    .update({ status: "approved", tournament_id: t.id, approved_at: new Date().toISOString() })
    .eq("id", String(id))
    .eq("status", "paid")
    .select("brand_name, email")
    .maybeSingle();
  if (error?.code === "23505") return { ok: false, error: `${t.name} already has a sponsor.` };
  if (error) return { ok: false, error: "Couldn't approve." };
  if (!data) return { ok: false, error: "Only paid sponsorships can be approved." };

  after(() =>
    sendEmail(data.email as string, sponsorApprovedEmail({ brandName: data.brand_name as string, tournament: t.name as string, siteUrl: PUBLIC_SITE_URL })),
  );
  return { ok: true };
}

/** Hides a live sponsor for now, or shows a paused one again. */
export async function toggleSponsorship(id: string): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return { ok: false, error: "Not allowed." };
  const { data } = await db.from("sponsorships").select("status").eq("id", String(id)).maybeSingle();
  if (data?.status !== "approved" && data?.status !== "paused") return { ok: false, error: "Not live or paused." };
  const { error } = await db
    .from("sponsorships")
    .update({ status: data.status === "approved" ? "paused" : "approved" })
    .eq("id", String(id));
  return error ? { ok: false, error: "Couldn't update." } : { ok: true };
}

/** Declines a sponsorship and frees its slot. The refund itself is done in the payment dashboard. */
export async function rejectSponsorship(id: string): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return { ok: false, error: "Not allowed." };
  const { data, error } = await db
    .from("sponsorships")
    .update({ status: "rejected", tournament_id: null })
    .eq("id", String(id))
    .in("status", ["paid", "approved", "paused"])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't reject." };
  return data ? { ok: true, message: "Rejected. Now refund the payment in the payment dashboard." } : { ok: false, error: "Can't reject this one." };
}
