import "server-only";
import { createSupabasePublic } from "@/lib/supabase/server";
import type { Counts, Entry, Match, Product, Tournament } from "@/lib/types";

export const PRODUCT_PUBLIC_COLUMNS =
  "id, url, domain, slug, name, description, logo_url, category, badge_status, pass_paid, created_at, owner_id";

/** The one tournament that isn't finished (draft / qualifying / bracket), if any. */
export async function getActiveTournament(): Promise<Tournament | null> {
  const db = createSupabasePublic();
  const { data } = await db
    .from("tournaments")
    .select("*")
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Tournament) ?? null;
}

/** Active tournament, or the most recently finished one. */
export async function getCurrentOrLastTournament(): Promise<Tournament | null> {
  const active = await getActiveTournament();
  if (active) return active;
  const db = createSupabasePublic();
  const { data } = await db
    .from("tournaments")
    .select("*")
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Tournament) ?? null;
}

export async function getProductsByIds(ids: (string | null)[]): Promise<Map<string, Product>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return new Map();
  const db = createSupabasePublic();
  const { data } = await db.from("products").select(PRODUCT_PUBLIC_COLUMNS).in("id", unique);
  return new Map(((data ?? []) as Product[]).map((p) => [p.id, p]));
}

export async function getCounts(matchId: string): Promise<Counts> {
  const db = createSupabasePublic();
  const { data } = await db.rpc("match_counts", { p_match_id: matchId });
  const row = (data as Counts[] | null)?.[0];
  return { a_votes: row?.a_votes ?? 0, b_votes: row?.b_votes ?? 0 };
}

export type MatchView = {
  match: Match;
  tournament: Tournament;
  a: Product | null;
  b: Product | null;
  counts: Counts;
};

export async function getMatchView(id: string): Promise<MatchView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createSupabasePublic();
  const { data: match } = await db.from("matches").select("*").eq("id", id).maybeSingle();
  if (!match) return null;
  const m = match as Match;
  const [{ data: tournament }, products, counts] = await Promise.all([
    db.from("tournaments").select("*").eq("id", m.tournament_id).single(),
    getProductsByIds([m.product_a, m.product_b]),
    getCounts(m.id),
  ]);
  return {
    match: m,
    tournament: tournament as Tournament,
    a: m.product_a ? products.get(m.product_a) ?? null : null,
    b: m.product_b ? products.get(m.product_b) ?? null : null,
    counts,
  };
}

/**
 * Resolves "/vs/<slugA>-vs-<slugB>" to the most recent match between those two products.
 * Slugs may contain "-vs-" themselves, so every split point is tried.
 */
export async function getMatchIdByPair(pair: string): Promise<string | null> {
  const p = pair.toLowerCase();
  if (!/^[a-z0-9-]{3,200}$/.test(p)) return null;
  const db = createSupabasePublic();
  let idx = p.indexOf("-vs-");
  while (idx > 0) {
    const a = p.slice(0, idx);
    const b = p.slice(idx + 4);
    if (a && b) {
      const { data: prods } = await db.from("products").select("id, slug").in("slug", [a, b]);
      const ia = prods?.find((x) => x.slug === a)?.id;
      const ib = prods?.find((x) => x.slug === b)?.id;
      if (ia && ib) {
        const { data: m } = await db
          .from("matches")
          .select("id")
          .or(`and(product_a.eq.${ia},product_b.eq.${ib}),and(product_a.eq.${ib},product_b.eq.${ia})`)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (m) return m.id as string;
      }
    }
    idx = p.indexOf("-vs-", idx + 1);
  }
  return null;
}

export type BracketView = {
  matches: (Match & { counts: Counts })[];
  products: Map<string, Product>;
};

export async function getBracket(tournamentId: string): Promise<BracketView> {
  const db = createSupabasePublic();
  const [{ data: matches }, { data: counts }] = await Promise.all([
    db.from("matches").select("*").eq("tournament_id", tournamentId).order("round").order("position"),
    db.rpc("tournament_match_counts", { p_tournament_id: tournamentId }),
  ]);
  const countMap = new Map(
    ((counts ?? []) as { match_id: string; a_votes: number; b_votes: number }[]).map((c) => [
      c.match_id,
      { a_votes: c.a_votes, b_votes: c.b_votes },
    ]),
  );
  const ms = ((matches ?? []) as Match[]).map((m) => ({
    ...m,
    counts: countMap.get(m.id) ?? { a_votes: 0, b_votes: 0 },
  }));
  const products = await getProductsByIds(ms.flatMap((m) => [m.product_a, m.product_b]));
  return { matches: ms, products };
}

export type LeaderboardRow = {
  product: Product;
  entry_path: Entry["entry_path"];
  votes: number;
};

export async function getLeaderboard(tournamentId: string): Promise<LeaderboardRow[]> {
  const db = createSupabasePublic();
  const { data } = await db.rpc("qualifying_leaderboard", { p_tournament_id: tournamentId });
  const rows = (data ?? []) as { product_id: string; entry_path: Entry["entry_path"]; votes: number }[];
  const products = await getProductsByIds(rows.map((r) => r.product_id));
  return rows
    .filter((r) => products.has(r.product_id))
    .map((r) => ({ product: products.get(r.product_id)!, entry_path: r.entry_path, votes: r.votes }));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = createSupabasePublic();
  const { data } = await db
    .from("products")
    .select(PRODUCT_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Product) ?? null;
}

export type HistoryRow = {
  tournament: Tournament;
  entry: Entry;
  matches: Match[];
};

export async function getProductHistory(productId: string): Promise<HistoryRow[]> {
  const db = createSupabasePublic();
  const { data: entries } = await db
    .from("entries")
    .select("*, tournaments(*)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  const { data: matches } = await db
    .from("matches")
    .select("*")
    .or(`product_a.eq.${productId},product_b.eq.${productId}`)
    .order("round");
  const ms = (matches ?? []) as Match[];
  return ((entries ?? []) as (Entry & { tournaments: Tournament })[]).map((e) => ({
    tournament: e.tournaments,
    entry: e,
    matches: ms.filter((m) => m.tournament_id === e.tournament_id),
  }));
}

export async function getRecentProducts(limit: number): Promise<Product[]> {
  const db = createSupabasePublic();
  const { data } = await db
    .from("products")
    .select(PRODUCT_PUBLIC_COLUMNS)
    .not("logo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Product[];
}

export type ArenaStats ={ sites: number; votes: number; backlinks_won: number };

export async function getArenaStats(): Promise<ArenaStats> {
  const db = createSupabasePublic();
  const { data } = await db.rpc("arena_stats");
  const row = (data as ArenaStats[] | null)?.[0];
  return { sites: row?.sites ?? 0, votes: row?.votes ?? 0, backlinks_won: row?.backlinks_won ?? 0 };
}

export async function getWinners(): Promise<{ tournament: Tournament; product: Product | null }[]> {
  const db = createSupabasePublic();
  const { data } = await db
    .from("tournaments")
    .select("*")
    .eq("status", "finished")
    .order("created_at", { ascending: false });
  const ts = (data ?? []) as Tournament[];
  const products = await getProductsByIds(ts.map((t) => t.winner_product_id));
  return ts.map((t) => ({
    tournament: t,
    product: t.winner_product_id ? products.get(t.winner_product_id) ?? null : null,
  }));
}
