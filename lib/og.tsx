import { getMatchView } from "@/lib/data";
import { PUBLIC_SITE_URL } from "@/lib/env";
import { fetchImageDataUrl } from "@/lib/metadata";
import { drawMatchImage } from "@/lib/og-card";
import { roundName } from "@/lib/time";

export { OG_SIZE } from "@/lib/og-card";

/** Draws the share image for a matchup (used by /match/[id] and /vs/[pair]). */
export async function renderMatchImage(id: string) {
  const view = await getMatchView(id);
  const [aLogo, bLogo] = await Promise.all([
    fetchImageDataUrl(view?.a?.logo_url ?? null),
    fetchImageDataUrl(view?.b?.logo_url ?? null),
  ]);
  return drawMatchImage({
    a: { id: view?.a?.id ?? null, name: view?.a?.name ?? "TBD", logo: aLogo, votes: view?.counts.a_votes ?? 0 },
    b: { id: view?.b?.id ?? null, name: view?.b?.name ?? "TBD", logo: bLogo, votes: view?.counts.b_votes ?? 0 },
    closed: view?.match.status === "closed",
    winnerId: view?.match.winner_product_id ?? null,
    round: view ? roundName(view.match.round, view.tournament.bracket_size) : "Head to head",
    tournament: view?.tournament.name ?? "Backlink Arena",
    host: PUBLIC_SITE_URL.replace(/^https?:\/\//, ""),
  });
}

