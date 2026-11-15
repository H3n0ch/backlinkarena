"use server";

import { getUser } from "@/lib/auth";
import { getCounts } from "@/lib/data";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult, Counts } from "@/lib/types";
import { cleanRef } from "@/lib/url";
import { friendlyDbError } from "./errors";

const UUID = /^[0-9a-f-]{36}$/i;

export type VoteResult = { counts: Counts; nextMatchId: string | null };

export async function castVote(
  matchId: string,
  productId: string,
  ref?: string | null,
): Promise<ActionResult<VoteResult>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in to vote." };
  if (!UUID.test(matchId) || !UUID.test(productId)) return { ok: false, error: "Invalid vote." };

  const supabase = await createSupabaseServer();

  // Fast, friendly checks; the database trigger enforces the same rules authoritatively.
  const { data: match } = await supabase
    .from("matches")
    .select("product_a, product_b, status, starts_at, ends_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Matchup not found." };
  const now = Date.now();
  if (match.status !== "open" || now < Date.parse(match.starts_at) || now >= Date.parse(match.ends_at)) {
    return { ok: false, error: "This matchup is closed." };
  }
  const { count: owned } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("id", [match.product_a, match.product_b].filter(Boolean))
    .eq("owner_id", user.id);
  if (owned) return { ok: false, error: "You can't vote in your own matchup." };

  const { error } = await supabase.from("votes").insert({
    match_id: matchId,
    voter_id: user.id,
    product_id: productId,
    ref: cleanRef(ref),
  });
  if (error) {
    return { ok: false, error: friendlyDbError(error, "You already voted in this matchup.") };
  }

  const [counts, { data: remaining }] = await Promise.all([
    getCounts(matchId),
    supabase.rpc("my_unvoted_open_matches"),
  ]);
  const next = ((remaining ?? []) as string[]).find((id) => id !== matchId) ?? null;
  return { ok: true, data: { counts, nextMatchId: next } };
}

export async function castQualifyingVote(
  tournamentId: string,
  productId: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in to vote." };
  if (!UUID.test(tournamentId) || !UUID.test(productId)) return { ok: false, error: "Invalid vote." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("qualifying_votes").insert({
    tournament_id: tournamentId,
    product_id: productId,
    voter_id: user.id,
  });
  if (error) return { ok: false, error: friendlyDbError(error, "You already voted for this product.") };
  return { ok: true };
}
