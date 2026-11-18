"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { runEngine } from "@/lib/tournament-emails";
import type { ActionResult } from "@/lib/types";

// Admin control room: seats, pause/resume, stop, disqualify. Needs migration 0009.

type Db = ReturnType<typeof createSupabaseAdmin>;
const uuid = z.guid();

async function admin(): Promise<Db> {
  const user = await getUser();
  if (!user?.isAdmin) throw new Error("Not allowed");
  return createSupabaseAdmin();
}
function ok(message: string): ActionResult {
  refresh();
  return { ok: true, message };
}
function fail(error: string | { message: string } | null): ActionResult {
  return { ok: false, error: typeof error === "string" ? error : (error?.message ?? "Something went wrong.") };
}

type EntryRow = {
  id: string;
  tournament_id: string;
  product_id: string;
  entry_path: "free" | "badge" | "pass";
  seat: number | null;
  vote_adjust: number;
  disqualified_at: string | null;
  created_at: string;
};

async function entryWithTournament(db: Db, entryId: string) {
  if (!uuid.safeParse(entryId).success) return null;
  const { data: e } = await db.from("entries").select("*").eq("id", entryId).maybeSingle();
  if (!e) return null;
  const { data: t } = await db.from("tournaments").select("*").eq("id", e.tournament_id).single();
  return t ? { e: e as EntryRow, t } : null;
}

const SEATABLE = ["draft", "qualifying"];

// ---------------------------------------------------------------------------
// Seats (before the bracket starts)
// ---------------------------------------------------------------------------

/** Puts an entry into a seat. If the seat is taken, the two swap places. */
export async function placeInSeat(entryId: string, seat: number): Promise<ActionResult> {
  const db = await admin();
  const x = await entryWithTournament(db, entryId);
  if (!x) return fail("Entry not found.");
  const { e, t } = x;
  if (!SEATABLE.includes(t.status)) return fail("Seats can only be changed before the bracket starts.");
  if (e.disqualified_at) return fail("This brand is disqualified. Reinstate it first.");
  const s = Math.trunc(Number(seat));
  if (!(s >= 1 && s <= t.bracket_size)) return fail(`Pick a seat from 1 to ${t.bracket_size}.`);
  if (e.seat === s) return ok("Already in that seat.");

  const { data: occupant } = await db
    .from("entries")
    .select("id")
    .eq("tournament_id", t.id)
    .eq("seat", s)
    .maybeSingle();
  if (occupant) await db.from("entries").update({ seat: null }).eq("id", occupant.id);
  const { error } = await db.from("entries").update({ seat: s }).eq("id", e.id);
  if (error) return fail(error);
  if (occupant) await db.from("entries").update({ seat: e.seat }).eq("id", occupant.id);
  return ok(occupant ? (e.seat ? `Swapped into seat ${s}.` : `Placed in seat ${s}; the previous brand went back to waiting.`) : `Placed in seat ${s}.`);
}

/** Puts an entry into the first empty seat. */
export async function placeInNextSeat(entryId: string): Promise<ActionResult> {
  const db = await admin();
  const x = await entryWithTournament(db, entryId);
  if (!x) return fail("Entry not found.");
  const { data: taken } = await db.from("entries").select("seat").eq("tournament_id", x.t.id).not("seat", "is", null);
  const used = new Set((taken ?? []).map((r) => r.seat as number));
  for (let s = 1; s <= x.t.bracket_size; s++) {
    if (!used.has(s)) return placeInSeat(entryId, s);
  }
  return fail("All seats are taken. Remove someone first.");
}

export async function removeFromSeat(entryId: string): Promise<ActionResult> {
  const db = await admin();
  const x = await entryWithTournament(db, entryId);
  if (!x) return fail("Entry not found.");
  if (!SEATABLE.includes(x.t.status)) return fail("Seats can only be changed before the bracket starts.");
  const { error } = await db.from("entries").update({ seat: null }).eq("id", entryId);
  return error ? fail(error) : ok("Back on the waiting list.");
}

/**
 * Fills every empty seat. Who gets in follows the ranking (paid pass by who paid first, badge, most votes);
 * where they sit tries to put brands from the same niche against each other.
 */
export async function autoFillSeats(tournamentId: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(tournamentId).success) return fail("Bad id.");
  const { data: t } = await db.from("tournaments").select("*").eq("id", tournamentId).single();
  if (!t || !SEATABLE.includes(t.status)) return fail("Seats can only be changed before the bracket starts.");
  const [{ data: rows }, { data: qv }, { data: paid }] = await Promise.all([
    db.from("entries").select("*").eq("tournament_id", t.id).is("disqualified_at", null),
    db.from("qualifying_votes").select("product_id").eq("tournament_id", t.id),
    db.from("products").select("id, pass_paid_at").not("pass_paid_at", "is", null),
  ]);
  const entries = (rows ?? []) as EntryRow[];
  const paidAt = new Map((paid ?? []).map((p) => [p.id as string, p.pass_paid_at as string]));
  // Paid passes go in payment order; everyone else by when they entered.
  const at = (e: EntryRow) => (e.entry_path === "pass" ? (paidAt.get(e.product_id) ?? e.created_at) : e.created_at);
  const votes = new Map<string, number>();
  for (const v of qv ?? []) votes.set(v.product_id as string, (votes.get(v.product_id as string) ?? 0) + 1);
  const rank = (e: EntryRow) => (e.entry_path === "pass" ? 0 : e.entry_path === "badge" ? 1 : 2);
  const waiting = entries
    .filter((e) => !e.seat)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (rank(a) === 2
          ? (votes.get(b.product_id) ?? 0) + (b.vote_adjust ?? 0) - ((votes.get(a.product_id) ?? 0) + (a.vote_adjust ?? 0))
          : 0) ||
        at(a).localeCompare(at(b)),
    );
  // Who gets in is decided by rank; where they sit is decided by niche.
  const bySeat = new Map(entries.filter((e) => e.seat).map((e) => [e.seat!, e]));
  const empty: number[] = [];
  for (let s = 1; s <= t.bracket_size; s++) if (!bySeat.has(s)) empty.push(s);
  const chosen = waiting.slice(0, empty.length);
  const { data: cats } = await db
    .from("products")
    .select("id, category")
    .in("id", [...entries.map((e) => e.product_id)]);
  const niche = new Map((cats ?? []).map((c) => [c.id as string, String(c.category ?? "").trim().toLowerCase()]));
  const nicheOf = (e: EntryRow) => niche.get(e.product_id) ?? "";
  const pool = [...chosen];
  const takeSameNiche = (key: string) => {
    if (!key) return null;
    const k = pool.findIndex((e) => nicheOf(e) === key);
    return k >= 0 ? pool.splice(k, 1)[0] : null;
  };
  const plan = new Map<number, EntryRow>();
  // 1) Half-filled matches: give the empty seat a brand from the same niche as the seated one.
  for (const s of empty) {
    const partner = bySeat.get(s % 2 === 1 ? s + 1 : s - 1);
    if (partner) {
      const e = takeSameNiche(nicheOf(partner));
      if (e) plan.set(s, e);
    }
  }
  // 2) Empty matches: seat same-niche brands together, best-ranked first.
  for (let s = 1; s < t.bracket_size; s += 2) {
    if (bySeat.has(s) || bySeat.has(s + 1) || plan.has(s) || plan.has(s + 1)) continue;
    const first = pool.shift();
    if (!first) break;
    plan.set(s, first);
    const mate = takeSameNiche(nicheOf(first));
    if (mate) plan.set(s + 1, mate);
  }
  // 3) Whatever is left fills the remaining empty seats in rank order.
  for (const s of empty) {
    if (!plan.has(s) && pool.length) plan.set(s, pool.shift()!);
  }
  let n = 0;
  for (const [s, e] of plan) {
    const { error } = await db.from("entries").update({ seat: s }).eq("id", e.id);
    if (error) return fail(error);
    n++;
  }
  return ok(n ? `Placed ${n} brand${n === 1 ? "" : "s"}.` : "No empty seats or nobody waiting.");
}

export async function clearSeats(tournamentId: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(tournamentId).success) return fail("Bad id.");
  const { data: t } = await db.from("tournaments").select("status").eq("id", tournamentId).single();
  if (!t || !SEATABLE.includes(t.status)) return fail("Seats can only be changed before the bracket starts.");
  const { error } = await db.from("entries").update({ seat: null }).eq("tournament_id", tournamentId);
  return error ? fail(error) : ok("All seats cleared.");
}

// ---------------------------------------------------------------------------
// Pause / resume / stop
// ---------------------------------------------------------------------------

export async function pauseTournament(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const { error } = await db
    .from("tournaments")
    .update({ paused_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "finished")
    .is("paused_at", null);
  return error ? fail(error) : ok("Paused. No votes are accepted and timers are frozen until you resume.");
}

/** Resumes and pushes every running timer back by the time it was paused. */
export async function resumeTournament(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const { data: t } = await db.from("tournaments").select("*").eq("id", id).single();
  if (!t?.paused_at) return fail("Not paused.");
  const ms = Math.max(0, Date.now() - Date.parse(t.paused_at));
  const shift = (iso: string | null) => (iso ? new Date(Date.parse(iso) + ms).toISOString() : iso);

  const { data: open } = await db.from("matches").select("id, ends_at").eq("tournament_id", id).eq("status", "open");
  for (const m of open ?? []) {
    await db.from("matches").update({ ends_at: shift(m.ends_at as string) }).eq("id", m.id);
  }
  const patch: Record<string, unknown> = { paused_at: null };
  if (t.status === "qualifying" || t.status === "draft") patch.qualifying_ends_at = shift(t.qualifying_ends_at);
  const { error } = await db.from("tournaments").update(patch).eq("id", id);
  if (error) return fail(error);
  const mins = Math.round(ms / 60000);
  return ok(`Resumed. Timers moved back by ${mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`}.`);
}

/**
 * Stops the tournament for good: open matches close without a winner, it's marked finished
 * with no champion, and unused Contender Passes are given back so they carry to the next one.
 */
export async function stopTournament(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const { data: t } = await db.from("tournaments").select("*").eq("id", id).single();
  if (!t || t.status === "finished") return fail("Tournament is already finished.");
  await db.from("matches").update({ status: "closed", winner_product_id: null }).eq("tournament_id", id).eq("status", "open");
  // Brands that paid for this tournament get their pass back.
  const { data: paid } = await db
    .from("entries")
    .select("product_id")
    .eq("tournament_id", id)
    .eq("entry_path", "pass")
    .is("disqualified_at", null);
  const ids = (paid ?? []).map((r) => r.product_id as string);
  if (ids.length) await db.from("products").update({ pass_paid: true }).in("id", ids);
  const { error } = await db
    .from("tournaments")
    .update({ status: "finished", winner_product_id: null, paused_at: null, qualifying_overtime: false })
    .eq("id", id);
  if (error) return fail(error);
  return ok(`Tournament stopped.${ids.length ? ` ${ids.length} paid pass${ids.length === 1 ? "" : "es"} restored for the next tournament.` : ""}`);
}

// ---------------------------------------------------------------------------
// Disqualify / reinstate
// ---------------------------------------------------------------------------

/**
 * Disqualifies a brand. Before the bracket: it leaves its seat and the leaderboard.
 * In the bracket: its open match closes and the opponent goes through.
 */
export async function disqualifyEntry(entryId: string, reason: string): Promise<ActionResult> {
  const db = await admin();
  const x = await entryWithTournament(db, entryId);
  if (!x) return fail("Entry not found.");
  const { e, t } = x;
  if (e.disqualified_at) return fail("Already disqualified.");
  const dq = { disqualified_at: new Date().toISOString(), dq_reason: reason.trim().slice(0, 300) || null };

  if (t.status !== "bracket") {
    const { error } = await db
      .from("entries")
      .update({ ...dq, seat: null, qualified: false, eliminated_round: 0 })
      .eq("id", e.id);
    return error ? fail(error) : ok("Disqualified.");
  }

  const { data: m } = await db
    .from("matches")
    .select("*")
    .eq("tournament_id", t.id)
    .eq("status", "open")
    .or(`product_a.eq.${e.product_id},product_b.eq.${e.product_id}`)
    .maybeSingle();
  let round = m?.round as number | undefined;
  if (m) {
    const opponent = (m.product_a === e.product_id ? m.product_b : m.product_a) as string | null;
    const { error } = await db
      .from("matches")
      .update({ status: "closed", winner_product_id: opponent, ends_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) return fail(error);
    // Winner into the next round's slot if that match already exists.
    await db
      .from("matches")
      .update({ [m.position % 2 === 1 ? "product_a" : "product_b"]: opponent })
      .eq("tournament_id", t.id)
      .eq("round", m.round + 1)
      .eq("position", Math.ceil(m.position / 2));
  } else {
    const { data: last } = await db
      .from("matches")
      .select("round")
      .eq("tournament_id", t.id)
      .or(`product_a.eq.${e.product_id},product_b.eq.${e.product_id}`)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    round = (last?.round as number | undefined) ?? 0;
  }
  const { error } = await db
    .from("entries")
    .update({ ...dq, qualified: false, eliminated_round: round ?? 0 })
    .eq("id", e.id);
  if (error) return fail(error);
  await runEngine(db);
  return ok(m ? "Disqualified. The opponent goes through." : "Disqualified.");
}

/** Undo a disqualification (only before the bracket starts). */
export async function reinstateEntry(entryId: string): Promise<ActionResult> {
  const db = await admin();
  const x = await entryWithTournament(db, entryId);
  if (!x) return fail("Entry not found.");
  if (!SEATABLE.includes(x.t.status)) return fail("Can only reinstate before the bracket starts.");
  const { error } = await db
    .from("entries")
    .update({ disqualified_at: null, dq_reason: null, eliminated_round: null })
    .eq("id", entryId);
  return error ? fail(error) : ok("Reinstated. Back on the waiting list.");
}

/** Adds a site that signed up but isn't in the tournament yet. */
/** Adds every signed-up site that isn't in the tournament yet (paid → pass, verified badge → badge, else free). */
export async function addAllToTournament(tournamentId: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(tournamentId).success) return fail("Bad id.");
  const [{ data: products }, { data: entries }] = await Promise.all([
    db.from("products").select("id, pass_paid, badge_status"),
    db.from("entries").select("product_id").eq("tournament_id", tournamentId),
  ]);
  const inIt = new Set((entries ?? []).map((e) => e.product_id as string));
  const rows = (products ?? [])
    .filter((p) => !inIt.has(p.id))
    .map((p) => ({
      product_id: p.id,
      tournament_id: tournamentId,
      entry_path: p.pass_paid ? "pass" : p.badge_status === "verified" ? "badge" : "free",
    }));
  if (!rows.length) return ok("Everyone is already in.");
  const { error } = await db.from("entries").upsert(rows, { onConflict: "tournament_id,product_id", ignoreDuplicates: true });
  return error ? fail(error) : ok(`Added ${rows.length} ${rows.length === 1 ? "site" : "sites"}.`);
}

export async function addToTournament(productId: string, tournamentId: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(productId).success || !uuid.safeParse(tournamentId).success) return fail("Bad id.");
  const { data: p } = await db.from("products").select("pass_paid, badge_status").eq("id", productId).single();
  const path = p?.pass_paid ? "pass" : p?.badge_status === "verified" ? "badge" : "free";
  const { error } = await db.from("entries").insert({ product_id: productId, tournament_id: tournamentId, entry_path: path });
  if (error?.code === "23505") return fail("Already in this tournament.");
  return error ? fail(error) : ok("Added to the waiting list.");
}
