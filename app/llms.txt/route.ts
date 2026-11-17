import { SITE_URL } from "@/lib/env";
import { OFFER_DAYS, PARTICIPANT_DISCOUNT, SERVICES } from "@/lib/services";

/** /llms.txt: a plain-text summary of the site for AI assistants (https://llmstxt.org). */
export function GET() {
  const services = SERVICES.map((s) => {
    const prices = s.tiers
      ? s.tiers.map((t) => `  - ${t.title} (${t.detail}): from ${t.price}`).join("\n")
      : `  - Price: ${s.price}${s.priceUnit ? ` (${s.priceUnit})` : ""}`;
    return `- **${s.name}**: ${s.tagline}\n${prices}`;
  }).join("\n");

  const body = `# Backlink Arena

> Backlink Arena is a free 1v1 voting tournament for founders' websites. Brands enter their site, get paired in 1v1 matchups and rally their audience to vote. The champion wins a backlink on a real DA 50+ site in their niche, placed by hand. Backlink Arena also sells white hat backlink placement through manual outreach (no PBNs, no link farms).

## How the tournament works

- Entering and voting are free. Voting in a matchup needs no account; each visitor gets one vote per matchup.
- Qualifying: free entries collect votes on a public leaderboard. Brands can skip qualifying by adding the Backlink Arena badge to their site (free) or paying $79 for a guaranteed spot in one tournament. Neither adds votes inside a match.
- Bracket: 8 or 16 brands play 1v1 knockout rounds. Each matchup runs for a set time (usually 24 hours); the brand with more votes advances. Direct competitors are never paired.
- Prize: the champion gets a backlink on a real DA 50+ site in their niche. Everyone who plays gets ${Math.round(PARTICIPANT_DISCOUNT * 100)}% off our backlink services for ${OFFER_DAYS} days.

## Services (paid)

${services}

All placements: hand-picked sites in the client's industry, personal outreach to real site owners and editors, do-follow links inside real content, a report with every live link. Prices depend on the industry and the sites chosen. Press features are usually marked as sponsored by the outlet and sold for trust and visibility, not ranking power.

## Pages

- [Home](${SITE_URL}/): the current tournament, how it works, pricing to enter
- [Services](${SITE_URL}/services): buy high DA backlinks and press features, prices, FAQ
- [Arena](${SITE_URL}/arena): the live bracket and matchups
- [Winners](${SITE_URL}/winners): past champions and their placed backlinks
- [Join](${SITE_URL}/join): enter a website for free
- [Rules](${SITE_URL}/rules): full tournament rules
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
