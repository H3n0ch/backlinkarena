import "server-only";
import DodoPayments from "dodopayments";

/** True once the API key and the $29 product (created in the Dodo dashboard) are set. */
export const DODO_CONFIGURED = Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PASS_PRODUCT_ID);

let client: DodoPayments | null = null;

/**
 * Server-only Dodo Payments client. Test mode unless DODO_PAYMENTS_ENVIRONMENT=live_mode,
 * so a missing setting never charges real cards. Throws if DODO_PAYMENTS_API_KEY is missing.
 */
export function dodo(): DodoPayments {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY is not set");
  client ??= new DodoPayments({
    bearerToken: key,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
  });
  return client;
}
