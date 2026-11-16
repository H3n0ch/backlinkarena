"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { skipQualifying } from "@/lib/entries";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url";

async function admin() {
  const user = await getUser();
  if (!user?.isAdmin) throw new Error("Not allowed");
  return createSupabaseAdmin();
}

function done(message?: string): ActionResult {
  refresh();
  return { ok: true, message };
}

const NewTournament = z.object({
  name: z.string().trim().min(1).max(100),
  qualifyingEndsAt: z.string().min(1),
  matchHours: z.coerce.number().int().min(1).max(720),
  bracketSize: z.coerce.number().refine((n) => n === 8 || n === 16),
});

export async function createTournament(input: z.input<typeof NewTournament>): Promise<ActionResult> {
  const db = await admin();
  const p = NewTournament.safeParse(input);
  if (!p.success) return { ok: false, error: "Please check the fields." };
  const endsAt = new Date(p.data.qualifyingEndsAt);
  if (Number.isNaN(endsAt.getTime())) return { ok: false, error: "Invalid qualifying end time." };
  const { error } = await db.from("tournaments").insert({
    name: p.data.name,
    qualifying_ends_at: endsAt.toISOString(),
    match_hours: p.data.matchHours,
    bracket_size: p.data.bracketSize,
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Finish the current tournament first." : error.message,
    };
  }
  return done("Tournament created as draft.");
}

export async function updateTournamentTimes(
  id: string,
  qualifyingEndsAt: string,
  matchHours: number,
): Promise<ActionResult> {
  const db = await admin();
  const endsAt = new Date(qualifyingEndsAt);
  if (Number.isNaN(endsAt.getTime())) return { ok: false, error: "Invalid date." };
  const hours = Math.round(Number(matchHours));
  if (!(hours >= 1 && hours <= 720)) return { ok: false, error: "Match hours must be 1–720." };
  const { error } = await db
    .from("tournaments")
    .update({ qualifying_ends_at: endsAt.toISOString(), match_hours: hours })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : done("Saved.");
}

export async function startQualifying(id: string): Promise<ActionResult> {
  const db = await admin();
  const { data: t } = await db.from("tournaments").select("*").eq("id", id).single();
  if (!t || t.status !== "draft") return { ok: false, error: "Tournament is not a draft." };
  const endsAt =
    t.qualifying_ends_at && Date.parse(t.qualifying_ends_at) > Date.now()
      ? t.qualifying_ends_at
      : new Date(Date.now() + 72 * 3600_000).toISOString();
  const { error } = await db
    .from("tournaments")
    .update({ status: "qualifying", qualifying_ends_at: endsAt })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : done("Qualifying started.");
}

export async function startBracketNow(id: string): Promise<ActionResult> {
  const db = await admin();
  // The engine seeds from qualifying, so move a draft forward first.
  await db.from("tournaments").update({ status: "qualifying" }).eq("id", id).eq("status", "draft");
  const { data, error } = await db.rpc("advance_tournaments", { p_force_bracket: id });
  if (error) return { ok: false, error: error.message };
  const row = (data as { tournament: string; seeded: boolean | null }[]).find((r) => r.tournament === id);
  if (row?.seeded === false) {
    const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("tournament_id", id);
    const { data: t } = await db.from("tournaments").select("bracket_size").eq("id", id).single();
    return { ok: false, error: `Bracket isn't full yet: ${count ?? 0}/${t?.bracket_size ?? "?"} spots filled.` };
  }
  return done("Bracket started.");
}

export async function runEngineNow(): Promise<ActionResult> {
  const db = await admin();
  const { data, error } = await db.rpc("advance_tournaments");
  return error ? { ok: false, error: error.message } : done(`Engine ran: ${JSON.stringify(data)}`);
}

export async function verifyBadge(productId: string): Promise<ActionResult> {
  const db = await admin();
  const { error } = await db.from("products").update({ badge_status: "verified" }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await skipQualifying(db, productId, "badge");
  return done("Badge verified.");
}

export async function rejectBadge(productId: string): Promise<ActionResult> {
  const db = await admin();
  const { error } = await db.from("products").update({ badge_status: "none" }).eq("id", productId);
  return error ? { ok: false, error: error.message } : done("Badge reset.");
}

export async function markPassPaid(productId: string): Promise<ActionResult> {
  const db = await admin();
  const { error } = await db.from("products").update({ pass_paid: true }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await skipQualifying(db, productId, "pass");
  return done("Pass marked as paid.");
}

export async function removeProduct(productId: string): Promise<ActionResult> {
  const db = await admin();
  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`product_a.eq.${productId},product_b.eq.${productId}`);
  if (count) return { ok: false, error: "This product is in a bracket match and can't be removed." };
  const { error } = await db.from("products").delete().eq("id", productId);
  return error ? { ok: false, error: error.message } : done("Product removed.");
}

async function profileIdByEmail(db: ReturnType<typeof createSupabaseAdmin>, email: string) {
  const { data } = await db
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function removeVote(matchId: string, voterEmail: string): Promise<ActionResult> {
  const db = await admin();
  const voter = await profileIdByEmail(db, voterEmail);
  if (!voter) return { ok: false, error: "No user with that email." };
  const { error, count } = await db
    .from("votes")
    .delete({ count: "exact" })
    .eq("match_id", matchId.trim())
    .eq("voter_id", voter);
  if (error) return { ok: false, error: error.message };
  return done(count ? "Vote removed." : "No vote found.");
}

export async function removeAllVotesByVoter(voterEmail: string): Promise<ActionResult> {
  const db = await admin();
  const voter = await profileIdByEmail(db, voterEmail);
  if (!voter) return { ok: false, error: "No user with that email." };
  const [a, b] = await Promise.all([
    db.from("votes").delete({ count: "exact" }).eq("voter_id", voter),
    db.from("qualifying_votes").delete({ count: "exact" }).eq("voter_id", voter),
  ]);
  if (a.error || b.error) return { ok: false, error: (a.error ?? b.error)!.message };
  return done(`Removed ${a.count ?? 0} match votes and ${b.count ?? 0} qualifying votes.`);
}

export async function markPrizeDelivered(tournamentId: string, prizeUrl: string): Promise<ActionResult> {
  const db = await admin();
  const url = safeHttpUrl(prizeUrl.trim());
  if (!url) return { ok: false, error: "Enter the full URL of the placed backlink." };
  const { error } = await db
    .from("tournaments")
    .update({ prize_url: url, prize_delivered_at: new Date().toISOString() })
    .eq("id", tournamentId)
    .eq("status", "finished");
  return error ? { ok: false, error: error.message } : done("Prize marked as delivered.");
}
