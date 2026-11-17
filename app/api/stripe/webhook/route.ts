import type Stripe from "stripe";
import { recordPaidPass, refundPaidPass } from "@/lib/payments";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Stripe webhook (kept for later; payments currently go through Dodo, see lib/payments.ts).
 * Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`
 * and `charge.refunded` in the Stripe dashboard.
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

  const db = createSupabaseAdmin();

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    if (!charge.refunded) return new Response("partial refund ignored");
    const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!intent) return new Response("no payment intent");
    return refundPaidPass(db, { provider: "stripe", paymentRef: intent });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignored");
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");

  const productId = session.metadata?.product_id ?? session.client_reference_id;
  if (!productId) return new Response("no product");

  return recordPaidPass(db, {
    provider: "stripe",
    externalId: session.id,
    paymentRef: typeof session.payment_intent === "string" ? session.payment_intent : null,
    productId,
    userId: session.metadata?.user_id ?? null,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    amount: session.amount_total,
    currency: session.currency,
  });
}
