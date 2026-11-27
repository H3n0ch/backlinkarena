import type Stripe from "stripe";
import { recordPaidPass, recordPaidSponsorship, refundPaidPass, refundSponsorship } from "@/lib/payments";
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
    const ref = { provider: "stripe", paymentRef: intent } as const;
    return (await refundSponsorship(db, ref)) ?? refundPaidPass(db, ref);
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignored");
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");

  if (session.metadata?.kind === "sponsorship") {
    const sponsorshipId = session.metadata.sponsorship_id ?? session.client_reference_id;
    if (!sponsorshipId) return new Response("no sponsorship");
    return recordPaidSponsorship(db, {
      provider: "stripe",
      sponsorshipId,
      paymentRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
      amount: session.amount_total,
      currency: session.currency,
    });
  }

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
