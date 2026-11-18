/*
  Pure rules for the "during the tournament" emails (lib/tournament-emails.ts sends them).
  No server imports, so they're unit-tested in lib/nudges.test.ts.
*/

const HOUR = 3_600_000;

/** A match-live email is only sent this long after the match starts, so old matches never get one. */
export const LIVE_WINDOW_MS = 3 * HOUR;

/** Qualifying-ending email goes out when qualifying ends within this window. */
export const QUALIFYING_WARNING_MS = 24 * HOUR;

/**
 * When the "you're behind" email goes out: the last 6 hours of a match, or the last half of it
 * for short matches. Never in the final 10 minutes (too late to rally anyone).
 */
export function behindWindow(startsAt: number, endsAt: number): { from: number; to: number } {
  const length = endsAt - startsAt;
  const lead = Math.min(6 * HOUR, length / 2);
  return { from: endsAt - lead, to: endsAt - Math.min(10 * 60_000, length / 10) };
}

/** True when a brand with `mine` votes against `theirs` should get the "you're behind" email now. */
export function shouldWarnBehind(o: { now: number; startsAt: number; endsAt: number; mine: number; theirs: number }): boolean {
  if (o.mine >= o.theirs) return false;
  const w = behindWindow(o.startsAt, o.endsAt);
  return o.now >= w.from && o.now < w.to;
}

export type QualifyingEntry = {
  productId: string;
  entryPath: "free" | "badge" | "pass";
  votes: number;
  createdAt: string;
  /** Seat placed by the admin (only counts when within the bracket). */
  seat: number | null;
};

export type Standing = {
  productId: string;
  /** 1-based rank among free entries competing for the open spots. */
  rank: number;
  /** How many spots free entries can still win. */
  openSpots: number;
  inside: boolean;
  /** Inside: votes ahead of the first brand outside (null if nobody is outside). Outside: votes needed to pass the last brand inside. */
  margin: number | null;
};

/**
 * Where each free, unseated entry stands, using the same order as seed_bracket():
 * seated brands keep their seat, badge + pass fill next, then free entries by votes desc, earlier signup.
 */
export function qualifyingStandings(entries: QualifyingEntry[], bracketSize: number): Standing[] {
  const seated = entries.filter((e) => e.seat !== null && e.seat >= 1 && e.seat <= bracketSize).length;
  const rest = entries.filter((e) => !(e.seat !== null && e.seat >= 1 && e.seat <= bracketSize));
  const guaranteed = rest.filter((e) => e.entryPath !== "free").length;
  const openSpots = Math.max(0, bracketSize - seated - guaranteed);
  const free = rest
    .filter((e) => e.entryPath === "free")
    .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));

  const lastIn = openSpots > 0 ? free[openSpots - 1] : undefined;
  const firstOut = free[openSpots];
  return free.map((e, i) => {
    const inside = i < openSpots;
    let margin: number | null;
    if (inside) margin = firstOut ? e.votes - firstOut.votes : null;
    else margin = lastIn ? lastIn.votes - e.votes + 1 : null;
    return { productId: e.productId, rank: i + 1, openSpots, inside, margin };
  });
}

/** "under an hour", "5 hours", "2 days": rough time left for email copy. */
export function roughTimeLeft(ms: number): string {
  if (ms < HOUR) return "under an hour";
  const h = Math.round(ms / HOUR);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${Math.round(h / 24)} days`;
}
