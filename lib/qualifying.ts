import "server-only";
import { getLeaderboard } from "@/lib/data";
import { readGuestId } from "@/lib/guest";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Product ids the current visitor (user or guest browser) already gave a qualifying vote in this tournament. */
export async function qualifyingVotedSet(tournamentId: string, userId?: string | null): Promise<Set<string>> {
  if (userId) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("qualifying_votes")
      .select("product_id")
      .eq("tournament_id", tournamentId)
      .eq("voter_id", userId);
    return new Set((data ?? []).map((r) => r.product_id as string));
  }
  const guestId = await readGuestId();
  if (!guestId) return new Set();
  const { data } = await createSupabaseAdmin()
    .from("qualifying_votes")
    .select("product_id")
    .eq("tournament_id", tournamentId)
    .eq("guest_id", guestId);
  return new Set((data ?? []).map((r) => r.product_id as string));
}

export type QualifyingStanding = {
  /** 1-based place on the leaderboard (paid / badge first, then free by votes). */
  rank: number;
  votes: number;
  /** Total brands on the leaderboard. */
  total: number;
  /** Bracket size: places 1..size get in. */
  size: number;
  /** Votes needed to pass the brand on the last qualifying place (0 if already in). */
  votesToQualify: number;
};

/** Where a free entry stands in qualifying, in the same order the leaderboard shows. */
export async function qualifyingStanding(
  tournament: { id: string; bracket_size: number },
  productId: string,
): Promise<QualifyingStanding | null> {
  const rows = await getLeaderboard(tournament.id);
  const ordered = [...rows.filter((r) => r.entry_path !== "free"), ...rows.filter((r) => r.entry_path === "free")];
  const i = ordered.findIndex((r) => r.product.id === productId);
  // Paid / badge entries skip qualifying, so only free entries have a standing worth showing.
  if (i < 0 || ordered[i].entry_path !== "free") return null;
  const size = tournament.bracket_size;
  const votes = ordered[i].votes;
  const last = ordered[size - 1];
  const votesToQualify = i < size || !last ? 0 : Math.max(1, last.votes - votes + 1);
  return { rank: i + 1, votes, total: ordered.length, size, votesToQualify };
}

/** Share text for a free entrant asking for qualifying votes. */
export function qualifyingPostText(name: string, link: string) {
  return `${name} is in qualifying on Backlink Arena 🥊 The most-voted brands get into the bracket. One click, no sign-up, and it gets us in: ${link}`;
}
