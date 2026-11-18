import { connection, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabasePublic } from "@/lib/supabase/server";
import { runEngine } from "@/lib/tournament-emails";

type Snapshot = {
  /** Changes whenever a timer, status or match changes: the client refreshes the page then. */
  v: string;
  /** Soonest upcoming deadline (ms), so the client can check right when it hits zero. */
  next: number | null;
  due: boolean;
};

async function snapshot(): Promise<Snapshot> {
  const db = createSupabasePublic();
  const { data: t } = await db
    .from("tournaments")
    .select("id, status, paused_at, qualifying_ends_at, qualifying_overtime, match_minutes, winner_product_id")
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!t) return { v: "none", next: null, due: false };

  const { data: ms } = await db
    .from("matches")
    .select("id, status, ends_at, winner_product_id")
    .eq("tournament_id", t.id)
    .order("round")
    .order("position");
  const matches = ms ?? [];
  const v = JSON.stringify([
    t.id,
    t.status,
    t.paused_at,
    t.qualifying_ends_at,
    t.qualifying_overtime,
    t.match_minutes,
    matches.map((m) => [m.id, m.status, m.ends_at, m.winner_product_id]),
  ]);

  const now = Date.now();
  const deadlines =
    t.status === "qualifying"
      ? [t.qualifying_ends_at]
      : t.status === "bracket"
        ? matches.filter((m) => m.status === "open").map((m) => m.ends_at)
        : [];
  const times = deadlines.filter(Boolean).map((d) => Date.parse(d as string));
  const due = !t.paused_at && times.some((x) => x <= now);
  const future = times.filter((x) => x > now);
  return { v, next: future.length ? Math.min(...future) : null, due };
}

/**
 * Public clock for open pages. When a timer has run out, it runs the engine
 * (idempotent, same as the 5-minute scheduled job), so short test matches don't
 * wait for the next scheduled run.
 */
export async function GET() {
  await connection();
  let s = await snapshot();
  if (s.due) {
    await runEngine(createSupabaseAdmin());
    s = await snapshot();
  }
  return NextResponse.json({ v: s.v, next: s.next }, { headers: { "cache-control": "no-store" } });
}
