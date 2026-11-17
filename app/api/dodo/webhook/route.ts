import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { dodo } from "@/lib/dodo";
import { recordPaidPass, refundPaidPass } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Dodo Payments webhook. In the Dodo dashboard (Developer → Webhooks) add
 * <site>/api/dodo/webhook with the events `payment.succeeded` and `refund.succeeded`,
 * and put the endpoint's signing key in DODO_PAYMENTS_WEBHOOK_KEY.
 * Signed with Standard Webhooks (webhook-id / webhook-timestamp / webhook-signature).
 */
export async function POST(request: Request) {
  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY) return new Response("Webhook not configured", { status: 400 });

  const body = await request.text();
  let event: UnwrapWebhookEvent;
  try {
    event = dodo().webhooks.unwrap(body, {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
      },
    });
  } catch {
    return new Response("Bad signature", { status: 401 });
  }

  const db = createSupabaseAdmin();

  if (event.type === "refund.succeeded") {
    const refund = event.data;
    if (refund.is_partial) return new Response("partial refund ignored");
    return refundPaidPass(db, { provider: "dodo", paymentRef: refund.payment_id });
  }

  if (event.type !== "payment.succeeded") return new Response("ignored");
  const payment = event.data;
  const productId = payment.metadata?.product_id;
  if (typeof productId !== "string" || !productId) return new Response("no product");
  const userId = payment.metadata?.user_id;

  return recordPaidPass(db, {
    provider: "dodo",
    externalId: payment.payment_id,
    paymentRef: payment.payment_id,
    productId,
    userId: typeof userId === "string" ? userId : null,
    email: payment.customer?.email ?? null,
    amount: payment.total_amount,
    currency: payment.currency,
  });
}
