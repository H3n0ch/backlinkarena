import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QualifyingVoteButton } from "@/app/arena/QualifyingVoteButton";
import { Countdown } from "@/components/Countdown";
import { ProductLogo } from "@/components/ProductLogo";
import { TrackedLink } from "@/components/Track";
import { getUser } from "@/lib/auth";
import { getActiveTournament, getProductBySlug, getProductHistory } from "@/lib/data";
import { qualifyingStanding, qualifyingVotedSet } from "@/lib/qualifying";
import { roundName } from "@/lib/time";
import type { Product, Tournament } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found" };
  const t = await getActiveTournament();
  const asking = t && (t.status === "qualifying" || t.status === "draft");
  // Always our own title/description. Never the brand's scraped og:description, or Google shows
  // their copy (e.g. BET's "Celebrities, Music, News…") as our result and treats the page as duplicate.
  return {
    title: asking ? `Vote ${p.name} into ${t.name}` : `${p.name} on Backlink Arena`,
    description: asking
      ? `${p.name} is in qualifying on Backlink Arena. The most-voted brands get into the bracket. One click, no sign-up.`
      : `${p.name}'s tournament history on Backlink Arena: matchups, votes and results in the battle for DA 50+ backlinks.`,
    alternates: { canonical: `/p/${slug}` },
  };
}

export default function ProductPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [history, tournament] = await Promise.all([getProductHistory(product.id), getActiveTournament()]);
  const href = safeHttpUrl(product.url);

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <ProductLogo src={product.logo_url} name={product.name} size={72} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-extrabold leading-tight">{product.name}</h1>
            <p className="text-muted">{product.domain}</p>
          </div>
        </div>
        {product.description && <p className="mt-4 text-lg">{product.description}</p>}
        {product.category && (
          <span className="mt-3 inline-block rounded-full border border-line bg-blue-soft px-3 py-0.5 text-sm font-semibold">
            {product.category}
          </span>
        )}
        {href && (
          <div className="mt-5">
            {/* Intentionally dofollow: this link is part of what participants play for. */}
            <TrackedLink href={href} productId={product.id} className="btn bg-card">
              Visit {product.domain} ↗
            </TrackedLink>
          </div>
        )}
      </div>

      {tournament && (tournament.status === "qualifying" || tournament.status === "draft") && (
        <QualifyCard tournament={tournament} product={product} />
      )}

      <h2 className="mt-10 font-display text-2xl font-extrabold">Tournament history</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-muted">No tournaments yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {history.map(({ tournament, entry, matches }) => {
            const won = tournament.winner_product_id === product.id;
            const status = won
              ? "🏆 Winner"
              : entry.eliminated_round === 0
                ? "Didn't qualify"
                : entry.eliminated_round
                  ? `Out in ${roundName(entry.eliminated_round, tournament.bracket_size)}`
                  : tournament.status === "qualifying" || tournament.status === "draft"
                    ? "Qualifying"
                    : tournament.status === "bracket"
                      ? "Still in"
                      : "Played";
            return (
              <li key={entry.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{tournament.name}</p>
                  <span className="rounded-full bg-sun px-3 py-0.5 text-sm font-bold">{status}</span>
                </div>
                {matches.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <Link href={`/match/${m.id}`} className="underline decoration-2 underline-offset-2">
                          {roundName(m.round, tournament.bracket_size)}
                          {m.status === "closed" && (m.winner_product_id === product.id ? " ✓" : " ✗")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** "Vote us in": shown while a free entry collects qualifying votes. This is the page participants share. */
async function QualifyCard({ tournament, product }: { tournament: Tournament; product: Product }) {
  const [standing, user] = await Promise.all([qualifyingStanding(tournament, product.id), getUser()]);
  if (!standing) return null;
  const voted = await qualifyingVotedSet(tournament.id, user?.id);
  const open = tournament.status === "qualifying" && !tournament.paused_at;
  const inNow = standing.rank <= standing.size;

  return (
    <section className="card mt-6 border-2 border-red p-6">
      <p className="text-xs font-extrabold uppercase tracking-wide text-red">{tournament.name} · Qualifying</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold">Vote {product.name} into the bracket</h2>
      <p className="mt-1 text-sm text-muted">
        The {standing.size} top brands get into the bracket. One click, no sign-up.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="font-display text-3xl font-extrabold tabular-nums">{standing.votes}</p>
          <p className="text-xs text-muted">vote{standing.votes === 1 ? "" : "s"}</p>
        </div>
        <div>
          <p className="font-display text-3xl font-extrabold tabular-nums">
            #{standing.rank}
            <span className="text-base text-muted"> / {standing.total}</span>
          </p>
          <p className={`text-xs font-bold ${inNow ? "text-mint" : "text-red"}`}>
            {inNow ? "In the bracket right now" : `${standing.votesToQualify} more to get in`}
          </p>
        </div>
        <div className="ml-auto">
          {open ? (
            <QualifyingVoteButton
              tournamentId={tournament.id}
              productId={product.id}
              own={user?.id === product.owner_id}
              voted={voted.has(product.id)}
            />
          ) : (
            <span className="text-sm text-muted">{tournament.paused_at ? "Voting is paused" : "Voting opens soon"}</span>
          )}
        </div>
      </div>
      {open && tournament.qualifying_ends_at && !tournament.qualifying_overtime && (
        <p className="mt-4 text-sm">
          Qualifying ends in{" "}
          <strong className="font-mono">
            <Countdown to={tournament.qualifying_ends_at} endedText="a moment" pausedAt={tournament.paused_at ?? null} />
          </strong>
        </p>
      )}
      <Link href="/arena" className="mt-3 inline-block text-sm font-semibold underline">
        See the full leaderboard →
      </Link>
    </section>
  );
}
