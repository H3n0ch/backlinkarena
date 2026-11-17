import Link from "next/link";
import { QualifyingVoteButton } from "@/app/arena/QualifyingVoteButton";
import { BracketBoard } from "@/components/BracketBoard";
import { CountdownBoxes } from "@/components/CountdownBoxes";
import { JoinField } from "@/components/JoinField";
import { MatchCarousel } from "@/components/MatchCarousel";
import { MatchupCard } from "@/components/MatchupCard";
import { ProductLogo } from "@/components/ProductLogo";
import { getUser } from "@/lib/auth";
import { getBracket, getLeaderboard } from "@/lib/data";
import { readGuestId } from "@/lib/guest";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { matchPath } from "@/lib/share";
import { roundName } from "@/lib/time";
import type { Product, Tournament } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Tournament title, full bracket, current round and history. Used on / and /arena. */
export async function TournamentSection({
  tournament,
  carousel = false,
}: {
  tournament: Tournament | null;
  /** Show the current round's matchups as a swipeable carousel (home page). */
  carousel?: boolean;
}) {
  if (!tournament) {
    return (
      <section className="mx-auto max-w-6xl px-3 sm:px-4">
        <SectionTitle title="Next tournament" />
        <BracketBoard
          size={16}
          matches={[]}
          products={new Map()}
          projected={[]}
          header={<BoardHeader eyebrow="Bracket" title="16 spots open" />}
        />
        <p className="mt-4 text-center text-sm text-muted">
          Tap a <span className="font-bold text-red">+</span> to claim a spot. The bracket starts as soon as it opens.
        </p>
      </section>
    );
  }

  if (tournament.status === "draft" || tournament.status === "qualifying") {
    return <Qualifying tournament={tournament} />;
  }
  return <Bracket tournament={tournament} carousel={carousel} />;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-6 text-center font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>;
}

function BoardHeader({
  eyebrow,
  title,
  live,
  countdown,
}: {
  eyebrow: string;
  title: string;
  live?: boolean;
  countdown?: { to: string; label: string; pausedAt?: string | null };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
          {live && (
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/70" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
          )}
          {eyebrow}
        </p>
        <p className="mt-1.5 font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
          {title}
        </p>
      </div>
      {countdown && <CountdownBoxes to={countdown.to} label={countdown.label} pausedAt={countdown.pausedAt} />}
    </div>
  );
}

async function Bracket({ tournament, carousel }: { tournament: Tournament; carousel: boolean }) {
  const { matches, products } = await getBracket(tournament.id);
  const round = Math.max(1, ...matches.map((m) => m.round));
  const current = matches.filter((m) => m.round === round);
  const live = current.filter((m) => m.status === "open");
  const finished = tournament.status === "finished";
  const champion = tournament.winner_product_id ? products.get(tournament.winner_product_id) : null;
  const ended = Array.from({ length: round }, (_, i) => round - i)
    .filter((r) => r !== round || finished)
    .map((r) => ({ r, ms: matches.filter((m) => m.round === r) }));
  // Open matchups first so the carousel starts on something you can vote on.
  const cards = [...current]
    .sort((x, y) => Number(y.status === "open") - Number(x.status === "open"))
    .map((m) => (
      <MatchupCard
        key={m.id}
        match={m}
        a={m.product_a ? products.get(m.product_a) : undefined}
        b={m.product_b ? products.get(m.product_b) : undefined}
        pausedAt={tournament.paused_at}
      />
    ));

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-4">
      <SectionTitle title={tournament.name} />
      <BracketBoard
        size={tournament.bracket_size}
        matches={matches}
        products={products}
        champion={champion}
        header={
          <BoardHeader
            eyebrow={finished ? "Bracket · Closed" : tournament.paused_at ? "Bracket · Paused" : "Bracket · Live"}
            title={finished ? "Final result" : roundName(round, tournament.bracket_size)}
            live={!finished && live.length > 0 && !tournament.paused_at}
            countdown={live[0] ? { to: live[0].ends_at, label: "Time until next round", pausedAt: tournament.paused_at } : undefined}
          />
        }
      />

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
          {carousel && current.length > 1 ? (
            <MatchCarousel>{cards}</MatchCarousel>
          ) : (
            <div className={`grid gap-5 ${current.length === 1 ? "mx-auto max-w-xl" : "md:grid-cols-2"}`}>{cards}</div>
          )}
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
  const [rows, user, { data: seatRows }] = await Promise.all([
    getLeaderboard(tournament.id),
    getUser(),
    createSupabaseAdmin()
      .from("entries")
      .select("product_id, seat")
      .eq("tournament_id", tournament.id)
      .not("seat", "is", null)
      .is("disqualified_at", null),
  ]);
  let voted = new Set<string>();
  if (user) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("qualifying_votes")
      .select("product_id")
      .eq("tournament_id", tournament.id)
      .eq("voter_id", user.id);
    voted = new Set((data ?? []).map((r) => r.product_id as string));
  } else {
    const guestId = await readGuestId();
    if (guestId) {
      const { data } = await createSupabaseAdmin()
        .from("qualifying_votes")
        .select("product_id")
        .eq("tournament_id", tournament.id)
        .eq("guest_id", guestId);
      voted = new Set((data ?? []).map((r) => r.product_id as string));
    }
  }
  // Same order the bracket is seeded in: badge/pass first, then most votes.
  const seeded = rows.filter((r) => r.entry_path !== "free");
  const free = rows.filter((r) => r.entry_path === "free");
  // Seats placed by the admin first; empty seats filled in ranking order (same as the engine).
  const size = tournament.bracket_size;
  const bySeat = new Map(((seatRows ?? []) as { product_id: string; seat: number }[]).map((r) => [r.product_id, r.seat]));
  const projected: Product[] = [];
  for (const r of rows) {
    const s = bySeat.get(r.product.id);
    if (s && s <= size) projected[s - 1] = r.product;
  }
  const rest = [...seeded, ...free].filter((r) => !bySeat.has(r.product.id));
  for (let i = 0; i < size && rest.length; i++) if (!projected[i]) projected[i] = rest.shift()!.product;
  const qualifying = tournament.status === "qualifying";

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-4">
      <SectionTitle title={tournament.name} />
      <BracketBoard
        size={tournament.bracket_size}
        matches={[]}
        products={new Map()}
        projected={projected}
        header={
          <BoardHeader
            eyebrow={tournament.paused_at ? "Paused" : qualifying ? "Qualifying" : "Entries open"}
            title="Projected bracket"
            live={qualifying && !tournament.paused_at}
            countdown={
              qualifying && tournament.qualifying_ends_at
                ? { to: tournament.qualifying_ends_at, label: "Bracket locks in", pausedAt: tournament.paused_at }
                : undefined
            }
          />
        }
      />
      <p className="mt-3 text-center text-xs text-muted">
        Projected bracket of {tournament.bracket_size}. Paid and badge brands get in first, then the most votes.
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
