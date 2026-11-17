/**
 * Services shown in the homepage "Services" section.
 *
 * Prices are based on the supplier lists (Downloads/"Aug Latest Database All niches.xlsx" and
 * "ascend_publications.csv"), counting only English, do-follow sites with real traffic:
 *   niche site DA<50  median cost  $190
 *   niche site DA50+  median cost  $410
 *   media outlet DA50+ (do-follow) median cost  $650
 * Pricing = supplier cost + $100 margin per placement / feature:
 *   3 links  = 3x190            = $570   cost + $300  -> $870
 *   5 links  = 4x190 + 1x410    = $1,170 cost + $500  -> $1,670
 *   10 links = 7x190 + 3x410    = $2,560 cost + $1,000 -> $3,560
 *   media    = 650                          cost + $100  -> $750
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
};

export const SERVICES: Service[] = [
  {
    id: "outreach",
    name: "Backlink Placement",
    tagline: "We do the outreach and get your link into content on relevant, established sites in your industry.",
    tiers: [
      { price: "$870", title: "3 placements", detail: "Relevant sites in your industry" },
      { price: "$1,670", title: "5 placements", detail: "Incl. 1 DA 50+ site", tag: "Most popular" },
      { price: "$3,560", title: "10 placements", detail: "Incl. 3 DA 50+ sites", tag: "Best value" },
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
    id: "media",
    name: "Media Placement",
    tagline: "Get your brand featured in online media and publications.",
    price: "$750",
    priceUnit: "per feature",
    features: [
      "We pitch your story to relevant media outlets",
      "Feature or mention with a link to your site",
      "Credibility you can show on your website",
      "Report with the published article",
    ],
    cta: "Talk to us",
  },
];

/** Participant offer: 30% off, earned by playing and sharing a matchup. Valid for OFFER_DAYS. */
export const PARTICIPANT_DISCOUNT = 0.3;
export const OFFER_DAYS = 7;

/** "$870" -> "$609" at the participant discount. */
export function participantPrice(price: string): string {
  const n = Number(price.replace(/[^\d.]/g, ""));
  if (!n) return price;
  return `$${Math.round(n * (1 - PARTICIPANT_DISCOUNT)).toLocaleString("en-US")}`;
}

/** Every service + tier as a "Service · Tier" option for the lead form. */
export const SERVICE_OPTIONS: string[] = SERVICES.flatMap((s) =>
  s.tiers ? s.tiers.map((t) => `${s.name} · ${t.title}`) : [s.name],
);

