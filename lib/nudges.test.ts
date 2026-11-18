import { describe, expect, it } from "vitest";
import { qualifyingStandings, roughTimeLeft, shouldWarnBehind, type QualifyingEntry } from "./nudges";

const H = 3_600_000;

describe("shouldWarnBehind", () => {
  const base = { startsAt: 0, endsAt: 24 * H };
  it("warns a trailing brand in the last 6 hours", () => {
    expect(shouldWarnBehind({ ...base, now: 19 * H, mine: 3, theirs: 5 })).toBe(true);
  });
  it("stays quiet before the window, when leading or tied, and in the last minutes", () => {
    expect(shouldWarnBehind({ ...base, now: 17 * H, mine: 3, theirs: 5 })).toBe(false);
    expect(shouldWarnBehind({ ...base, now: 20 * H, mine: 5, theirs: 5 })).toBe(false);
    expect(shouldWarnBehind({ ...base, now: 24 * H - 5 * 60_000, mine: 0, theirs: 5 })).toBe(false);
  });
  it("uses the last half of short matches", () => {
    const short = { startsAt: 0, endsAt: 2 * H, mine: 0, theirs: 1 };
    expect(shouldWarnBehind({ ...short, now: 0.9 * H })).toBe(false);
    expect(shouldWarnBehind({ ...short, now: 1.2 * H })).toBe(true);
  });
});

describe("qualifyingStandings", () => {
  const e = (id: string, votes: number, extra: Partial<QualifyingEntry> = {}): QualifyingEntry => ({
    productId: id,
    entryPath: "free",
    votes,
    createdAt: `2026-11-01T00:00:0${id.length}Z`,
    seat: null,
    ...extra,
  });

  it("counts seats and guaranteed entries before free spots", () => {
    const s = qualifyingStandings(
      [e("seat", 0, { seat: 1 }), e("pass", 0, { entryPath: "pass" }), e("a", 10), e("bb", 7), e("ccc", 5), e("dddd", 1)],
      4,
    );
    expect(s.map((x) => [x.productId, x.rank, x.inside, x.margin])).toEqual([
      ["a", 1, true, 5],
      ["bb", 2, true, 2],
      ["ccc", 3, false, 3],
      ["dddd", 4, false, 7],
    ]);
    expect(s[0].openSpots).toBe(2);
  });

  it("breaks vote ties by earlier signup and handles a field that isn't full", () => {
    const s = qualifyingStandings([e("late", 3, { createdAt: "2026-11-02T00:00:00Z" }), e("early", 3, { createdAt: "2026-11-01T00:00:00Z" })], 8);
    expect(s.map((x) => x.productId)).toEqual(["early", "late"]);
    expect(s.every((x) => x.inside && x.margin === null)).toBe(true);
  });
});

describe("roughTimeLeft", () => {
  it("rounds for email copy", () => {
    expect(roughTimeLeft(20 * 60_000)).toBe("under an hour");
    expect(roughTimeLeft(1.2 * H)).toBe("1 hour");
    expect(roughTimeLeft(6 * H)).toBe("6 hours");
    expect(roughTimeLeft(72 * H)).toBe("3 days");
  });
});
