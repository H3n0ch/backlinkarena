import "server-only";
import { after } from "next/server";
import { sendEmailBatch, type Outgoing } from "@/lib/email";
import {
  behindEmail,
  knockoutEmail,
  matchLiveEmail,
  qualifyingEndingEmail,
  resultsEmail,
  winnerEmail,
  type ExposureStats,
} from "@/lib/email-templates";
import { CONTACT_EMAIL, PUBLIC_SITE_URL } from "@/lib/env";
import { offerExpiresAt, PARTICIPANT_DISCOUNT, runEndedAt } from "@/lib/services";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  LIVE_WINDOW_MS,
  QUALIFYING_WARNING_MS,
  qualifyingStandings,
  roughTimeLeft,
  shouldWarnBehind,
  type QualifyingEntry,
} from "@/lib/nudges";
import { matchPath } from "@/lib/share";
import { roundName, totalRounds } from "@/lib/time";

/*
  Automatic tournament emails (needs migration 0013):
  - Knockout: the moment a brand's run ends (lost a match, or didn't make the bracket):
    exposure stats + the 30% participant offer with its real expiry date.
  - Results: when the final closes. "You won" to the champion, the result to everyone else
    (the runner-up already got their knockout email, so they're skipped).
  - During the tournament (needs migration 0014, rules in lib/nudges.ts):
    "your match is live" when a match opens (round 1 = made the bracket, later = won the last one),
    "you're behind" near the end of a match the brand is losing, and
    "qualifying ends soon" to free entries about a day before the bracket locks.
    Each is claimed in email_log (one row per email) before sending.
  Every row is claimed (knockout_emailed_at / results_emailed_at) before sending, so the
  cron job, the clock route and admin buttons can all call this at once without double emails.
*/

type Db = ReturnType<typeof createSupabaseAdmin>;
type T = {
  id: string;
  name: string;
  status: string;
  bracket_size: number;
  qualifying_ends_at: string | null;
  winner_product_id: string | null;
};
type Claimed = { id: string; tournament_id: string; product_id: string; eliminated_round: number };

/** Runs the engine, then sends any emails it made due (after the response). Use instead of a bare rpc call. */
export async function runEngine(db: Db, args?: { p_force_bracket: string }) {
  const res = args ? await db.rpc("advance_tournaments", args) : await db.rpc("advance_tournaments");
  after(() => sendTournamentEmails());
  return res;
}

/** Sends every due knockout and results email. Idempotent; never throws. */
export async function sendTournamentEmails(): Promise<void> {
  try {
    const db = createSupabaseAdmin();
    await sendKnockouts(db);
    await sendResults(db);
    await sendMatchEmails(db);
    await sendQualifyingEmails(db);
  } catch (err) {
    console.error("tournament emails failed", err);
  }
}

const adminEmail = () => process.env.ADMIN_EMAIL || CONTACT_EMAIL || undefined;

async function ownersOf(db: Db, productIds: string[]) {
  const { data: products } = await db.from("products").select("id, name, owner_id").in("id", productIds);
  const ownerIds = [...new Set((products ?? []).map((p) => p.owner_id as string))];
  const { data: profiles } = ownerIds.length
    ? await db.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] };
  const emailOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? null]));
  return new Map(
    (products ?? []).map((p) => [p.id as string, { name: p.name as string, email: emailOf.get(p.owner_id as string) ?? null }]),
  );
}

async function sendKnockouts(db: Db) {
  const { data: ts, error: tErr } = await db
    .from("tournaments")
    .select("id, name, status, bracket_size, qualifying_ends_at, winner_product_id")
    .in("status", ["bracket", "finished"]);
  if (tErr) return console.error("knockout emails: tournaments", tErr.message);
  if (!ts?.length) return;
  const byId = new Map((ts as T[]).map((t) => [t.id, t]));

  const { data: due, error } = await db
    .from("entries")
    .select("id")
    .in("tournament_id", [...byId.keys()])
    .not("eliminated_round", "is", null)
    .is("knockout_emailed_at", null)
    .is("disqualified_at", null);
  if (error) return console.error("knockout emails: entries (migration 0013 run?)", error.message);
  if (!due?.length) return;

  // Claim: only rows still unclaimed come back, so a parallel run can't send them too.
  const { data: claimedRows, error: claimErr } = await db
    .from("entries")
    .update({ knockout_emailed_at: new Date().toISOString() })
    .in("id", due.map((e) => e.id as string))
    .is("knockout_emailed_at", null)
    .select("id, tournament_id, product_id, eliminated_round");
  if (claimErr) return console.error("knockout emails: claim", claimErr.message);
  const claimed = (claimedRows ?? []) as Claimed[];
  if (!claimed.length) return;

  const productIds = claimed.map((e) => e.product_id);
  const [owners, { data: matchRows }, { data: statRows }] = await Promise.all([
    ownersOf(db, productIds),
    db
      .from("matches")
      .select("tournament_id, product_a, product_b, round, ends_at")
      .in("tournament_id", [...new Set(claimed.map((e) => e.tournament_id))])
      .order("round", { ascending: false }),
    db.rpc("product_exposure", { p_ids: productIds }),
  ]);
  const stats = new Map<string, ExposureStats>(
    ((statRows ?? []) as { product_id: string; views: number; clicks: number; votes: number }[]).map((r) => [
      r.product_id,
      { views: Number(r.views), clicks: Number(r.clicks), votes: Number(r.votes) },
    ]),
  );
  const matches = (matchRows ?? []) as { tournament_id: string; product_a: string | null; product_b: string | null; ends_at: string }[];

  const out: Outgoing[] = [];
  for (const e of claimed) {
    const t = byId.get(e.tournament_id);
    const owner = owners.get(e.product_id);
    if (!t || !owner?.email) continue;
    const last = matches.find(
      (m) => m.tournament_id === t.id && (m.product_a === e.product_id || m.product_b === e.product_id),
    );
    const ended = runEndedAt({
      eliminatedRound: e.eliminated_round,
      tournamentFinished: t.status === "finished",
      lastMatchEndsAt: last?.ends_at,
      qualifyingEndsAt: t.qualifying_ends_at,
    });
    if (!ended) continue;
    const expires = offerExpiresAt(ended);
    if (expires.getTime() < Date.now()) continue; // Offer already over (e.g. old entries): stays claimed, no email.
    const round = e.eliminated_round;
    out.push({
      to: owner.email,
      replyTo: adminEmail(),
      email: knockoutEmail({
        name: owner.name,
        tournament: t.name,
        reached: round === 0 ? "Qualifying" : roundName(round, t.bracket_size),
        round,
        final: round > 0 && round === totalRounds(t.bracket_size),
        stats: stats.get(e.product_id) ?? { views: 0, clicks: 0, votes: 0 },
        expires,
        discount: PARTICIPANT_DISCOUNT,
        siteUrl: PUBLIC_SITE_URL,
      }),
    });
  }
  if (out.length) console.log("knockout emails sent", await sendEmailBatch(out), "of", out.length);
}

async function sendResults(db: Db) {
  const { data: fin, error } = await db
    .from("tournaments")
    .select("id, name, status, bracket_size, qualifying_ends_at, winner_product_id")
    .eq("status", "finished")
    .is("results_emailed_at", null);
  if (error) return console.error("results emails: tournaments (migration 0013 run?)", error.message);

  for (const t of (fin ?? []) as T[]) {
    const { data: claimed } = await db
      .from("tournaments")
      .update({ results_emailed_at: new Date().toISOString() })
      .eq("id", t.id)
      .is("results_emailed_at", null)
      .select("id");
    if (!claimed?.length || !t.winner_product_id) continue; // Taken by a parallel run, or stopped without a winner.

    const { data: entryRows } = await db
      .from("entries")
      .select("product_id, eliminated_round")
      .eq("tournament_id", t.id)
      .is("disqualified_at", null);
    const entries = (entryRows ?? []) as { product_id: string; eliminated_round: number | null }[];
    const finalRound = totalRounds(t.bracket_size);
    const owners = await ownersOf(db, [...new Set([t.winner_product_id, ...entries.map((e) => e.product_id)])]);
    const winner = owners.get(t.winner_product_id);
    if (!winner) continue;

    const out: Outgoing[] = [];
    const seen = new Set<string>();
    if (winner.email) {
      seen.add(winner.email.toLowerCase());
      out.push({
        to: winner.email,
        replyTo: adminEmail(),
        email: winnerEmail({ name: winner.name, tournament: t.name, siteUrl: PUBLIC_SITE_URL }),
      });
    }
    for (const e of entries) {
      if (e.product_id === t.winner_product_id || e.eliminated_round === finalRound) continue; // Runner-up has their email.
      const o = owners.get(e.product_id);
      if (!o?.email || seen.has(o.email.toLowerCase())) continue;
      seen.add(o.email.toLowerCase());
      out.push({
        to: o.email,
        replyTo: adminEmail(),
        email: resultsEmail({ name: o.name, tournament: t.name, winnerName: winner.name, siteUrl: PUBLIC_SITE_URL }),
      });
    }
    if (out.length) console.log("results emails sent", await sendEmailBatch(out), "of", out.length, "for", t.name);
  }
}

// ---------------------------------------------------------------------------
// During the tournament
// ---------------------------------------------------------------------------

/** Keys already in email_log, so we skip them before fetching counts or owners. */
async function alreadySent(db: Db, keys: string[]): Promise<Set<string> | null> {
  if (!keys.length) return new Set();
  const { data, error } = await db.from("email_log").select("key").in("key", keys);
  if (error) {
    console.error("live emails: email_log (migration 0014 run?)", error.message);
    return null;
  }
  return new Set((data ?? []).map((r) => r.key as string));
}

/** Claims email keys; returns only the ones this run won, so parallel runs never double-send. */
async function claim(db: Db, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const { data, error } = await db
    .from("email_log")
    .upsert(
      keys.map((key) => ({ key })),
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select("key");
  if (error) {
    console.error("live emails: claim", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.key as string));
}

type Brand = { name: string; slug: string; email: string | null };

async function brandsOf(db: Db, ids: string[]): Promise<Map<string, Brand>> {
  if (!ids.length) return new Map();
  const { data: products } = await db.from("products").select("id, name, slug, owner_id").in("id", ids);
  const ownerIds = [...new Set((products ?? []).map((p) => p.owner_id as string))];
  const { data: profiles } = ownerIds.length
    ? await db.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] };
  const emailOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? null]));
  return new Map(
    (products ?? []).map((p) => [
      p.id as string,
      { name: p.name as string, slug: p.slug as string, email: emailOf.get(p.owner_id as string) ?? null },
    ]),
  );
}

type LiveMatch = {
  id: string;
  tournament_id: string;
  round: number;
  product_a: string;
  product_b: string;
  starts_at: string;
  ends_at: string;
};

/** "Your match is live" and "you're behind" for every open match. */
async function sendMatchEmails(db: Db) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data: ts } = await db
    .from("tournaments")
    .select("id, name, bracket_size")
    .eq("status", "bracket")
    .is("paused_at", null);
  if (!ts?.length) return;
  const tById = new Map((ts as { id: string; name: string; bracket_size: number }[]).map((t) => [t.id, t]));

  const { data: rows } = await db
    .from("matches")
    .select("id, tournament_id, round, product_a, product_b, starts_at, ends_at")
    .in("tournament_id", [...tById.keys()])
    .eq("status", "open")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .not("product_a", "is", null)
    .not("product_b", "is", null);
  const matches = (rows ?? []) as LiveMatch[];
  if (!matches.length) return;

  // Every email that could be due now; the live one only shortly after the match opens.
  type Candidate = { key: string; kind: "live" | "behind"; m: LiveMatch; mine: string; theirs: string };
  const candidates: Candidate[] = [];
  for (const m of matches) {
    const fresh = now - new Date(m.starts_at).getTime() < LIVE_WINDOW_MS;
    for (const [mine, theirs] of [
      [m.product_a, m.product_b],
      [m.product_b, m.product_a],
    ]) {
      if (fresh) candidates.push({ key: `live:${m.id}:${mine}`, kind: "live", m, mine, theirs });
      candidates.push({ key: `behind:${m.id}:${mine}`, kind: "behind", m, mine, theirs });
    }
  }
  const sent = await alreadySent(db, candidates.map((c) => c.key));
  if (!sent) return;
  let due = candidates.filter((c) => !sent.has(c.key));

  // Public counts (admin adjustments included), only for tournaments that may need a "behind" email.
  const votes = new Map<string, number>(); // `${matchId}:${productId}` -> votes
  for (const tid of new Set(due.filter((c) => c.kind === "behind").map((c) => c.m.tournament_id))) {
    const { data } = await db.rpc("tournament_match_counts", { p_tournament_id: tid });
    for (const r of (data ?? []) as { match_id: string; a_votes: number; b_votes: number }[]) {
      const m = matches.find((x) => x.id === r.match_id);
      if (!m) continue;
      votes.set(`${m.id}:${m.product_a}`, Number(r.a_votes));
      votes.set(`${m.id}:${m.product_b}`, Number(r.b_votes));
    }
  }
  const countOf = (c: Candidate) => ({
    mine: votes.get(`${c.m.id}:${c.mine}`),
    theirs: votes.get(`${c.m.id}:${c.theirs}`),
  });
  due = due.filter((c) => {
    if (c.kind === "live") return true;
    const { mine, theirs } = countOf(c);
    if (mine === undefined || theirs === undefined) return false;
    return shouldWarnBehind({
      now,
      startsAt: new Date(c.m.starts_at).getTime(),
      endsAt: new Date(c.m.ends_at).getTime(),
      mine,
      theirs,
    });
  });
  if (!due.length) return;

  const brands = await brandsOf(db, [...new Set(due.flatMap((c) => [c.mine, c.theirs]))]);
  const won = await claim(db, due.map((c) => c.key));

  const out: Outgoing[] = [];
  for (const c of due) {
    const t = tById.get(c.m.tournament_id);
    const me = brands.get(c.mine);
    const them = brands.get(c.theirs);
    if (!won.has(c.key) || !t || !me?.email || !them) continue;
    const path = matchPath(c.m, brands.get(c.m.product_a)?.slug, brands.get(c.m.product_b)?.slug);
    const shareUrl = `${PUBLIC_SITE_URL}${path}?ref=${encodeURIComponent(me.slug)}`;
    const round = roundName(c.m.round, t.bracket_size);
    const timeLeft = roughTimeLeft(new Date(c.m.ends_at).getTime() - now);
    const email =
      c.kind === "live"
        ? matchLiveEmail({
            name: me.name,
            opponent: them.name,
            tournament: t.name,
            roundName: round,
            firstRound: c.m.round === 1,
            final: c.m.round === totalRounds(t.bracket_size),
            timeLeft,
            shareUrl,
            siteUrl: PUBLIC_SITE_URL,
          })
        : behindEmail({
            name: me.name,
            opponent: them.name,
            roundName: round,
            mine: countOf(c).mine!,
            theirs: countOf(c).theirs!,
            timeLeft,
            shareUrl,
            siteUrl: PUBLIC_SITE_URL,
          });
    out.push({ to: me.email, replyTo: adminEmail(), email });
  }
  if (out.length) console.log("match emails sent", await sendEmailBatch(out), "of", out.length);
}

/** "Qualifying ends soon" to free entries, about a day before the bracket locks. */
async function sendQualifyingEmails(db: Db) {
  const now = Date.now();
  const { data: ts } = await db
    .from("tournaments")
    .select("id, name, bracket_size, qualifying_ends_at")
    .eq("status", "qualifying")
    .is("paused_at", null)
    .gt("qualifying_ends_at", new Date(now).toISOString())
    .lte("qualifying_ends_at", new Date(now + QUALIFYING_WARNING_MS).toISOString());

  for (const t of (ts ?? []) as { id: string; name: string; bracket_size: number; qualifying_ends_at: string }[]) {
    const [{ data: entryRows }, { data: board }] = await Promise.all([
      db
        .from("entries")
        .select("product_id, entry_path, seat, created_at")
        .eq("tournament_id", t.id)
        .is("disqualified_at", null),
      db.rpc("qualifying_leaderboard", { p_tournament_id: t.id }),
    ]);
    const votesOf = new Map(
      ((board ?? []) as { product_id: string; votes: number }[]).map((r) => [r.product_id, Number(r.votes)]),
    );
    const entries: QualifyingEntry[] = (
      (entryRows ?? []) as { product_id: string; entry_path: QualifyingEntry["entryPath"]; seat: number | null; created_at: string }[]
    ).map((e) => ({
      productId: e.product_id,
      entryPath: e.entry_path,
      seat: e.seat,
      createdAt: e.created_at,
      votes: votesOf.get(e.product_id) ?? 0,
    }));

    const keyOf = (pid: string) => `qualifying:${t.id}:${pid}`;
    const standings = qualifyingStandings(entries, t.bracket_size);
    const sent = await alreadySent(db, standings.map((s) => keyOf(s.productId)));
    if (!sent) return;
    const due = standings.filter((s) => !sent.has(keyOf(s.productId)));
    if (!due.length) continue;

    const brands = await brandsOf(db, due.map((s) => s.productId));
    const won = await claim(db, due.map((s) => keyOf(s.productId)));
    const timeLeft = roughTimeLeft(new Date(t.qualifying_ends_at).getTime() - now);

    const out: Outgoing[] = [];
    for (const s of due) {
      const b = brands.get(s.productId);
      if (!won.has(keyOf(s.productId)) || !b?.email) continue;
      out.push({
        to: b.email,
        replyTo: adminEmail(),
        email: qualifyingEndingEmail({
          name: b.name,
          tournament: t.name,
          rank: s.rank,
          openSpots: s.openSpots,
          inside: s.inside,
          margin: s.margin,
          votes: votesOf.get(s.productId) ?? 0,
          timeLeft,
          pageUrl: `${PUBLIC_SITE_URL}/p/${b.slug}?ref=${encodeURIComponent(b.slug)}`,
          siteUrl: PUBLIC_SITE_URL,
        }),
      });
    }
    if (out.length) console.log("qualifying emails sent", await sendEmailBatch(out), "of", out.length, "for", t.name);
  }
}
