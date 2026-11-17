"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createPassCheckoutUrl, PAYMENTS_CONFIGURED } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Starts a hosted checkout (Dodo, or Stripe after a switch) for one Contender Pass and
 * sends the browser there. The pass itself is granted by the webhook, never here.
 */
export async function startPassCheckout(productId: string): Promise<void> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/dashboard")}`);
  if (!PAYMENTS_CONFIGURED) redirect("/dashboard?pass=unavailable");

  const db = createSupabaseAdmin();
  const { data: product } = await db
    .from("products")
    .select("id, name, domain, owner_id, pass_paid")
    .eq("id", String(productId))
    .maybeSingle();
  if (!product || product.owner_id !== user.id) redirect("/dashboard?pass=error");
  if (product.pass_paid) redirect("/dashboard?pass=already");

  let url: string | null = null;
  try {
    url = await createPassCheckoutUrl({
      productId: product.id,
      domain: product.domain,
      userId: user.id,
      email: user.email ?? null,
    });
  } catch (e) {
    console.error("startPassCheckout: provider error", e);
  }
  if (!url) redirect("/dashboard?pass=error");
  redirect(url);
}
