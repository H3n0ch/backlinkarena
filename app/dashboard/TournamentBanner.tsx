import Link from "next/link";
import { CountdownBoxes } from "@/components/CountdownBoxes";
import { GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import { roundName } from "@/lib/time";
import type { Tournament } from "@/lib/types";

/** True while `iso` is still ahead (request time; the dashboard is dynamic). */
function isFuture(iso: string): boolean {
  return Date.parse(iso) > Date.now();
}

/**
 * Dark announcement banner at the top of the dashboard: what the tournament is doing right
 * now, the clock that matters for this phase, and how full the bracket is.
 */
export function TournamentBanner({
  tournament: t,
  winner,
  entered,
  roundEndsAt,
  liveRound,
}: {
  tournament: Tournament;
  winner: string | null;
  /** Brands entered (not disqualified). */
  entered: number;
  /** End of the open round, while the bracket runs. */
  roundEndsAt: string | null;
  liveRound: number | null;
}) {
  const paused = Boolean(t.paused_at) && t.status !== "finished";
  const finished = t.status === "finished";
  const size = t.bracket_size;
  const filled = Math.min(entered, size);
  const left = size - filled;

  const copy =
    t.status === "draft"
      ? {
          eyebrow: "Announcing · Opens soon",
          headline: `${size} spots. One backlink. Who takes it?`,
          sub:
            left > 0
              ? `Entries are open before qualifying starts. ${left} of ${size} spots still free.`
              : "The bracket is already full of entries. Qualifying decides who stays in.",
        }
      : t.status === "qualifying"
        ? {
            eyebrow: "Qualifying · Live",
            headline: "Voting is on. Get your brand into the bracket.",
            sub: `The ${size} brands with seats or the most votes make the bracket.`,
          }
        : t.status === "bracket"
          ? {
              eyebrow: "Bracket · Live",
              headline: liveRound ? `${roundName(liveRound, size)} is underway` : "The bracket is underway",
              sub: "Matchups run one round at a time. Every vote counts.",
            }
          : {
              eyebrow: "Tournament · Closed",
              headline: winner ? `🏆 ${winner} won it` : "This tournament is over",
              sub: "The next tournament will be announced here. We'll email you when it opens.",
            };

  const countdown =
    paused || finished
      ? null
      : (t.status === "draft" || t.status === "qualifying") &&
          t.qualifying_ends_at &&
          !t.qualifying_overtime &&
          isFuture(t.qualifying_ends_at)
        ? { to: t.qualifying_ends_at, label: "First matchups start in" }
        : t.status === "bracket" && roundEndsAt
          ? { to: roundEndsAt, label: "Next matchups start in" }
          : null;

  return (
    <section style={PREMIUM_FRAME} className="relative overflow-hidden rounded-2xl p-5 sm:px-10 sm:py-8">
      {/* Gold sweep along the top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-300/70 to-transparent" />

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
            {!finished && !paused && (
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/70" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
            )}
            {paused ? "Paused" : copy.eyebrow}
          </p>
          <p className="mt-2 text-sm font-semibold text-white/60">{t.name}</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            <span style={GOLD_TEXT}>{copy.headline}</span>
          </h2>
          <p className="mt-2 text-sm text-white/65">
            {paused ? "The tournament is paused for a moment. The clock picks up where it left off." : copy.sub}
          </p>
        </div>

        {countdown ? (
          <CountdownBoxes to={countdown.to} label={countdown.label} pausedAt={t.paused_at ?? null} />
        ) : t.status === "draft" ? (
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Prize</p>
            <p className="mt-1 font-display text-xl font-extrabold text-white">DA 50+ backlink</p>
            <p className="text-xs text-white/50">in the winner&apos;s niche</p>
          </div>
        ) : null}
      </div>

      {/* Spots meter while the bracket is still being filled */}
      {(t.status === "draft" || t.status === "qualifying") && (
        <div className="mt-6">
          <div className="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            <span>Bracket spots</span>
            <span className="tabular-nums text-white/80">
              {filled} / {size}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-300 via-orange-500 to-rose-600 shadow-[0_0_12px_rgb(251_191_36/0.6)]"
              style={{ width: `${Math.max(4, (filled / size) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/arena" className="font-semibold text-amber-200 hover:text-amber-100">
          {t.status === "bracket" || finished ? "See the bracket →" : "See the projected bracket →"}
        </Link>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Get a seat", text: "Pay $29 or add our badge to skip qualifying. Or enter free and collect votes." },
  { title: "Rally votes", text: "Share your matchup. Each round lasts a set time, most votes moves on." },
  { title: "Win the backlink", text: "The champion gets a DA 50+ backlink. Everyone keeps the traffic." },
];

/** Three-step guide; `current` (0-2) is highlighted, null = none. */
export function HowItWorks({ current }: { current: number | null }) {
  return (
    <ol className="mt-4 grid gap-3 sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const on = current === i;
        const done = current !== null && i < current;
        return (
          <li
            key={s.title}
            className={`rounded-xl p-4 ${on ? "border-gradient" : "border border-line bg-white/70"}`}
          >
            <p className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold ${
                  on ? "bg-red text-white" : done ? "bg-mint-soft text-mint" : "bg-paper text-muted ring-1 ring-line"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="font-display font-extrabold">{s.title}</span>
              {on && <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-red-dark">You are here</span>}
            </p>
            <p className="mt-1.5 text-xs text-muted">{s.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Totals across all of the user's sites. */
export function StatsRow({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{s.label}</p>
          <p className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">
            {typeof s.value === "number" ? s.value.toLocaleString("en-US") : s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
