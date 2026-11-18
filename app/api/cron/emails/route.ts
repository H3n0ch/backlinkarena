import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTournamentEmails } from "@/lib/tournament-emails";

/**
 * Called by the scheduled Netlify job (netlify/functions/advance.mts) every 5 minutes:
 * runs the engine, then sends due knockout / results emails. Needs CRON_SECRET.
 */
export async function POST(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { error } = await createSupabaseAdmin().rpc("advance_tournaments");
  if (error) console.error("cron: advance failed", error.message);
  await sendTournamentEmails();
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
