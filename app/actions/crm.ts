"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import { normalizeUrl, safeHttpUrl, slugify } from "@/lib/url";

// Admin CRM writes. Every action checks is_admin, then uses the service role,
// which bypasses RLS and the self-service guards. Validation happens here.

type Db = ReturnType<typeof createSupabaseAdmin>;

async function admin(): Promise<Db> {
  const user = await getUser();
  if (!user?.isAdmin) throw new Error("Not allowed");
  return createSupabaseAdmin();
}

function done(message = "Saved."): ActionResult {
  refresh();
  return { ok: true, message };
}

function fail(error: { message: string; code?: string } | string): ActionResult {
  if (typeof error === "string") return { ok: false, error };
  if (error.code === "23505") return { ok: false, error: "That conflicts with an existing row (duplicate value)." };
  return { ok: false, error: error.message };
}

const uuid = z.guid();
const optUuid = z.union([z.guid(), z.literal(""), z.null()]).transform((v) => v || null);
const isoDate = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
  .transform((v) => new Date(v).toISOString());
const optIsoDate = z
  .union([isoDate, z.literal(""), z.null()])
  .transform((v) => v || null);

async function profileIdByEmail(db: Db, email: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("id").ilike("email", email.trim()).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const ProductInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  logoUrl: z.string().trim().max(1000),
  category: z.string().trim().max(60),
  url: z.string().trim().min(1).max(300),
  slug: z.string().trim().max(60),
  badgeStatus: z.enum(["none", "pending", "verified"]),
  passPaid: z.boolean(),
  ownerEmail: z.string().trim().max(200),
});

export async function saveProduct(id: string, input: z.input<typeof ProductInput>): Promise<ActionResult> {
  const db = await admin();
  const p = ProductInput.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return fail("Please check the fields.");
  const d = p.data;
  const site = normalizeUrl(d.url);
  if (!site) return fail("Website URL is not valid.");
  if (d.logoUrl && !safeHttpUrl(d.logoUrl)) return fail("Logo must be an http(s) URL.");
  const slug = slugify(d.slug || site.domain);
  if (!slug) return fail("Slug is empty.");

  const patch: Record<string, unknown> = {
    name: d.name,
    description: d.description || null,
    logo_url: safeHttpUrl(d.logoUrl),
    category: d.category || null,
    url: site.url,
    domain: site.domain,
    slug,
    badge_status: d.badgeStatus,
    pass_paid: d.passPaid,
  };
  if (d.ownerEmail) {
    const owner = await profileIdByEmail(db, d.ownerEmail);
    if (!owner) return fail(`No user with email ${d.ownerEmail}. They need to log in once first.`);
    patch.owner_id = owner;
  }
  const { error } = await db.from("products").update(patch).eq("id", id);
  return error ? fail(error) : done("Product saved.");
}

const NewProduct = z.object({
  ownerEmail: z.string().trim().min(3).max(200),
  url: z.string().trim().min(1).max(300),
  name: z.string().trim().min(1).max(80),
  logoUrl: z.string().trim().max(1000),
  category: z.string().trim().max(60),
});

export async function createProductAdmin(input: z.input<typeof NewProduct>): Promise<ActionResult<string>> {
  const db = await admin();
  const p = NewProduct.safeParse(input);
  if (!p.success) return { ok: false, error: "Please check the fields." };
  const site = normalizeUrl(p.data.url);
  if (!site) return { ok: false, error: "Website URL is not valid." };
  const owner = await profileIdByEmail(db, p.data.ownerEmail);
  if (!owner) return { ok: false, error: "No user with that email. They need to log in once first." };
  const { data, error } = await db
    .from("products")
    .insert({
      owner_id: owner,
      url: site.url,
      domain: site.domain,
      slug: slugify(site.domain),
      name: p.data.name,
      logo_url: safeHttpUrl(p.data.logoUrl),
      category: p.data.category || null,
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That domain is already registered." : error.message };
  }
  refresh();
  return { ok: true, data: data.id as string, message: "Product created." };
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

/** Uploads a logo file to the public "logos" bucket and sets it on the product. */
export async function uploadLogo(productId: string, form: FormData): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(productId).success) return fail("Bad product id.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
  if (file.size > 2 * 1024 * 1024) return fail("Logo must be 2 MB or smaller.");
  const ext = LOGO_TYPES[file.type];
  if (!ext) return fail("Use PNG, JPG, WEBP, GIF, SVG or ICO.");

  const path = `${productId}/${Date.now()}.${ext}`;
  const { error: upErr } = await db.storage
    .from("logos")
    .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "31536000" });
  if (upErr) return fail(`Upload failed: ${upErr.message}. Did you run migration 0005?`);
  const { data } = db.storage.from("logos").getPublicUrl(path);
  const { error } = await db.from("products").update({ logo_url: data.publicUrl }).eq("id", productId);
  return error ? fail(error) : done("Logo uploaded.");
}

export async function deleteProductAdmin(productId: string, force: boolean): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(productId).success) return fail("Bad product id.");
  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`product_a.eq.${productId},product_b.eq.${productId},winner_product_id.eq.${productId}`);
  if (count && !force) {
    return fail("This product is in bracket matches. Tick “also clear it from matches” to delete anyway.");
  }
  if (count) {
    // Matches reference products without cascade: empty those slots first.
    await db.from("votes").delete().eq("product_id", productId);
    await Promise.all([
      db.from("matches").update({ product_a: null }).eq("product_a", productId),
      db.from("matches").update({ product_b: null }).eq("product_b", productId),
      db.from("matches").update({ winner_product_id: null }).eq("winner_product_id", productId),
      db.from("tournaments").update({ winner_product_id: null }).eq("winner_product_id", productId),
    ]);
  }
  const { error } = await db.from("products").delete().eq("id", productId);
  return error ? fail(error) : done("Product deleted.");
}

// ---------------------------------------------------------------------------
// Entries (a product inside a tournament)
// ---------------------------------------------------------------------------

const EntryInput = z.object({
  tournamentId: uuid,
  entryPath: z.enum(["free", "badge", "pass"]),
  qualified: z.boolean(),
  eliminatedRound: z.union([z.number().int().min(0).max(10), z.null()]),
  /** Qualifying vote total to display; stored as an adjustment on top of real votes. */
  qualifyingVotes: z.number().int().min(0).max(10_000_000),
});

async function realQualifyingVotes(db: Db, tournamentId: string, productId: string) {
  const { count } = await db
    .from("qualifying_votes")
    .select("voter_id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("product_id", productId);
  return count ?? 0;
}

export async function saveEntry(entryId: string, input: z.input<typeof EntryInput>): Promise<ActionResult> {
  const db = await admin();
  const p = EntryInput.safeParse(input);
  if (!uuid.safeParse(entryId).success || !p.success) return fail("Please check the fields.");
  const { data: e } = await db.from("entries").select("product_id, tournament_id").eq("id", entryId).single();
  if (!e) return fail("Entry not found.");
  const real = await realQualifyingVotes(db, p.data.tournamentId, e.product_id as string);
  const patch = {
    tournament_id: p.data.tournamentId,
    entry_path: p.data.entryPath,
    qualified: p.data.qualified,
    eliminated_round: p.data.eliminatedRound,
    vote_adjust: p.data.qualifyingVotes - real,
  };
  const { error } = await db.from("entries").update(patch).eq("id", entryId);
  if (error) return fail(error);
  if (p.data.tournamentId !== e.tournament_id) {
    // Qualifying votes belong to the old tournament: drop them with the move.
    await db
      .from("qualifying_votes")
      .delete()
      .eq("tournament_id", e.tournament_id as string)
      .eq("product_id", e.product_id as string);
  }
  return done("Entry saved.");
}

/** Sets the qualifying vote total shown for one entry (stored as an adjustment). */
export async function setQualifyingVotes(entryId: string, total: number): Promise<ActionResult> {
  const db = await admin();
  const n = Math.trunc(Number(total));
  if (!uuid.safeParse(entryId).success || !(n >= 0 && n <= 10_000_000)) return fail("Enter a whole number, 0 or more.");
  const { data: e } = await db.from("entries").select("product_id, tournament_id").eq("id", entryId).single();
  if (!e) return fail("Entry not found.");
  const real = await realQualifyingVotes(db, e.tournament_id as string, e.product_id as string);
  const { error } = await db.from("entries").update({ vote_adjust: n - real }).eq("id", entryId);
  return error ? fail(error) : done("Saved.");
}

/** Sets the vote total shown for one side of a match (stored as an adjustment). */
export async function setMatchVotes(matchId: string, side: "a" | "b", total: number): Promise<ActionResult> {
  const db = await admin();
  const n = Math.trunc(Number(total));
  if (!uuid.safeParse(matchId).success || (side !== "a" && side !== "b") || !(n >= 0 && n <= 10_000_000)) {
    return fail("Enter a whole number, 0 or more.");
  }
  const { data: m } = await db.from("matches").select("product_a, product_b").eq("id", matchId).single();
  if (!m) return fail("Match not found.");
  const { ra, rb } = await realMatchVotes(db, matchId, m.product_a as string | null, m.product_b as string | null);
  const patch = side === "a" ? { a_adjust: n - ra } : { b_adjust: n - rb };
  const { error } = await db.from("matches").update(patch).eq("id", matchId);
  return error ? fail(error) : done("Saved.");
}

export async function addEntry(
  productId: string,
  tournamentId: string,
  entryPath: "free" | "badge" | "pass",
): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(productId).success || !uuid.safeParse(tournamentId).success) return fail("Pick a tournament.");
  if (!["free", "badge", "pass"].includes(entryPath)) return fail("Bad entry path.");
  const { error } = await db
    .from("entries")
    .insert({ product_id: productId, tournament_id: tournamentId, entry_path: entryPath });
  if (error?.code === "23505") return fail("Already in that tournament.");
  return error ? fail(error) : done("Added to tournament.");
}

export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(entryId).success) return fail("Bad entry id.");
  const { data: e } = await db.from("entries").select("product_id, tournament_id").eq("id", entryId).single();
  if (!e) return fail("Entry not found.");
  await db
    .from("qualifying_votes")
    .delete()
    .eq("tournament_id", e.tournament_id as string)
    .eq("product_id", e.product_id as string);
  const { error } = await db.from("entries").delete().eq("id", entryId);
  return error ? fail(error) : done("Removed from tournament.");
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

const TournamentInput = z.object({
  name: z.string().trim().min(1).max(100),
  status: z.enum(["draft", "qualifying", "bracket", "finished"]),
  bracketSize: z.union([z.literal(8), z.literal(16)]),
  qualifyingEndsAt: optIsoDate,
  matchHours: z.number().int().min(1).max(720),
  winnerProductId: optUuid,
  prizeUrl: z.string().trim().max(1000),
  prizeDelivered: z.boolean(),
});

export async function saveTournament(id: string, input: z.input<typeof TournamentInput>): Promise<ActionResult> {
  const db = await admin();
  const p = TournamentInput.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return fail("Please check the fields.");
  const d = p.data;
  if (d.prizeUrl && !safeHttpUrl(d.prizeUrl)) return fail("Prize URL must be an http(s) URL.");
  const { data: current } = await db.from("tournaments").select("prize_delivered_at").eq("id", id).single();
  const { error } = await db
    .from("tournaments")
    .update({
      name: d.name,
      status: d.status,
      bracket_size: d.bracketSize,
      qualifying_ends_at: d.qualifyingEndsAt,
      match_hours: d.matchHours,
      winner_product_id: d.winnerProductId,
      prize_url: safeHttpUrl(d.prizeUrl),
      prize_delivered_at: d.prizeDelivered ? (current?.prize_delivered_at ?? new Date().toISOString()) : null,
    })
    .eq("id", id);
  if (error?.code === "23505") return fail("Only one tournament can be unfinished at a time.");
  return error ? fail(error) : done("Tournament saved.");
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const { error } = await db.from("tournaments").delete().eq("id", id);
  return error ? fail(error) : done("Tournament deleted.");
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

const MatchInput = z.object({
  productA: optUuid,
  productB: optUuid,
  startsAt: isoDate,
  endsAt: isoDate,
  status: z.enum(["open", "closed"]),
  winner: optUuid,
  /** Vote totals to display; stored as adjustments on top of real votes. */
  aVotes: z.number().int().min(0).max(10_000_000),
  bVotes: z.number().int().min(0).max(10_000_000),
});

async function realMatchVotes(db: Db, matchId: string, a: string | null, b: string | null) {
  const count = async (pid: string | null) => {
    if (!pid) return 0;
    const { count } = await db
      .from("votes")
      .select("voter_id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("product_id", pid);
    return count ?? 0;
  };
  const [ra, rb] = await Promise.all([count(a), count(b)]);
  return { ra, rb };
}

/** Puts a match's winner into the right slot of the next round, if that match exists. */
async function propagateWinner(db: Db, m: { tournament_id: string; round: number; position: number }, winner: string | null) {
  const slot = m.position % 2 === 1 ? "product_a" : "product_b";
  await db
    .from("matches")
    .update({ [slot]: winner })
    .eq("tournament_id", m.tournament_id)
    .eq("round", m.round + 1)
    .eq("position", Math.ceil(m.position / 2));
}

/** Keeps entries.eliminated_round in line with a match result. */
async function syncElimination(
  db: Db,
  m: { tournament_id: string; round: number; product_a: string | null; product_b: string | null },
  winner: string | null,
) {
  for (const pid of [m.product_a, m.product_b]) {
    if (!pid) continue;
    const lost = winner !== null && pid !== winner;
    let q = db
      .from("entries")
      .update({ eliminated_round: lost ? m.round : null })
      .eq("tournament_id", m.tournament_id)
      .eq("product_id", pid);
    // Clearing: only undo an elimination that came from this round.
    if (!lost) q = q.eq("eliminated_round", m.round);
    await q;
  }
}

export async function saveMatch(id: string, input: z.input<typeof MatchInput>): Promise<ActionResult> {
  const db = await admin();
  const p = MatchInput.safeParse(input);
  if (!uuid.safeParse(id).success || !p.success) return fail("Please check the fields.");
  const d = p.data;
  if (d.productA && d.productA === d.productB) return fail("Side A and side B can't be the same product.");
  if (d.winner && d.winner !== d.productA && d.winner !== d.productB) return fail("Winner must be side A or side B.");
  if (Date.parse(d.endsAt) <= Date.parse(d.startsAt)) return fail("End must be after start.");
  const { data: old } = await db.from("matches").select("*").eq("id", id).single();
  if (!old) return fail("Match not found.");

  const { ra, rb } = await realMatchVotes(db, id, d.productA, d.productB);
  const winner = d.status === "closed" ? d.winner : null;
  if (d.status === "closed" && !winner) return fail("A closed match needs a winner.");

  // If a side changed, votes cast for the removed product no longer count here.
  for (const [was, now] of [
    [old.product_a, d.productA],
    [old.product_b, d.productB],
  ] as const) {
    if (was && was !== now && was !== d.productA && was !== d.productB) {
      await db.from("votes").delete().eq("match_id", id).eq("product_id", was);
    }
  }

  const { error } = await db
    .from("matches")
    .update({
      product_a: d.productA,
      product_b: d.productB,
      starts_at: d.startsAt,
      ends_at: d.endsAt,
      status: d.status,
      winner_product_id: winner,
      a_adjust: d.aVotes - ra,
      b_adjust: d.bVotes - rb,
    })
    .eq("id", id);
  if (error) return fail(error);

  // Undo the old result's elimination, then apply the new one.
  if (old.winner_product_id) await syncElimination(db, old, null);
  await syncElimination(db, { ...old, product_a: d.productA, product_b: d.productB }, winner);
  if (old.winner_product_id !== winner) await propagateWinner(db, old, winner);
  return done("Match saved.");
}

export async function setMatchWinner(id: string, winner: string): Promise<ActionResult> {
  const db = await admin();
  const { data: m } = await db.from("matches").select("*").eq("id", id).single();
  if (!m) return fail("Match not found.");
  if (winner !== m.product_a && winner !== m.product_b) return fail("Winner must be in the match.");
  const now = new Date().toISOString();
  const { error } = await db
    .from("matches")
    .update({ winner_product_id: winner, status: "closed", ends_at: Date.parse(m.ends_at) > Date.now() ? now : m.ends_at })
    .eq("id", id);
  if (error) return fail(error);
  if (m.winner_product_id) await syncElimination(db, m, null);
  await syncElimination(db, m, winner);
  await propagateWinner(db, m, winner);
  // Let the engine create the next round / finish the tournament right away.
  await db.rpc("advance_tournaments");
  return done("Winner set and match closed.");
}

export async function reopenMatch(id: string, hours: number): Promise<ActionResult> {
  const db = await admin();
  const h = Math.round(Number(hours));
  if (!(h >= 1 && h <= 720)) return fail("Hours must be 1–720.");
  const { data: m } = await db.from("matches").select("*").eq("id", id).single();
  if (!m) return fail("Match not found.");
  const { error } = await db
    .from("matches")
    .update({ status: "open", winner_product_id: null, ends_at: new Date(Date.now() + h * 3600_000).toISOString() })
    .eq("id", id);
  if (error) return fail(error);
  if (m.winner_product_id) {
    await syncElimination(db, m, null);
    await propagateWinner(db, m, null);
  }
  // A finished tournament with an open match goes back to bracket.
  await db.from("tournaments").update({ status: "bracket", winner_product_id: null }).eq("id", m.tournament_id).eq("status", "finished");
  return done(`Match reopened for ${h}h.`);
}

export async function swapMatchSides(id: string): Promise<ActionResult> {
  const db = await admin();
  const { data: m } = await db.from("matches").select("*").eq("id", id).single();
  if (!m) return fail("Match not found.");
  const { error } = await db
    .from("matches")
    .update({ product_a: m.product_b, product_b: m.product_a, a_adjust: m.b_adjust ?? 0, b_adjust: m.a_adjust ?? 0 })
    .eq("id", id);
  return error ? fail(error) : done("Sides swapped.");
}

export async function createMatch(
  tournamentId: string,
  round: number,
  position: number,
  hours: number,
): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(tournamentId).success) return fail("Bad tournament.");
  const r = Math.round(round);
  const pos = Math.round(position);
  const h = Math.round(hours);
  if (!(r >= 1 && r <= 10 && pos >= 1 && pos <= 64 && h >= 1 && h <= 720)) return fail("Check round, position and hours.");
  const { error } = await db.from("matches").insert({
    tournament_id: tournamentId,
    round: r,
    position: pos,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + h * 3600_000).toISOString(),
  });
  if (error?.code === "23505") return fail("A match already exists at that round and position.");
  return error ? fail(error) : done("Empty match created. Pick the two sides below.");
}

export async function deleteMatch(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const { error } = await db.from("matches").delete().eq("id", id);
  return error ? fail(error) : done("Match deleted (with its votes).");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function saveUser(id: string, fullName: string, isAdmin: boolean): Promise<ActionResult> {
  const db = await admin();
  const me = await getUser();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  if (me?.id === id && !isAdmin) return fail("You can't remove your own admin access.");
  const { error } = await db
    .from("profiles")
    .update({ full_name: fullName.trim().slice(0, 120) || null, is_admin: Boolean(isAdmin) })
    .eq("id", id);
  return error ? fail(error) : done("User saved.");
}

export async function deleteUserVotes(id: string): Promise<ActionResult> {
  const db = await admin();
  if (!uuid.safeParse(id).success) return fail("Bad id.");
  const [a, b] = await Promise.all([
    db.from("votes").delete({ count: "exact" }).eq("voter_id", id),
    db.from("qualifying_votes").delete({ count: "exact" }).eq("voter_id", id),
  ]);
  if (a.error || b.error) return fail((a.error ?? b.error)!);
  return done(`Removed ${a.count ?? 0} match votes and ${b.count ?? 0} qualifying votes.`);
}

export async function deleteMatchVote(voteId: number): Promise<ActionResult> {
  const db = await admin();
  if (!Number.isSafeInteger(voteId)) return fail("Bad id.");
  const { error } = await db.from("votes").delete().eq("id", voteId);
  return error ? fail(error) : done("Vote deleted.");
}

export async function deleteQualifyingVote(voteId: number): Promise<ActionResult> {
  const db = await admin();
  if (!Number.isSafeInteger(voteId)) return fail("Bad id.");
  const { error } = await db.from("qualifying_votes").delete().eq("id", voteId);
  return error ? fail(error) : done("Vote deleted.");
}

/** Deletes every vote cast from one network (hashed IP), e.g. a vote-stuffing guest. */
export async function deleteVotesByNetwork(ipHash: string): Promise<ActionResult> {
  const db = await admin();
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(ipHash)) return fail("Bad network id.");
  const [a, b] = await Promise.all([
    db.from("votes").delete({ count: "exact" }).eq("ip_hash", ipHash),
    db.from("qualifying_votes").delete({ count: "exact" }).eq("ip_hash", ipHash),
  ]);
  if (a.error || b.error) return fail((a.error ?? b.error)!);
  return done(`Removed ${(a.count ?? 0) + (b.count ?? 0)} votes from that network.`);
}

// ---------------------------------------------------------------------------
// Homepage numbers
// ---------------------------------------------------------------------------

const StatsInput = z.object({
  sites: z.number().int().min(0).max(100_000_000),
  votes: z.number().int().min(0).max(100_000_000),
  backlinks: z.number().int().min(0).max(100_000_000),
});

/** Takes the numbers to SHOW; stores the difference from the real totals as offsets. */
export async function saveHomepageStats(input: z.input<typeof StatsInput>): Promise<ActionResult> {
  const db = await admin();
  const p = StatsInput.safeParse(input);
  if (!p.success) return fail("Numbers must be whole and 0 or more.");
  const real = await realStats(db);
  const { error } = await db.from("site_settings").upsert({
    id: true,
    sites_offset: p.data.sites - real.sites,
    votes_offset: p.data.votes - real.votes,
    backlinks_offset: p.data.backlinks - real.backlinks,
    updated_at: new Date().toISOString(),
  });
  return error ? fail(`${error.message}. Did you run migration 0005?`) : done("Homepage numbers saved.");
}

/** Real totals the homepage strip starts from: rows plus per-match/entry vote adjustments. */
async function realStats(db: Db) {
  const [products, votes, qvotes, finished, matches, entries] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("votes").select("voter_id", { count: "exact", head: true }),
    db.from("qualifying_votes").select("voter_id", { count: "exact", head: true }),
    db.from("tournaments").select("id", { count: "exact", head: true }).eq("status", "finished").not("winner_product_id", "is", null),
    db.from("matches").select("a_adjust, b_adjust"),
    db.from("entries").select("vote_adjust"),
  ]);
  const adj =
    ((matches.data ?? []) as { a_adjust: number | null; b_adjust: number | null }[]).reduce(
      (s, m) => s + (m.a_adjust ?? 0) + (m.b_adjust ?? 0),
      0,
    ) + ((entries.data ?? []) as { vote_adjust: number | null }[]).reduce((s, e) => s + (e.vote_adjust ?? 0), 0);
  return {
    sites: products.count ?? 0,
    votes: (votes.count ?? 0) + (qvotes.count ?? 0) + adj,
    backlinks: finished.count ?? 0,
  };
}
