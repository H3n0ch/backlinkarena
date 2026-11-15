import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isGoogleLoginEnabled } from "@/lib/auth-settings";
import { getMatchView } from "@/lib/data";
import { matchPath, matchShareUrl } from "@/lib/share";
import { createSupabaseServer } from "@/lib/supabase/server";
import { roundName } from "@/lib/time";
import { cleanRef, safeHttpUrl } from "@/lib/url";
import { MatchArena, type ArenaProduct } from "./MatchArena";

/** Shared by /match/[id] and the readable /vs/[pair] route. */
export async function matchMetadata(id: string | null): Promise<Metadata> {
  const view = id ? await getMatchView(id) : null;
  if (!view) return { title: "Matchup not found" };
  const title = `${view.a?.name ?? "TBD"} vs ${view.b?.name ?? "TBD"}`;
  const description = "Which site deserves the backlink? Compare both and vote on Backlink Arena.";
  const path = matchPath(view.match, view.a?.slug, view.b?.slug);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    twitter: { card: "summary_large_image", title, description },
  };
}

function toArena(p: NonNullable<Awaited<ReturnType<typeof getMatchView>>>["a"]): ArenaProduct | null {
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    domain: p.domain,
    description: p.description,
    logo: p.logo_url,
    url: safeHttpUrl(p.url),
  };
}

export async function MatchScreen({
  id,
  searchParams,
}: {
  id: string | null;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Matchup, visitor and query string in parallel: nothing here waits on the other.
  const [view, user, sp, googleEnabled] = await Promise.all([
    id ? getMatchView(id) : null,
    getUser(),
    searchParams,
    isGoogleLoginEnabled(),
  ]);
  if (!view) notFound();
  const ref = cleanRef(sp.ref);
  const { match, tournament, a, b, counts } = view;

  const arenaA = toArena(a);
  const arenaB = toArena(b);
  let votedFor: string | null = null;
  let nextMatchId: string | null = null;
  let allDone = false;
  if (user) {
    const supabase = await createSupabaseServer();
    const [{ data: vote }, { data: remaining }] = await Promise.all([
      supabase.from("votes").select("product_id").eq("match_id", match.id).eq("voter_id", user.id).maybeSingle(),
      supabase.rpc("my_unvoted_open_matches"),
    ]);
    votedFor = (vote?.product_id as string | undefined) ?? null;
    const rest = ((remaining ?? []) as string[]).filter((m) => m !== match.id);
    nextMatchId = rest[0] ?? null;
    allDone = Boolean(votedFor) && rest.length === 0;
  }
  const ownsA = Boolean(user && a?.owner_id === user.id);
  const ownsB = Boolean(user && b?.owner_id === user.id);
  const path = matchPath(match, a?.slug, b?.slug);

  return (
    <MatchArena
      matchId={match.id}
      tournamentName={tournament.name}
      roundLabel={roundName(match.round, tournament.bracket_size)}
      a={arenaA}
      b={arenaB}
      initialCounts={counts}
      startsAt={match.starts_at}
      endsAt={match.ends_at}
      initialStatus={match.status}
      initialWinner={match.winner_product_id}
      viewer={{ loggedIn: Boolean(user), owns: ownsA || ownsB, votedFor, nextMatchId, allDone }}
      refSlug={ref}
      googleEnabled={googleEnabled}
      shareLink={matchShareUrl(path, ownsA ? a?.slug : ownsB ? b?.slug : ref)}
    />
  );
}
