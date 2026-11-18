"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { checkPageForBadge } from "@/lib/badge-check";
import { sendEmail } from "@/lib/email";
import { badgeRejectedEmail, badgeVerifiedEmail } from "@/lib/email-templates";
import { skipQualifying } from "@/lib/entries";
import { PUBLIC_SITE_URL } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { runEngine } from "@/lib/tournament-emails";
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

const MAX_MATCH_MINUTES = 43200; // 30 days

/** Keeps the old match_hours column roughly in sync (rounded up, 1–720). */
const hoursFor = (min: number) => Math.min(720, Math.max(1, Math.ceil(min / 60)));

const NewTournament = z.object({
  name: z.string().trim().min(1).max(100),
  qualifyingEndsAt: z.string().min(1),
  matchMinutes: z.coerce.number().int().min(1).max(MAX_MATCH_MINUTES),
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
    match_minutes: p.data.matchMinutes,
    match_hours: hoursFor(p.data.matchMinutes),
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

// ---------------------------------------------------------------------------
// Timers. Each change runs the engine right away, so a timer moved into the past
// closes / seeds immediately, and open public pages pick it up within seconds.
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof createSupabaseAdmin>;

async function loadTimed(db: Db, id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const { data: t } = await db.from("tournaments").select("*").eq("id", id).single();
  return t ?? null;
}

async function engineThenDone(db: Db, message: string): Promise<ActionResult> {
  await runEngine(db);
  return done(message);
}

/** Sets qualifying end and match length. Before the bracket only (open matches use shiftTimers). */
export async function updateTournamentTimes(
  id: string,
  qualifyingEndsAt: string,
  matchMinutes: number,
): Promise<ActionResult> {
  const db = await admin();
  const endsAt = new Date(qualifyingEndsAt);
  if (Number.isNaN(endsAt.getTime())) return { ok: false, error: "Invalid date." };
  const min = Math.round(Number(matchMinutes));
  if (!(min >= 1 && min <= MAX_MATCH_MINUTES)) return { ok: false, error: "Match length must be 1 minute to 30 days." };
  const { error } = await db
    .from("tournaments")
    .update({ qualifying_ends_at: endsAt.toISOString(), match_minutes: min, match_hours: hoursFor(min) })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : engineThenDone(db, "Saved.");
}

/**
 * Moves the running timer by `minutes` (negative = sooner): the qualifying end before the
 * bracket, or every open match in the bracket. `minutes: null` ends it now.
 */
export async function shiftTimers(id: string, minutes: number | null): Promise<ActionResult> {
  const db = await admin();
  const t = await loadTimed(db, id);
  if (!t) return { ok: false, error: "Tournament not found." };
  const now = Date.now();
  const move = (iso: string | null) =>
    new Date(minutes === null ? now : Math.max(now, Date.parse(iso ?? new Date(now).toISOString()) + minutes * 60_000)).toISOString();

  if (t.status === "draft" || t.status === "qualifying") {
    const { error } = await db.from("tournaments").update({ qualifying_ends_at: move(t.qualifying_ends_at) }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (t.status === "draft") return done(minutes === null ? "Qualifying end set to now (opens when you start qualifying)." : "Qualifying end moved.");
    return engineThenDone(db, minutes === null ? "Qualifying ended." : "Qualifying end moved.");
  }
  if (t.status === "bracket") {
    const { data: open } = await db.from("matches").select("id, ends_at").eq("tournament_id", id).eq("status", "open");
    if (!open?.length) return { ok: false, error: "No open matches." };
    for (const m of open) {
      const { error } = await db.from("matches").update({ ends_at: move(m.ends_at as string) }).eq("id", m.id);
      if (error) return { ok: false, error: error.message };
    }
    const n = open.length;
    return engineThenDone(db, minutes === null ? `Ended ${n} open match${n === 1 ? "" : "es"}.` : `Moved ${n} open match${n === 1 ? "" : "es"}.`);
  }
  return { ok: false, error: "Tournament is finished." };
}

/** Sets the match length for upcoming matches; `restartOpen` also restarts open matches with it. */
export async function setMatchLength(id: string, matchMinutes: number, restartOpen: boolean): Promise<ActionResult> {
  const db = await admin();
  const t = await loadTimed(db, id);
  if (!t) return { ok: false, error: "Tournament not found." };
  const min = Math.round(Number(matchMinutes));
  if (!(min >= 1 && min <= MAX_MATCH_MINUTES)) return { ok: false, error: "Match length must be 1 minute to 30 days." };
  const { error } = await db.from("tournaments").update({ match_minutes: min, match_hours: hoursFor(min) }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!restartOpen) return done("Match length saved for the next matches.");
  const endsAt = new Date(Date.now() + min * 60_000).toISOString();
  const { error: e2, count } = await db
    .from("matches")
    .update({ ends_at: endsAt }, { count: "exact" })
    .eq("tournament_id", id)
    .eq("status", "open");
  if (e2) return { ok: false, error: e2.message };
  return engineThenDone(db, `Match length saved. ${count ?? 0} open match${count === 1 ? "" : "es"} now end in ${min} min.`);
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
  const { data, error } = await runEngine(db, { p_force_bracket: id });
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
  const { data, error } = await runEngine(db);
  return error ? { ok: false, error: error.message } : done(`Engine ran: ${JSON.stringify(data)}`);
}

type Admin = ReturnType<typeof createSupabaseAdmin>;

/** The product plus its owner's email, for badge emails. */
async function badgeProduct(db: Admin, productId: string) {
  const { data: p } = await db
    .from("products")
    .select("id, name, url, badge_status, badge_page, owner_id")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return null;
  const { data: owner } = await db.from("profiles").select("email").eq("id", p.owner_id).maybeSingle();
  return { ...p, page: (p.badge_page as string | null) ?? (p.url as string), email: (owner?.email as string | null) ?? null };
}

/** Marks the badge verified, upgrades an open free entry, and tells the owner (once). */
async function approveBadge(db: Admin, productId: string): Promise<ActionResult> {
  const p = await badgeProduct(db, productId);
  if (!p) return { ok: false, error: "Product not found." };
  const { error } = await db
    .from("products")
    .update({ badge_status: "verified", badge_requested_at: null })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  const tournament = await skipQualifying(db, productId, "badge");
  if (p.email && p.badge_status !== "verified") {
    const to = p.email;
    after(() => sendEmail(to, badgeVerifiedEmail({ name: p.name as string, tournament, siteUrl: PUBLIC_SITE_URL })));
  }
  return done(`Badge verified${tournament ? `. ${p.name} is now a badge entry in ${tournament}` : ""}.`);
}

export async function verifyBadge(productId: string): Promise<ActionResult> {
  return approveBadge(await admin(), productId);
}

/** Runs the automatic check again on the page the owner gave. Verifies if the link is there. */
export async function recheckBadge(productId: string): Promise<ActionResult> {
  const db = await admin();
  const p = await badgeProduct(db, productId);
  if (!p) return { ok: false, error: "Product not found." };
  const r = await checkPageForBadge(p.page);
  if (r.found && r.dofollow) return approveBadge(db, productId);
  if (r.found) return { ok: false, error: "Link found, but it's nofollow / sponsored / ugc. Reject, or approve if you accept it." };
  if (!r.reachable) return { ok: false, error: "Couldn't load the page from the server. Open it and check by hand." };
  return {
    ok: false,
    error: "No link in the page HTML. If the site loads with JavaScript, open it and check by hand.",
  };
}

/** Badge not there: back to "none", entry stays free, owner is told what to fix. */
export async function rejectBadge(productId: string): Promise<ActionResult> {
  const db = await admin();
  const p = await badgeProduct(db, productId);
  if (!p) return { ok: false, error: "Product not found." };
  const { error } = await db
    .from("products")
    .update({ badge_status: "none", badge_requested_at: null })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  // A badge entry in the open tournament goes back to free qualifying.
  const { data: t } = await db.from("tournaments").select("id").in("status", ["draft", "qualifying"]).maybeSingle();
  if (t) {
    await db
      .from("entries")
      .update({ entry_path: "free" })
      .eq("tournament_id", t.id)
      .eq("product_id", productId)
      .eq("entry_path", "badge");
  }
  if (p.email && p.badge_status === "pending") {
    const to = p.email;
    after(() => sendEmail(to, badgeRejectedEmail({ name: p.name as string, page: p.page, siteUrl: PUBLIC_SITE_URL })));
  }
  return done(p.badge_status === "pending" ? "Badge rejected. The owner was emailed." : "Badge reset.");
}

export async function markPassPaid(productId: string): Promise<ActionResult> {
  const db = await admin();
  const { error } = await db
    .from("products")
    .update({ pass_paid: true, pass_paid_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("pass_paid", false);
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
