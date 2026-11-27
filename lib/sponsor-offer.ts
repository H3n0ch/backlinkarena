/** Tournament sponsorship offer: shared by the /sponsor page, the sponsor card and checkout. */

/** Price per tournament in cents (USD). Used for Stripe when STRIPE_SPONSOR_PRICE_ID isn't set. */
export const SPONSOR_AMOUNT_CENTS = 49900;
export const SPONSOR_PRICE = "$499";

export const SPONSOR_LIMITS = { brandName: 60, tagline: 90, website: 300, logoUrl: 500 } as const;

export type SponsorStatus = "pending_payment" | "paid" | "approved" | "paused" | "rejected" | "refunded";

/** What the public sponsor card needs. */
export type PublicSponsor = {
  id: string;
  brand_name: string;
  tagline: string;
  logo_url: string | null;
  website: string;
};
