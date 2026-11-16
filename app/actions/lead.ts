"use server";

import { after } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { leadAdminEmail, leadConfirmEmail } from "@/lib/email-templates";
import { CONTACT_EMAIL, PUBLIC_SITE_URL } from "@/lib/env";
import { clientIpHash } from "@/lib/guest";
import { PARTICIPANT_DISCOUNT, SERVICE_OPTIONS } from "@/lib/services";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";

const LeadInput = z.object({
  source: z.enum(["services", "participant_offer"]),
  service: z.string().refine((s) => SERVICE_OPTIONS.includes(s), "Pick a service."),
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  website: z.string().trim().max(300).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  productId: z.guid().optional(),
  // Honeypot: real people never fill this hidden field.
  company: z.string().max(0).optional().default(""),
});

/** "Talk to us" / participant offer form → leads table (admin → Leads). */
export async function submitLead(input: z.input<typeof LeadInput>): Promise<ActionResult> {
  const parsed = LeadInput.safeParse(input);
  if (!parsed.success) {
    // Honeypot hit: pretend it worked.
    if (parsed.error.issues.some((i) => i.path[0] === "company")) return { ok: true };
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const db = createSupabaseAdmin();
  const [user, ipHash] = await Promise.all([getUser(), clientIpHash()]);

  // Max 5 enquiries per network per hour.
  if (ipHash) {
    const { count } = await db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 5) return { ok: false, error: "Too many requests. Please try again later." };
  }

  // The participant discount only applies to a site the visitor owns.
  let discount = 0;
  let productId: string | null = null;
  let website = d.website ? (normalizeUrl(d.website)?.url ?? d.website) : "";
  if (d.source === "participant_offer" && user && d.productId) {
    const { data: product } = await db
      .from("products")
      .select("id, url, owner_id")
      .eq("id", d.productId)
      .maybeSingle();
    if (product && product.owner_id === user.id) {
      discount = PARTICIPANT_DISCOUNT;
      productId = product.id as string;
      website ||= product.url as string;
    }
  }

  const [service, tier] = d.service.split(" · ");
  const { error } = await db.from("leads").insert({
    source: d.source,
    service,
    tier: tier ?? null,
    name: d.name || null,
    email: d.email,
    website: website || null,
    message: d.message || null,
    discount,
    user_id: user?.id ?? null,
    product_id: productId,
    ip_hash: ipHash,
  });
  if (error) return { ok: false, error: "Couldn't send your request. Please try again." };

  // Emails go out after the response, so a slow or missing mail service never blocks the form.
  after(() => notifyLead({ ...d, service, tier: tier ?? null, website, discount }));
  return { ok: true };
}

async function notifyLead(l: {
  name: string;
  email: string;
  service: string;
  tier: string | null;
  website: string;
  message: string;
  discount: number;
}) {
  const info = { ...l, what: l.tier ? `${l.service} · ${l.tier}` : l.service };
  const admin = process.env.ADMIN_EMAIL || CONTACT_EMAIL;
  await Promise.all([
    admin && sendEmail(admin, leadAdminEmail(info, PUBLIC_SITE_URL), { replyTo: l.email }),
    sendEmail(l.email, leadConfirmEmail(info), { replyTo: admin || undefined }),
  ]);
}

export async function setLeadStatus(id: string, status: "new" | "contacted" | "won" | "lost"): Promise<ActionResult> {
  const user = await getUser();
  if (!user?.isAdmin) return { ok: false, error: "Not allowed." };
  if (!["new", "contacted", "won", "lost"].includes(status)) return { ok: false, error: "Invalid status." };
  const { error } = await createSupabaseAdmin().from("leads").update({ status }).eq("id", String(id));
  return error ? { ok: false, error: "Couldn't update." } : { ok: true };
}
