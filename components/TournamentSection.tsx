import Link from "next/link";
import { QualifyingVoteButton } from "@/app/arena/QualifyingVoteButton";
import { BracketBoard } from "@/components/BracketBoard";
import { CountdownBoxes } from "@/components/CountdownBoxes";
import { JoinField } from "@/components/JoinField";
import { MatchupCard } from "@/components/MatchupCard";
import { ProductLogo } from "@/components/ProductLogo";
import { getUser } from "@/lib/auth";
import { getBracket, getLeaderboard } from "@/lib/data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { matchPath } from "@/lib/share";
import { roundName } from "@/lib/time";
import type { Tournament } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Tournament title, full bracket, current round and history. Used on / and /arena. */
export async function TournamentSection({ tournament }: { tournament: Tournament | null }) {
  if (!tournament) {
    return (
      <section className="mx-auto max-w-6xl px-3 sm:px-4">
        <SectionTitle title="Next tournament" />
        <BoardHeader left="Bracket · 16 spots open" />
        <BracketBoard size={16} matches={[]} products={new Map()} projected={[]} />
        <p className="mt-4 text-center text-sm text-muted">
          Tap a <span className="font-bold text-red">+</span> to claim a spot. The bracket starts as soon as it opens.
        </p>
      </section>
    );
  }

  if (tournament.status === "draft" || tournament.status === "qualifying") {
    return <Qualifying tournament={tournament} />;
  }
  return <Bracket tournament={tournament} />;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-6 text-center font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>;
}

function BoardHeader({ left, countdown }: { left: string; countdown?: { to: string; label: string } }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <p className="font-display text-lg font-extrabold uppercase tracking-tight">{left}</p>
      {countdown && <CountdownBoxes to={countdown.to} label={countdown.label} />}
    </div>
  );
}

async function Bracket({ tournament }: { tournament: Tournament }) {
  const { matches, products } = await getBracket(tournament.id);
  const round = Math.max(1, ...matches.map((m) => m.round));
  const current = matches.filter((m) => m.round === round);
  const live = current.filter((m) => m.status === "open");
  const finished = tournament.status === "finished";
  const champion = tournament.winner_product_id ? products.get(tournament.winner_product_id) : null;
  const ended = Array.from({ length: round }, (_, i) => round - i)
    .filter((r) => r !== round || finished)
    .map((r) => ({ r, ms: matches.filter((m) => m.round === r) }));

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-4">
      <SectionTitle title={tournament.name} />
      <BoardHeader
        left={finished ? "Bracket · Final result" : `Bracket · ${roundName(round, tournament.bracket_size)}`}
        countdown={live[0] ? { to: live[0].ends_at, label: "Time until next round" } : undefined}
      />
      <BracketBoard size={tournament.bracket_size} matches={matches} products={products} champion={champion} />

      {finished && champion && (
        <div className="border-gradient mt-6 flex items-center gap-4 rounded-[0.875rem] p-4">
          <ProductLogo src={champion.logo_url} name={champion.name} size={56} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-red-dark">🏆 Champion</p>
            <Link href={`/p/${champion.slug}`} className="font-display text-xl font-extrabold hover:underline">
              {champion.name}
            </Link>
            <p className="text-sm text-muted">Wins a backlink on a DA 50+ site in their niche.</p>
          </div>
        </div>
      )}

      {!finished && (
        <>
          <h3 className="mt-10 mb-4 text-center font-display text-lg font-extrabold uppercase">
            {roundName(round, tournament.bracket_size)}
          </h3>
          <div className="flex flex-col gap-4">
            {current.map((m) => (
              <MatchupCard
                key={m.id}
                match={m}
                a={m.product_a ? products.get(m.product_a) : undefined}
                b={m.product_b ? products.get(m.product_b) : undefined}
              />
            ))}
          </div>
        </>
      )}

      {ended.length > 0 && (
        <>
          <h3 className="mt-12 mb-4 text-center font-display text-lg font-extrabold uppercase">Ended rounds</h3>
          <div className="flex flex-col gap-2">
            {ended.map(({ r, ms }) => (
              <details key={r} className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="font-bold">{roundName(r, tournament.bracket_size)}</span>{" "}
                    <span className="text-muted">
                      {ms.length} {ms.length === 1 ? "match" : "matches"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-muted">
                    {ms[0] && dateFmt.format(new Date(ms[0].ends_at))}
                    <span className="transition-transform group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <ul className="flex flex-col gap-1 border-t border-line px-4 py-3 text-sm">
                  {ms.map((m) => {
                    const a = m.product_a ? products.get(m.product_a) : undefined;
                    const b = m.product_b ? products.get(m.product_b) : undefined;
                    return (
                      <li key={m.id}>
                        <Link href={matchPath(m, a?.slug, b?.slug)} className="flex items-center gap-2 hover:underline">
                          <span className={`flex-1 truncate text-right ${m.winner_product_id === a?.id ? "font-bold" : "text-muted"}`}>
                            {a?.name ?? "TBD"}
                          </span>
                          <span className="rounded bg-cream px-2 font-mono text-xs font-bold">
                            {m.counts.a_votes}:{m.counts.b_votes}
                          </span>
                          <span className={`flex-1 truncate ${m.winner_product_id === b?.id ? "font-bold" : "text-muted"}`}>
                            {b?.name ?? "TBD"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

async function Qualifying({ tournament }: { tournament: Tournament }) {
  const [rows, user] = await Promise.all([getLeaderboard(tournament.id), getUser()]);
  let voted = new Set<string>();
  if (user) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("qualifying_votes")
      .select("product_id")
      .eq("tournament_id", tournament.id)
      .eq("voter_id", user.id);
    voted = new Set((data ?? []).map((r) => r.product_id as string));
  }
  // Same order the bracket is seeded in: badge/pass first, then most votes.
  const seeded = rows.filter((r) => r.entry_path !== "free");
  const free = rows.filter((r) => r.entry_path === "free");
  const projected = [...seeded, ...free].slice(0, tournament.bracket_size).map((r) => r.product);
  const qualifying = tournament.status === "qualifying";

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-4">
      <SectionTitle title={tournament.name} />
      <BoardHeader
        left={qualifying ? "Qualifying · projected bracket" : "Entries open · projected bracket"}
        countdown={
          qualifying && tournament.qualifying_ends_at
            ? { to: tournament.qualifying_ends_at, label: "Bracket locks in" }
            : undefined
        }
      />
      <BracketBoard size={tournament.bracket_size} matches={[]} products={new Map()} projected={projected} />
      <p className="mt-3 text-center text-xs text-muted">
        Current top {tournament.bracket_size}. Pairings are drawn at random when qualifying ends.
      </p>

      <h3 className="mt-10 mb-4 text-center font-display text-lg font-extrabold uppercase">
        Qualifying leaderboard
      </h3>
      {rows.length === 0 ? (
        <div className="card mx-auto max-w-xl p-5 text-center">
          <p className="font-bold">No brands yet. Be the first in.</p>
          <div className="mt-3">
            <JoinField />
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {[...seeded, ...free].map((r, i) => (
            <li
              key={r.product.id}
              className={`card flex items-center gap-3 p-3 ${i < tournament.bracket_size ? "" : "opacity-70"}`}
            >
              <span className="w-6 text-center font-display font-extrabold text-muted">{i + 1}</span>
              <ProductLogo src={r.product.logo_url} name={r.product.name} size={40} />
              <div className="min-w-0 flex-1">
                <Link href={`/p/${r.product.slug}`} className="block truncate font-bold hover:underline">
                  {r.product.name}
                </Link>
                <p className="truncate text-xs text-muted">{r.product.description ?? r.product.domain}</p>
              </div>
              {r.entry_path !== "free" ? (
                <span className="shrink-0 rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-bold text-blue">
                  Seeded
                </span>
              ) : (
                <>
                  <span className="font-display text-lg font-extrabold tabular-nums">{r.votes}</span>
                  {qualifying ? (
                    <QualifyingVoteButton
                      tournamentId={tournament.id}
                      productId={r.product.id}
                      loggedIn={Boolean(user)}
                      own={user?.id === r.product.owner_id}
                      voted={voted.has(r.product.id)}
                    />
                  ) : (
                    <span className="text-xs text-muted">Voting opens soon</span>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
