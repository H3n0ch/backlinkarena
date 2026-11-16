import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { roundName } from "@/lib/time";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { AdminNav } from "../../AdminNav";
import { AddEntryForm, CreateMatchForm, EntryRow, MatchEditor, TournamentEditForm } from "../../CrmForms";

export const metadata: Metadata = { title: "Admin · Tournament", robots: { index: false } };

export default function AdminTournamentPage({ params }: PageProps<"/admin/tournaments/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <TournamentAdmin params={params} />
      </Suspense>
    </div>
  );
}

async function TournamentAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createSupabaseAdmin();
  const { data } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const t = data as Tournament;

  const [{ data: entryRows }, { data: matchRows }, { data: productRows }, { data: allT }, { data: qv }] = await Promise.all([
    db.from("entries").select("*").eq("tournament_id", id).order("created_at"),
    db.from("matches").select("*").eq("tournament_id", id).order("round").order("position"),
    db.from("products").select("*").order("name"),
    db.from("tournaments").select("id, name, status").order("created_at", { ascending: false }),
    db.from("qualifying_votes").select("product_id").eq("tournament_id", id),
  ]);
  const entries = (entryRows ?? []) as Entry[];
  const matches = (matchRows ?? []) as Match[];
  const products = (productRows ?? []) as Product[];
  const byId = new Map(products.map((p) => [p.id, p]));

  // Real (unadjusted) match votes per side.
  const matchIds = matches.map((m) => m.id);
  const { data: voteRows } = matchIds.length
    ? await db.from("votes").select("match_id, product_id").in("match_id", matchIds)
    : { data: [] };
  const realMatch = new Map<string, number>();
  for (const v of voteRows ?? []) {
    const k = `${v.match_id}:${v.product_id}`;
    realMatch.set(k, (realMatch.get(k) ?? 0) + 1);
  }
  const realQ = new Map<string, number>();
  for (const v of qv ?? []) realQ.set(v.product_id as string, (realQ.get(v.product_id as string) ?? 0) + 1);

  const tOptions = (allT ?? []).map((x) => ({ id: x.id as string, label: `${x.name as string} (${x.status as string})` }));
  const entrants = entries.map((e) => byId.get(e.product_id)).filter((p): p is Product => Boolean(p));
  // Bracket slots may use any entrant; fall back to all sites so a product can be dropped in directly.
  const entrantOptions = entrants.map((p) => ({ id: p.id, label: `${p.name} (${p.domain})` }));
  const allOptions = products.map((p) => ({ id: p.id, label: `${p.name} (${p.domain})` }));
  const notEntered = allOptions.filter((o) => !entries.some((e) => e.product_id === o.id));
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <>
      <AdminNav current="/admin/tournaments" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-4xl font-extrabold">{t.name}</h1>
        <Link href="/arena" className="text-sm font-semibold underline" target="_blank">
          Public bracket ↗
        </Link>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Settings</h2>
        <p className="mt-1 text-sm text-muted">
          Changing status by hand skips the engine. To seed the bracket from qualifying, use “Start bracket now” on the
          Overview page instead.
        </p>
        <div className="mt-3">
          <TournamentEditForm key={JSON.stringify(t)} t={t} productOptions={entrantOptions.length ? entrantOptions : allOptions} />
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Bracket</h2>
        <p className="mt-1 text-sm text-muted">
          Pick any site for side A / B to move people around. Vote boxes set the number shown publicly; the
          difference from real votes is stored as an adjustment and also counts when the engine decides the winner.
        </p>
        {rounds.length === 0 && <p className="mt-4 text-muted">No matches yet.</p>}
        {rounds.map((r) => (
          <div key={r} className="mt-6">
            <h3 className="font-display text-lg font-extrabold">
              Round {r} · {roundName(r, t.bracket_size)}
            </h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {matches
                .filter((m) => m.round === r)
                .map((m) => {
                  const real = {
                    a: m.product_a ? (realMatch.get(`${m.id}:${m.product_a}`) ?? 0) : 0,
                    b: m.product_b ? (realMatch.get(`${m.id}:${m.product_b}`) ?? 0) : 0,
                  };
                  return (
                    <MatchEditor
                      key={JSON.stringify([m, real])}
                      match={m}
                      real={real}
                      productOptions={entrantOptions.length ? entrantOptions : allOptions}
                      names={names}
                    />
                  );
                })}
            </div>
          </div>
        ))}
        <div className="mt-6 border-t border-line/10 pt-4">
          <p className="mb-2 text-sm font-semibold">Add an empty match</p>
          <CreateMatchForm tournamentId={t.id} matchHours={t.match_hours} />
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Entries ({entries.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Tournament (move)</th>
                <th className="py-2 pr-3">Entry</th>
                <th className="py-2 pr-3">Qualified</th>
                <th className="py-2 pr-3">Out in round</th>
                <th className="py-2 pr-3">Qualifying votes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const p = byId.get(e.product_id);
                return (
                  <EntryRow
                    key={JSON.stringify(e)}
                    entry={e}
                    realVotes={realQ.get(e.product_id) ?? 0}
                    tournaments={tOptions}
                    heading={
                      p ? (
                        <Link href={`/admin/products/${p.id}`} className="flex items-center gap-2">
                          <ProductLogo src={p.logo_url} name={p.name} size={28} />
                          <span className="font-semibold">{p.name}</span>
                        </Link>
                      ) : (
                        "?"
                      )
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        {notEntered.length > 0 && (
          <div className="mt-4">
            <AddEntryForm productOptions={notEntered} tournaments={[{ id: t.id, label: t.name }]} />
          </div>
        )}
      </section>
    </>
  );
}
