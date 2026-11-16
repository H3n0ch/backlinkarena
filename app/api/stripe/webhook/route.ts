import type Stripe from "stripe";
import { grantPass } from "@/lib/entries";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Stripe webhook. Subscribe to `checkout.session.completed` and
 * `checkout.session.async_payment_succeeded` in the Stripe dashboard.
 *
 * Each Checkout Session grants at most one pass: the session id is stored in `payments`
 * (unique), so Stripe's retries and duplicate deliveries are no-ops.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignored");
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");

  const productId = session.metadata?.product_id ?? session.client_reference_id;
  if (!productId) return new Response("no product", { status: 200 });

  const db = createSupabaseAdmin();
  const { error: insertError } = await db.from("payments").insert({
    product_id: productId,
    user_id: session.metadata?.user_id ?? null,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
    amount_total: session.amount_total,
    currency: session.currency,
  });
  if (insertError?.code === "23505") return new Response("already processed");
  if (insertError) return new Response("db error", { status: 500 });

  const granted = await grantPass(db, productId);
  if (!granted.ok) {
    // Let Stripe retry: remove the record so the retry isn't treated as a duplicate.
    await db.from("payments").delete().eq("stripe_session_id", session.id);
    return new Response("grant failed", { status: 500 });
  }
  return new Response("ok");
}
