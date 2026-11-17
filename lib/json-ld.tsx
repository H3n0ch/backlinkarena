import { SITE_URL } from "@/lib/env";
import { SERVICES } from "@/lib/services";

/** Renders schema.org structured data. `<` is escaped so page data can't break out of the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const ORG_ID = `${SITE_URL}/#organization`;

/** Site-wide: who we are and what the site is. Rendered once in the root layout. */
export const SITE_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Backlink Arena",
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon`,
      description:
        "Backlink Arena runs free 1v1 voting tournaments for founders' websites; the champion wins a backlink on a real DA 50+ site in their niche. It also sells white hat backlink placement through manual outreach.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Backlink Arena",
      url: SITE_URL,
      publisher: { "@id": ORG_ID },
    },
  ],
};

/** FAQPage schema from plain question/answer pairs. */
export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Service schema for /services, prices taken from lib/services.ts so they never drift. */
export function servicesSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": SERVICES.map((s) => ({
      "@type": "Service",
      name: s.name,
      serviceType: s.id === "outreach" ? "Link building" : "Press feature",
      description: s.tagline,
      provider: { "@id": ORG_ID },
      url: `${SITE_URL}/services`,
      areaServed: "Worldwide",
      ...(s.tiers
        ? {
            offers: s.tiers.map((t) => ({
              "@type": "Offer",
              name: `${s.name}: ${t.title}`,
              description: t.detail,
              price: t.price.replace(/[^\d.]/g, ""),
              priceCurrency: "USD",
              priceSpecification: {
                "@type": "PriceSpecification",
                minPrice: t.price.replace(/[^\d.]/g, ""),
                priceCurrency: "USD",
              },
            })),
          }
        : {}),
    })),
  };
}
