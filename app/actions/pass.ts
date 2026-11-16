"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { PASS_AMOUNT_CENTS, STRIPE_CONFIGURED, stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Starts a Stripe Checkout for one Contender Pass and sends the browser to Stripe.
 * The pass itself is granted by the webhook (app/api/stripe/webhook), never here.
 */
export async function startPassCheckout(productId: string): Promise<void> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/dashboard")}`);
  if (!STRIPE_CONFIGURED) redirect("/dashboard?pass=unavailable");

  const db = createSupabaseAdmin();
  const { data: product } = await db
    .from("products")
    .select("id, name, domain, owner_id, pass_paid")
    .eq("id", String(productId))
    .maybeSingle();
  if (!product || product.owner_id !== user.id) redirect("/dashboard?pass=error");
  if (product.pass_paid) redirect("/dashboard?pass=already");

  const priceId = process.env.STRIPE_PASS_PRICE_ID;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: PASS_AMOUNT_CENTS,
              product_data: {
                name: "Guaranteed spot (Backlink Arena)",
                description: `Guaranteed bracket spot in the next tournament for ${product.domain}`,
              },
            },
          },
    ],
    customer_email: user.email ?? undefined,
    client_reference_id: product.id,
    metadata: { product_id: product.id, user_id: user.id },
    payment_intent_data: { metadata: { product_id: product.id, user_id: user.id } },
    success_url: `${SITE_URL}/dashboard?pass=success`,
    cancel_url: `${SITE_URL}/dashboard?pass=cancelled`,
  });
  if (!session.url) redirect("/dashboard?pass=error");
  redirect(session.url);
}
