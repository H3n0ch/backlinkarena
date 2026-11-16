import "server-only";
import Stripe from "stripe";

/** Contender Pass price in cents (USD). Used when STRIPE_PASS_PRICE_ID isn't set. */
export const PASS_AMOUNT_CENTS = 7900;

export const STRIPE_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;

/** Server-only Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}
