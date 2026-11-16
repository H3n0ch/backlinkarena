"use server";

import { getUser } from "@/lib/auth";
import { getCounts } from "@/lib/data";
import { clientIpHash, getOrCreateGuestId, guestUnvotedOpenMatches } from "@/lib/guest";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult, Counts } from "@/lib/types";
import { cleanRef } from "@/lib/url";
import { friendlyDbError } from "./errors";

const UUID = /^[0-9a-f-]{36}$/i;

export type VoteResult = { counts: Counts; nextMatchId: string | null };

/**
 * One click = one vote. Logged-in users vote with their account (as before);
 * everyone else votes as a guest: one vote per browser per matchup, limited per network.
 */
export async function castVote(
  matchId: string,
  productId: string,
  ref?: string | null,
): Promise<ActionResult<VoteResult>> {
  if (!UUID.test(matchId) || !UUID.test(productId)) return { ok: false, error: "Invalid vote." };
  const user = await getUser();
  const supabase = user ? await createSupabaseServer() : createSupabaseAdmin();

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

  let guestId: string | null = null;
  if (user) {
    const { count: owned } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .in("id", [match.product_a, match.product_b].filter(Boolean))
      .eq("owner_id", user.id);
    if (owned) return { ok: false, error: "You can't vote in your own matchup." };
    const { error } = await supabase
      .from("votes")
      .insert({ match_id: matchId, voter_id: user.id, product_id: productId, ref: cleanRef(ref) });
    if (error) return { ok: false, error: friendlyDbError(error, "You already voted in this matchup.") };
  } else {
    guestId = await getOrCreateGuestId();
    const { error } = await supabase.from("votes").insert({
      match_id: matchId,
      guest_id: guestId,
      ip_hash: await clientIpHash(),
      product_id: productId,
      ref: cleanRef(ref),
    });
    if (error) return { ok: false, error: friendlyDbError(error, "You already voted in this matchup.") };
  }

  const [counts, remaining] = await Promise.all([
    getCounts(matchId),
    user
      ? supabase.rpc("my_unvoted_open_matches").then(({ data }) => (data ?? []) as string[])
      : guestUnvotedOpenMatches(guestId),
  ]);
  const next = remaining.find((id) => id !== matchId) ?? null;
  return { ok: true, data: { counts, nextMatchId: next } };
}

export async function castQualifyingVote(tournamentId: string, productId: string): Promise<ActionResult> {
  if (!UUID.test(tournamentId) || !UUID.test(productId)) return { ok: false, error: "Invalid vote." };
  const user = await getUser();
  if (user) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase
      .from("qualifying_votes")
      .insert({ tournament_id: tournamentId, product_id: productId, voter_id: user.id });
    if (error) return { ok: false, error: friendlyDbError(error, "You already voted for this product.") };
    return { ok: true };
  }
  const db = createSupabaseAdmin();
  const { error } = await db.from("qualifying_votes").insert({
    tournament_id: tournamentId,
    product_id: productId,
    guest_id: await getOrCreateGuestId(),
    ip_hash: await clientIpHash(),
  });
  if (error) return { ok: false, error: friendlyDbError(error, "You already voted for this product.") };
  return { ok: true };
}
