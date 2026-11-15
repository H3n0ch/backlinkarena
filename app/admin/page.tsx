import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  markPassPaid,
  rejectBadge,
  removeProduct,
  runEngineNow,
  startBracketNow,
  startQualifying,
  verifyBadge,
} from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Entry, Product, Tournament } from "@/lib/types";
import { ActionButton, CreateTournamentForm, PrizeForm, TimesForm, VoteRemovalForms } from "./AdminForms";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

function qualifyingOverdue(t: Tournament): boolean {
  return t.status === "qualifying" && !!t.qualifying_ends_at && Date.parse(t.qualifying_ends_at) < Date.now();
}

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Admin />
      </Suspense>
    </div>
  );
}

async function Admin() {
  await requireAdmin();
  const db = createSupabaseAdmin();
  const [{ data: tournaments }, { data: productRows }, { data: profiles }] = await Promise.all([
    db.from("tournaments").select("*").order("created_at", { ascending: false }),
    db.from("products").select("*").order("created_at", { ascending: false }),
    db.from("profiles").select("id, email, full_name"),
  ]);
  const ts = (tournaments ?? []) as Tournament[];
  const products = (productRows ?? []) as Product[];
  // "Name (email)" when the name is known from Google sign-in, else just the email.
  const emails = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      p.full_name ? `${p.full_name as string} (${p.email as string})` : ((p.email as string | null) ?? null),
    ]),
  );
  const active = ts.find((t) => t.status !== "finished") ?? null;
  const finished = ts.filter((t) => t.status === "finished");

  let entries: Entry[] = [];
  if (active) {
    const { data } = await db.from("entries").select("*").eq("tournament_id", active.id);
    entries = (data ?? []) as Entry[];
  }
  const entryOf = new Map(entries.map((e) => [e.product_id, e]));
  const pendingBadges = products.filter((p) => p.badge_status === "pending").length;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-extrabold">Admin</h1>

      {/* Tournament */}
      <section className="card p-5">
        <h2 className="font-display text-2xl font-extrabold">Tournament</h2>
        {active ? (
          <div className="mt-3 flex flex-col gap-4">
            <p>
              <span className="font-bold">{active.name}</span> · status{" "}
              <span className="rounded-full bg-sun px-2 font-bold">{active.status}</span> · bracket{" "}
              {active.bracket_size} · {entries.length} entries (
              {entries.filter((e) => e.entry_path !== "free").length} seeded)
            </p>
            {qualifyingOverdue(active) && entries.length < 8 && (
                <p className="rounded-xl border border-line bg-red-soft p-3 text-sm font-semibold">
                  ⚠️ Qualifying has ended but only {entries.length} entries exist. The bracket needs at
                  least 8, so the tournament stays in qualifying until more sites join.
                </p>
              )}
            {active.status !== "bracket" && (
              <TimesForm id={active.id} qualifyingEndsAt={active.qualifying_ends_at} matchHours={active.match_hours} />
            )}
            <div className="flex flex-wrap gap-2">
              {active.status === "draft" && (
                <ActionButton
                  action={startQualifying.bind(null, active.id)}
                  label="Start qualifying"
                  className="btn bg-red text-white text-sm"
                />
              )}
              {(active.status === "draft" || active.status === "qualifying") && (
                <ActionButton
                  action={startBracketNow.bind(null, active.id)}
                  label="Start bracket now"
                  confirm="Seed the bracket and start round 1 now?"
                  className="btn bg-ink text-white text-sm"
                />
              )}
              <ActionButton action={runEngineNow} label="Run scheduled job now" className="btn bg-card text-sm" />
              <Link href="/arena" className="btn bg-card text-sm">
                View bracket →
              </Link>
              <a href="/admin/export" className="btn bg-card text-sm">
                Export losers CSV
              </a>
            </div>
            {active.status === "draft" && (
              <p className="text-sm text-muted">
                Drafts accept entries but no votes. The bracket needs at least 8 entries to start (a
                16-bracket falls back to 8 if there aren&apos;t 16).
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <CreateTournamentForm />
          </div>
        )}
      </section>

      {/* Finished: prize delivery */}
      {finished.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-2xl font-extrabold">Finished tournaments</h2>
          <ul className="mt-3 flex flex-col gap-4">
            {finished.map((t) => {
              const w = products.find((p) => p.id === t.winner_product_id);
              return (
                <li key={t.id} className="flex flex-col gap-2 border-t border-line/10 pt-3">
                  <p>
                    <span className="font-bold">{t.name}</span> · winner:{" "}
                    <span className="font-bold">{w ? `${w.name} (${w.domain}, ${emails.get(w.owner_id) ?? "?"})` : "-"}</span>
                    {t.prize_delivered_at && " · ✓ delivered"}
                  </p>
                  <PrizeForm tournamentId={t.id} current={t.prize_url} />
                  <a href={`/admin/export?tournament=${t.id}`} className="text-sm font-semibold underline">
                    Export losers CSV
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Products */}
      <section className="card p-5">
        <h2 className="font-display text-2xl font-extrabold">
          Products <span className="text-base text-muted">({products.length}, {pendingBadges} badge checks pending)</span>
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Domain</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Entry</th>
                <th className="py-2 pr-3">Badge</th>
                <th className="py-2 pr-3">Pass</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const e = entryOf.get(p.id);
                return (
                  <tr key={p.id} className="border-b border-line/10 align-top">
                    <td className="py-2 pr-3">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        {p.domain}
                      </a>
                      <div className="text-xs text-muted">{p.category ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3">{emails.get(p.owner_id) ?? "?"}</td>
                    <td className="py-2 pr-3">{e ? e.entry_path : "-"}</td>
                    <td className="py-2 pr-3">
                      <span className={p.badge_status === "pending" ? "rounded bg-sun px-1 font-bold" : ""}>
                        {p.badge_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{p.pass_paid ? "paid" : "-"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {(p.badge_status !== "verified" || e?.entry_path === "free") && (
                          <ActionButton action={verifyBadge.bind(null, p.id)} label="Verify badge" />
                        )}
                        {p.badge_status !== "none" && (
                          <ActionButton action={rejectBadge.bind(null, p.id)} label="Reset badge" />
                        )}
                        {(!p.pass_paid || e?.entry_path === "free") && (
                          <ActionButton action={markPassPaid.bind(null, p.id)} label="Mark pass paid" />
                        )}
                        <ActionButton
                          action={removeProduct.bind(null, p.id)}
                          label="Remove"
                          confirm={`Remove ${p.domain}? This deletes its entries and votes.`}
                          className="btn bg-red-soft text-xs py-1! px-3!"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Anti-cheat */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-2xl font-extrabold">Anti-cheat</h2>
        <VoteRemovalForms />
      </section>
    </div>
  );
}
