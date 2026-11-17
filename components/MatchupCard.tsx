import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { fightWidth, GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { ShareMenu } from "@/components/ShareMenu";
import { matchPath, matchShareUrl } from "@/lib/share";
import type { Counts, Match, Product } from "@/lib/types";

const SIDE = {
  a: {
    votes: "text-amber-300",
    frame: "from-amber-200 via-orange-400 to-rose-500",
    chip: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30",
    glow: "bg-orange-500/20",
  },
  b: {
    votes: "text-teal-300",
    frame: "from-emerald-300 via-teal-400 to-sky-500",
    chip: "bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/30",
    glow: "bg-teal-500/20",
  },
} as const;

function ThumbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function Side({
  p,
  side,
  leading,
  won,
  lost,
}: {
  p?: Product;
  side: "a" | "b";
  leading: boolean;
  won: boolean;
  lost: boolean;
}) {
  const s = SIDE[side];
  return (
    <div
      className={`relative flex h-full min-w-0 flex-col items-center justify-start gap-3 px-2 pt-5 pb-1 text-center transition ${
        lost ? "opacity-40 grayscale" : ""
      }`}
    >
      {(won || leading) && (
        <span
          className={`absolute top-0 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-[0.18em] uppercase ${
            won ? "bg-amber-400 text-stone-950 shadow-[0_0_16px_rgb(251_191_36/0.6)]" : s.chip
          }`}
        >
          {won ? "🏆 Winner" : "▲ Leading"}
        </span>
      )}
      {/* Logo in a gradient frame with a soft glow in the side's color */}
      <div className="relative">
        <span aria-hidden="true" className={`absolute -inset-3 rounded-3xl blur-xl ${s.glow}`} />
        <div className={`relative rounded-[1.15rem] bg-linear-to-br ${s.frame} p-0.5 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.9)]`}>
          <div className="rounded-2xl bg-white p-0.5">
            <ProductLogo src={p?.logo_url ?? null} name={p?.name ?? "?"} size={68} className="rounded-xl! border-0!" />
          </div>
        </div>
      </div>
      <div className="w-full min-w-0">
        <p className="truncate font-display text-base font-extrabold leading-tight text-white sm:text-lg">{p?.name ?? "TBD"}</p>
        <p className="truncate text-xs text-white/45">{p?.domain ?? "waiting for opponent"}</p>
        {p?.category && (
          <span className="mt-2 inline-block max-w-full truncate rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/55">
            {p.category}
          </span>
        )}
      </div>
    </div>
  );
}

export function MatchupCard({
  match,
  a,
  b,
  pausedAt = null,
}: {
  match: Match & { counts: Counts };
  a?: Product;
  b?: Product;
  /** Set while the tournament is paused: the clock freezes. */
  pausedAt?: string | null;
}) {
  const { a_votes, b_votes } = match.counts;
  const total = a_votes + b_votes;
  const pctA = total ? Math.round((a_votes / total) * 100) : 50;
  const closed = match.status === "closed";
  const winA = closed && match.winner_product_id === a?.id;
  const winB = closed && match.winner_product_id === b?.id;
  const path = matchPath(match, a?.slug, b?.slug);

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] transition duration-300 hover:-translate-y-0.5"
      style={PREMIUM_FRAME}
    >
      {/* Gold hairline along the top */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent" />

      {/* Header: match number + live/final status with time left */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <span className="text-[10px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
          Match {String(match.position).padStart(2, "0")}
        </span>
        {closed ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">
            Final result
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 py-1 pr-3 pl-2.5 text-[10px] font-semibold tracking-[0.14em] text-emerald-300 uppercase">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
            <span className="font-mono tracking-normal text-white/80 tabular-nums normal-case">
              <Countdown to={match.ends_at} endedText="ending" pausedAt={pausedAt} />
            </span>
          </span>
        )}
      </div>

      {/* Brands */}
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1 px-3 sm:gap-4 sm:px-5">
        <Side p={a} side="a" leading={!closed && a_votes > b_votes} won={winA} lost={closed && !winA} />
        <div className="flex flex-col items-center self-stretch">
          <span className="w-px flex-1 bg-linear-to-b from-transparent via-white/15 to-transparent" />
          <span className="relative my-2 flex size-11 items-center justify-center sm:size-12">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#fde68a,#f59e0b,#fff7ed,#b45309,#fde68a)] p-px"
            >
              <span className="block size-full rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0c0a09)]" />
            </span>
            <span className="relative font-display text-sm font-black italic sm:text-base" style={GOLD_TEXT}>
              VS
            </span>
          </span>
          <span className="w-px flex-1 bg-linear-to-b from-transparent via-white/15 to-transparent" />
        </div>
        <Side p={b} side="b" leading={!closed && b_votes > a_votes} won={winB} lost={closed && !winB} />
      </div>

      {/* Score: counts either side of a slim tug-of-war bar. mt-auto keeps score + buttons
          at the bottom, so cards in a row line up even when one brand has no category. */}
      <div className="mt-auto px-5 pt-5">
        <div className="flex items-end justify-between">
          <p className={`font-display text-3xl font-black leading-none tabular-nums ${SIDE.a.votes}`}>
            {a_votes}
            <span className="ml-1.5 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
              {a_votes === 1 ? "vote" : "votes"}
            </span>
          </p>
          <p className={`font-display text-3xl font-black leading-none tabular-nums ${SIDE.b.votes}`}>
            <span className="mr-1.5 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
              {b_votes === 1 ? "vote" : "votes"}
            </span>
            {b_votes}
          </p>
        </div>
        {/* Tug of war: each side keeps at least 25% so it always looks like a fight. */}
        <div className="relative mt-3 h-2">
          <div className="flex h-full overflow-hidden rounded-full ring-1 ring-white/10">
            <div
              className="h-full bg-linear-to-r from-amber-300 via-orange-500 to-rose-500 transition-[width] duration-700"
              style={{ width: `${fightWidth(pctA)}%` }}
            />
            <div className="h-full flex-1 bg-linear-to-r from-teal-400 to-sky-500" />
          </div>
          {/* Clash point */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_3px_rgb(255_255_255/0.55),0_0_22px_6px_rgb(251_191_36/0.4)] ring-2 ring-stone-950 transition-[left] duration-700"
            style={{ left: `${fightWidth(pctA)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-medium tracking-wide text-white/40 tabular-nums">
          <span>{total ? `${pctA}%` : ""}</span>
          <span>{total ? `${total} ${total === 1 ? "vote" : "votes"} total` : "No votes yet. Be the first!"}</span>
          <span>{total ? `${100 - pctA}%` : ""}</span>
        </div>
      </div>

      {/* Actions: compact and centred. Gold is neutral here (the sides are orange vs teal). */}
      <div className="mt-5 flex items-center justify-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3.5">
        <Link
          href={path}
          className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-amber-200 via-amber-400 to-amber-600 px-5 py-2 text-sm font-bold text-stone-950 shadow-[0_8px_20px_-8px_rgb(251_191_36/0.8),inset_0_1px_0_rgb(255_255_255/0.5)] transition hover:brightness-110 active:translate-y-px"
        >
          {!closed && <ThumbIcon />}
          {closed ? "See the result" : "Vote now"}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
        <ShareMenu
          className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-b from-sky-400 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgb(79_70_229/0.9),inset_0_1px_0_rgb(255_255_255/0.35)] transition hover:brightness-110 active:translate-y-px"
          link={matchShareUrl(path)}
          a={a ? { name: a.name, logo: a.logo_url, votes: a_votes } : undefined}
          b={b ? { name: b.name, logo: b.logo_url, votes: b_votes } : undefined}
        />
      </div>
    </article>
  );
}
