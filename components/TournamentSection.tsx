import Link from "next/link";
import { BracketBoard } from "@/components/BracketBoard";
import { CountdownBoxes } from "@/components/CountdownBoxes";
import { JoinField } from "@/components/JoinField";
import { MatchCarousel } from "@/components/MatchCarousel";
import { MatchupCard } from "@/components/MatchupCard";
import { PagedList } from "@/components/PagedList";
import { ProductLogo } from "@/components/ProductLogo";
import { PREMIUM_FRAME } from "@/components/premium";
import { StadiumStand, StandRow } from "@/components/StadiumStand";
import { getUser } from "@/lib/auth";
import { getBracket, getLeaderboard } from "@/lib/data";
import { qualifyingVotedSet } from "@/lib/qualifying";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { matchPath } from "@/lib/share";
import { roundName } from "@/lib/time";
import type { Product, Tournament } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Tournament title, full bracket, current round and history. Used on / and /arena. */
export async function TournamentSection({
  tournament,
  carousel = false,
  stadium = false,
}: {
  tournament: Tournament | null;
  /** Show the current round's matchups as a swipeable carousel (home page). */
  carousel?: boolean;
  /** Qualifying as a stadium: bracket in the middle, qualifying brands in the stands around it (/arena). */
  stadium?: boolean;
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
    return stadium ? <Stadium tournament={tournament} /> : <Qualifying tournament={tournament} />;
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

/** Leaderboard, projected bracket and who has voted for what: shared by both qualifying layouts. */
async function qualifyingData(tournament: Tournament) {
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
  const voted = await qualifyingVotedSet(tournament.id, user?.id);
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
  return { ranked: [...seeded, ...free], projected, user, voted, qualifying: tournament.status === "qualifying" };
}

function qualifyingHeader(tournament: Tournament, qualifying: boolean) {
  return (
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
  );
}

/** Deep metallic gold for headings on the light page (the bright gold fades out on white). */
const GOLD_ON_LIGHT: React.CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #f59e0b 0%, #d97706 45%, #b45309 75%, #78350f 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

/** Stadium layout: the bracket is the pitch, qualifying brands fill the stands on both sides. */
async function Stadium({ tournament }: { tournament: Tournament }) {
  const { ranked, projected, user, voted, qualifying } = await qualifyingData(tournament);
  const size = tournament.bracket_size;
  const inside = ranked.slice(0, size);
  const chasing = ranked.slice(size);
  const open = size - inside.length;
  const shared = { tournamentId: tournament.id, qualifying, userId: user?.id ?? null, voted, cutAt: size };
  const join = "font-semibold text-amber-200 underline";

  return (
    <section>
      <div className="mx-auto max-w-[100rem] px-3 sm:px-4">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.32em] text-amber-700">The arena</p>
        <h2 className="mt-2 mb-8 text-center font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
          <span style={GOLD_ON_LIGHT}>{tournament.name}</span>
        </h2>
        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_18rem] xl:gap-5">
          <StadiumStand
            side="L"
            eyebrow="West stand"
            title="In the bracket"
            rows={inside}
            startRank={1}
            empty={
              <span>
                No brands yet.{" "}
                <Link href="/join" className={join}>
                  Be the first in →
                </Link>
              </span>
            }
            {...shared}
          />
          <div className="order-first xl:order-none">
            <BracketBoard
              size={size}
              matches={[]}
              products={new Map()}
              projected={projected}
              header={qualifyingHeader(tournament, qualifying)}
            />
            <p className="mt-3 text-center text-xs text-muted">
              <span className="font-semibold text-ink">Projected bracket of {size}, not final until it locks.</span>{" "}
              Seeded brands (paid or backlink) are guaranteed a spot. Free brands fill the remaining seats by votes and
              can still move in or out.
            </p>
          </div>
          <StadiumStand
            side="R"
            eyebrow="East stand"
            title="Chasing a spot"
            rows={chasing}
            startRank={size + 1}
            empty={
              open > 0 ? (
                <span>
                  {open} bracket {open === 1 ? "spot is" : "spots are"} still open.{" "}
                  <Link href="/join" className={join}>
                    Claim one →
                  </Link>
                </span>
              ) : (
                "Nobody on the bubble yet. Out-vote a brand in the bracket to take its spot."
              )
            }
            {...shared}
          />
        </div>
      </div>
    </section>
  );
}

async function Qualifying({ tournament }: { tournament: Tournament }) {
  const { ranked: rows, projected, user, voted, qualifying } = await qualifyingData(tournament);

  return (
    <section className="mx-auto max-w-6xl px-3 sm:px-4">
      <SectionTitle title={tournament.name} />
      <BracketBoard
        size={tournament.bracket_size}
        matches={[]}
        products={new Map()}
        projected={projected}
        header={qualifyingHeader(tournament, qualifying)}
      />
      <p className="mt-3 text-center text-xs text-muted">
        Projected bracket of {tournament.bracket_size}. Paid and badge brands get in first, then the most votes.
      </p>

      <div style={PREMIUM_FRAME} className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-[1.25rem]">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">Qualifying</p>
            <h3 className="mt-1 font-display text-lg font-extrabold uppercase tracking-tight text-white sm:text-xl">
              Leaderboard
            </h3>
          </div>
          <p className="text-[11px] text-white/45">
            Top {tournament.bracket_size} make the bracket · {rows.length} {rows.length === 1 ? "brand" : "brands"}
          </p>
        </div>
        <div className="p-3 sm:p-4">
          {rows.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-bold text-white">No brands yet. Be the first in.</p>
              <div className="mt-3">
                <JoinField />
              </div>
            </div>
          ) : (
            <PagedList pageSize={20}>
              {rows.map((r, i) => (
                <StandRow
                  key={r.product.id}
                  row={r}
                  rank={i + 1}
                  cutAt={tournament.bracket_size}
                  tournamentId={tournament.id}
                  qualifying={qualifying}
                  userId={user?.id ?? null}
                  voted={voted}
                  wide
                />
              ))}
            </PagedList>
          )}
        </div>
      </div>
    </section>
  );
}
