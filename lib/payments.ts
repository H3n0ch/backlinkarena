import "server-only";
import { after } from "next/server";
import { CONTACT_EMAIL, PUBLIC_SITE_URL, SITE_URL } from "@/lib/env";
import { DODO_CONFIGURED, dodo } from "@/lib/dodo";
import { sendEmail } from "@/lib/email";
import { sponsorAdminEmail, sponsorConfirmEmail } from "@/lib/email-templates";
import { grantPass, revokePass } from "@/lib/entries";
import { SPONSOR_AMOUNT_CENTS } from "@/lib/sponsor-offer";
import { PASS_AMOUNT_CENTS, STRIPE_CONFIGURED, stripe } from "@/lib/stripe";
import type { createSupabaseAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdmin>;
export type PaymentProvider = "dodo" | "stripe";

/**
 * Which provider sells the guaranteed spot. Dodo for now; Stripe stays wired up so we can
 * switch later with PAYMENT_PROVIDER=stripe. Both webhooks keep working either way, so
 * payments already made through one provider still get refunded correctly after a switch.
 */
export const PAYMENT_PROVIDER: PaymentProvider = process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "dodo";

/** False until the active provider has its keys: the buy button shows "Coming soon" instead. */
export const PAYMENTS_CONFIGURED = PAYMENT_PROVIDER === "stripe" ? STRIPE_CONFIGURED : DODO_CONFIGURED;

/** Sponsorship checkout also needs its own $499 product in Dodo (DODO_SPONSOR_PRODUCT_ID). */
export const SPONSOR_PAYMENTS_CONFIGURED =
  PAYMENT_PROVIDER === "stripe"
    ? STRIPE_CONFIGURED
    : Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_SPONSOR_PRODUCT_ID);

/** Creates a hosted checkout for one tournament sponsorship. Returns its URL. */
export async function createSponsorCheckoutUrl(input: {
  sponsorshipId: string;
  brandName: string;
  email: string;
}): Promise<string | null> {
  const metadata = { kind: "sponsorship", sponsorship_id: input.sponsorshipId };
  const successUrl = `${SITE_URL}/sponsor?status=success`;
  const cancelUrl = `${SITE_URL}/sponsor?status=cancelled`;

  if (PAYMENT_PROVIDER === "dodo") {
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: process.env.DODO_SPONSOR_PRODUCT_ID!, quantity: 1 }],
      customer: { email: input.email },
      metadata,
      return_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session.checkout_url ?? null;
  }

  const priceId = process.env.STRIPE_SPONSOR_PRICE_ID;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: SPONSOR_AMOUNT_CENTS,
              product_data: {
                name: "Tournament sponsorship (Backlink Arena)",
                description: `${input.brandName} as the sponsor of one Backlink Arena tournament`,
              },
            },
          },
    ],
    customer_email: input.email,
    client_reference_id: input.sponsorshipId,
    metadata,
    payment_intent_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url;
}

/**
 * Marks a sponsorship as paid (waiting for admin review) and emails admin + sponsor.
 * Only a 'pending_payment' row changes, so retries and duplicate deliveries are no-ops.
 */
export async function recordPaidSponsorship(
  db: Admin,
  p: {
    provider: PaymentProvider;
    sponsorshipId: string;
    /** What refunds point at: Stripe PaymentIntent id, Dodo payment id. */
    paymentRef: string;
    amount: number | null;
    currency: string | null;
  },
): Promise<Response> {
  const { data, error } = await db
    .from("sponsorships")
    .update({
      status: "paid",
      provider: p.provider,
      payment_ref: p.paymentRef,
      amount_total: p.amount,
      currency: p.currency,
      paid_at: new Date().toISOString(),
    })
    .eq("id", p.sponsorshipId)
    .eq("status", "pending_payment")
    .select("brand_name, website, tagline, email")
    .maybeSingle();
  if (error?.code === "23505") return new Response("already processed");
  if (error) return new Response("db error", { status: 500 });
  if (!data) return new Response("already processed (or unknown sponsorship)");

  after(() => notifySponsorPaid(data as SponsorMail));
  return new Response("ok");
}

/**
 * A fully refunded sponsorship payment is hidden for good. Returns null when the payment
 * isn't a sponsorship, so the caller can try the Contender Pass refund instead.
 */
export async function refundSponsorship(
  db: Admin,
  p: { provider: PaymentProvider; paymentRef: string },
): Promise<Response | null> {
  const { data, error } = await db
    .from("sponsorships")
    .select("id, status")
    .eq("provider", p.provider)
    .eq("payment_ref", p.paymentRef)
    .maybeSingle();
  if (error) return new Response("db error", { status: 500 });
  if (!data) return null;
  if (data.status === "refunded") return new Response("already processed");
  const { error: updateError } = await db.from("sponsorships").update({ status: "refunded" }).eq("id", data.id);
  return updateError ? new Response("db error", { status: 500 }) : new Response("ok");
}

type SponsorMail = { brand_name: string; website: string; tagline: string; email: string };

async function notifySponsorPaid(s: SponsorMail) {
  const admin = process.env.ADMIN_EMAIL || CONTACT_EMAIL;
  const info = { brandName: s.brand_name, website: s.website, tagline: s.tagline, email: s.email };
  await Promise.all([
    admin && sendEmail(admin, sponsorAdminEmail(info, PUBLIC_SITE_URL), { replyTo: s.email }),
    sendEmail(s.email, sponsorConfirmEmail(info), { replyTo: admin || undefined }),
  ]);
}

/** Creates a hosted checkout for one Contender Pass with the active provider. Returns its URL. */
export async function createPassCheckoutUrl(input: {
  productId: string;
  domain: string;
  userId: string;
  email: string | null;
}): Promise<string | null> {
  const metadata = { product_id: input.productId, user_id: input.userId };
  const successUrl = `${SITE_URL}/dashboard?pass=success`;
  const cancelUrl = `${SITE_URL}/dashboard?pass=cancelled`;

  if (PAYMENT_PROVIDER === "dodo") {
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: process.env.DODO_PASS_PRODUCT_ID!, quantity: 1 }],
      customer: input.email ? { email: input.email } : null,
      metadata,
      return_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session.checkout_url ?? null;
  }

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
                description: `Guaranteed bracket spot in the next tournament for ${input.domain}`,
              },
            },
          },
    ],
    customer_email: input.email ?? undefined,
    client_reference_id: input.productId,
    metadata,
    payment_intent_data: { metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url;
}

/**
 * Records a confirmed payment and grants its pass. Each payment grants at most one pass:
 * (provider, external_id) is unique, so retries and duplicate deliveries are no-ops.
 * Returns the HTTP response the webhook should send (500 makes the provider retry).
 */
export async function recordPaidPass(
  db: Admin,
  p: {
    provider: PaymentProvider;
    /** Unique per purchase: Stripe Checkout Session id, Dodo payment id. */
    externalId: string;
    /** What refunds point at: Stripe PaymentIntent id, Dodo payment id. */
    paymentRef: string | null;
    productId: string;
    userId: string | null;
    email: string | null;
    amount: number | null;
    currency: string | null;
  },
): Promise<Response> {
  const { error: insertError } = await db.from("payments").insert({
    provider: p.provider,
    external_id: p.externalId,
    payment_ref: p.paymentRef,
    product_id: p.productId,
    user_id: p.userId,
    email: p.email,
    amount_total: p.amount,
    currency: p.currency,
  });
  if (insertError?.code === "23505") return new Response("already processed");
  if (insertError) return new Response("db error", { status: 500 });

  const granted = await grantPass(db, p.productId);
  if (!granted.ok) {
    // Let the provider retry: remove the record so the retry isn't treated as a duplicate.
    await db.from("payments").delete().eq("provider", p.provider).eq("external_id", p.externalId);
    return new Response("grant failed", { status: 500 });
  }
  return new Response("ok");
}

/**
 * A fully refunded payment takes its unused pass back. `refunded_at` makes this run once per
 * payment, so retries and a late refund of an old payment don't touch a newer pass.
 * Callers pass only full refunds.
 */
export async function refundPaidPass(
  db: Admin,
  p: { provider: PaymentProvider; paymentRef: string },
): Promise<Response> {
  const { data: payment, error } = await db
    .from("payments")
    .update({ refunded_at: new Date().toISOString() })
    .eq("provider", p.provider)
    .eq("payment_ref", p.paymentRef)
    .is("refunded_at", null)
    .select("product_id")
    .maybeSingle();
  if (error) return new Response("db error", { status: 500 });
  if (!payment?.product_id) return new Response("already processed");

  // Don't take back a pass that a newer, unrefunded payment paid for.
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("product_id", payment.product_id)
    .is("refunded_at", null);
  if (count) return new Response("ok (other payment still active)");

  const revoked = await revokePass(db, payment.product_id);
  if (!revoked.ok) {
    await db.from("payments").update({ refunded_at: null }).eq("provider", p.provider).eq("payment_ref", p.paymentRef);
    return new Response("revoke failed", { status: 500 });
  }
  return new Response("ok");
}
