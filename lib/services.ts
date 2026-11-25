/**
 * Services shown in the homepage "Services" section.
 *
 * Prices are based on the supplier lists (Downloads/"Aug Latest Database All niches.xlsx" and
 * "ascend_publications.csv"), counting only English, do-follow sites with real traffic:
 *   niche site DA<50  median cost  $190
 *   niche site DA50+  median cost  $410
 *   media outlet DA50+ (do-follow) median cost  $650
 * Pricing = supplier cost + $100 margin per placement / feature:
 *   1 link   = 1x <=150 (starter, see below)  cost + ~$100 -> $249
 *   3 links  = 3x190            = $570   cost + $300  -> $870
 *   5 links  = 4x190 + 1x410    = $1,170 cost + $500  -> $1,670
 *   (10 links = $3,560 was dropped from the card: too many choices. Quote bigger orders on request.)
 * Press features have no fixed price: quoted per outlet ("On request").
 *
 * Starter (1 link, $249): an entry offer for founders without a budget yet, so they ask at all.
 * Supply check (Nov 2026, English, no nofollow/sponsored note, 5k+ Ahrefs traffic, DA 30+):
 * ~180 sites in Tech / Web / Business / News / Career / Finance / Edu cost <= $150 (half of them $80–120).
 * Hand-pick: many of the cheapest are APK / bio / "write for us" sites, skip those.
 * Cost cap $150 keeps the participant price ($174 at 30% off) above cost.
 */

export type ServiceTier = {
  price: string;
  title: string;
  detail: string;
  tag?: string;
};

export type Service = {
  id: string;
  name: string;
  tagline: string;
  tiers?: ServiceTier[];
  price?: string;
  priceUnit?: string;
  features: string[];
  cta: string;
  featured?: boolean;
  /** Dark card (like the Badge pricing card). */
  dark?: boolean;
  /** Optional visual at the top of the card (from /public). */
  image?: { src: string; width: number; height: number; alt: string };
  /** Optional small badge next to the card title (from /public). */
  icon?: { src: string; width: number; height: number; alt: string };
};

export const SERVICES: Service[] = [
  {
    id: "outreach",
    name: "Backlink Placement",
    tagline: "We do the outreach and get your link into content on relevant, established sites in your industry.",
    tiers: [
      { price: "$249", title: "1 placement", detail: "Niche site, DA 30+, real traffic", tag: "Starter" },
      { price: "$870", title: "3 placements", detail: "Relevant sites in your industry" },
      { price: "$1,670", title: "5 placements", detail: "Incl. 1 DA 50+ site", tag: "Most popular" },
    ],
    features: [
      "Hand-picked sites that match your industry and audience",
      "Personal outreach to real site owners and editors",
      "Do-follow links inside real, relevant content",
      "No PBNs, no link farms, no spam directories",
      "Report with every live link",
    ],
    cta: "Talk to us",
    featured: true,
  },
  {
    // One-off press features (USA Today and similar). No checkout and no fixed price yet:
    // inquiries only, to test demand. Big outlets usually label these "Sponsored" and often
    // nofollow, so the copy sells trust and visibility, never link power.
    id: "media",
    name: "Press Feature",
    tagline: "Get your brand into well-known online media. One feature, one payment, no retainer.",
    price: "On request",
    priceUnit: "one-time",
    features: [
      "Feature in established online media and news sites",
      "An \"As seen in\" logo to show on your website",
      "Trust for visitors, and a source AI search tools like ChatGPT can cite",
      "Marked as sponsored where the outlet requires it",
      "Report with the published article",
    ],
    cta: "Request a quote",
    dark: true,
    image: {
      // Transparent background so it blends into the dark card (original: press-fan.webp).
      src: "/press/press-fan-cutout.webp",
      width: 1556,
      height: 672,
      alt: "Illustration of brand features in online news media",
    },
    icon: { src: "/press/press-logos.webp", width: 449, height: 198, alt: "Online media logos" },
  },
];

/** Participant offer: 30% off, earned by playing and sharing a matchup. Valid for OFFER_DAYS. */
export const PARTICIPANT_DISCOUNT = 0.3;
export const OFFER_DAYS = 7;

/**
 * When a site's run in a tournament ended (knocked out, didn't make the bracket, or tournament over),
 * which starts the participant offer. Null while it's still in. Used by the dashboard and the emails.
 */
export function runEndedAt(o: {
  eliminatedRound: number | null | undefined;
  tournamentFinished: boolean;
  /** ends_at of the site's latest match, if it played one. */
  lastMatchEndsAt: string | null | undefined;
  qualifyingEndsAt: string | null | undefined;
}): Date | null {
  const out = o.eliminatedRound !== null && o.eliminatedRound !== undefined;
  if (!out && !o.tournamentFinished) return null;
  const at = o.lastMatchEndsAt ?? o.qualifyingEndsAt ?? null;
  return at ? new Date(at) : new Date();
}

/** Last moment the participant offer is valid. */
export function offerExpiresAt(runEnded: Date): Date {
  return new Date(runEnded.getTime() + OFFER_DAYS * 86400_000);
}

/** True for a real amount ("$870"), false for "On request". */
export function hasFixedPrice(price: string): boolean {
  return /\d/.test(price);
}

/** "$870" -> "$609" at the participant discount. "On request" stays as is. */
export function participantPrice(price: string): string {
  const n = Number(price.replace(/[^\d.]/g, ""));
  if (!n) return price;
  return `$${Math.round(n * (1 - PARTICIPANT_DISCOUNT)).toLocaleString("en-US")}`;
}

/** Every service + tier as a "Service · Tier" option for the lead form. */
export const SERVICE_OPTIONS: string[] = SERVICES.flatMap((s) =>
  s.tiers ? s.tiers.map((t) => `${s.name} · ${t.title}`) : [s.name],
);

/** Topics for the footer "Contact" form (saved as leads with source "contact"). */
export const CONTACT_TOPICS: string[] = [
  "General question",
  "My tournament entry",
  "Payment or refund",
  "Badge check",
  "Backlink services",
  "Partnership or press",
];

