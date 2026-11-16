import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deleteMatchVote, deleteQualifyingVote, deleteVotesByNetwork } from "@/app/actions/crm";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { roundName } from "@/lib/time";
import type { Entry, Match, Tournament } from "@/lib/types";
import { ActionButton } from "../AdminForms";
import { AdminNav } from "../AdminNav";

export const metadata: Metadata = { title: "Admin · Votes", robots: { index: false } };

const LIMIT = 1000;

export default function AdminVotesPage({ searchParams }: PageProps<"/admin/votes">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Votes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Who = { id: number; voter_id: string | null; guest_id: string | null; ip_hash: string | null };
type VoteRow = Who & { match_id: string; product_id: string; ref: string | null; created_at: string };
type QVoteRow = Who & { tournament_id: string; product_id: string; created_at: string };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

async function Votes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const db = createSupabaseAdmin();

  const [votesRes, qvotesRes, profilesRes, productsRes, matchesRes, tournamentsRes, entriesRes] = await Promise.all([
    db.from("votes").select("id, match_id, voter_id, guest_id, ip_hash, product_id, ref, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(LIMIT),
    db.from("qualifying_votes").select("id, tournament_id, product_id, voter_id, guest_id, ip_hash, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(LIMIT),
    db.from("profiles").select("id, email, full_name"),
    db.from("products").select("id, name, domain"),
    db.from("matches").select("*"),
    db.from("tournaments").select("*"),
    db.from("entries").select("*").neq("vote_adjust", 0),
  ]);

  const people = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, { email: (p.email as string | null) ?? "?", name: p.full_name as string | null }]),
  );
  const prod = new Map((productsRes.data ?? []).map((p) => [p.id as string, { name: p.name as string, domain: p.domain as string }]));
  const matches = (matchesRes.data ?? []) as Match[];
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const tournaments = new Map(((tournamentsRes.data ?? []) as Tournament[]).map((t) => [t.id, t]));

  const matchLabel = (m: Match | undefined) => {
    if (!m) return "?";
    const t = tournaments.get(m.tournament_id);
    const a = m.product_a ? (prod.get(m.product_a)?.name ?? "?") : "bye";
    const b = m.product_b ? (prod.get(m.product_b)?.name ?? "?") : "bye";
    return `${t?.name ?? "?"} · ${t ? roundName(m.round, t.bracket_size) : `R${m.round}`} #${m.position}: ${a} vs ${b}`;
  };

  const matchVotes = (votesRes.data ?? []) as VoteRow[];
  const qVotes = (qvotesRes.data ?? []) as QVoteRow[];
  const match = (...parts: (string | null | undefined)[]) => !q || parts.some((s) => s?.toLowerCase().includes(q));

  const shownMatchVotes = matchVotes.filter((v) => {
    const p = v.voter_id ? people.get(v.voter_id) : undefined;
    const pr = prod.get(v.product_id);
    return match(p?.email, p?.name, pr?.name, pr?.domain, v.ref, v.match_id, v.voter_id ? null : "guest", v.ip_hash);
  });
  const shownQVotes = qVotes.filter((v) => {
    const p = v.voter_id ? people.get(v.voter_id) : undefined;
    const pr = prod.get(v.product_id);
    return match(p?.email, p?.name, pr?.name, pr?.domain, v.voter_id ? null : "guest", v.ip_hash);
  });

  const adjustedMatches = matches.filter((m) => (m.a_adjust ?? 0) !== 0 || (m.b_adjust ?? 0) !== 0);
  const adjustedEntries = (entriesRes.data ?? []) as Entry[];
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

  const netCount = new Map<string, number>();
  for (const v of [...matchVotes, ...qVotes]) {
    if (v.ip_hash) netCount.set(v.ip_hash, (netCount.get(v.ip_hash) ?? 0) + 1);
  }

  const voter = (v: Who) => {
    if (!v.voter_id) {
      // Guest vote: shown with a short tag of the hashed network (IP) so repeats stand out.
      const n = v.ip_hash ? (netCount.get(v.ip_hash) ?? 0) : 0;
      return (
        <>
          <span className="rounded-full bg-sun/60 px-2 text-xs font-bold">Guest</span>
          {v.ip_hash && (
            <span className="ml-1 text-xs text-muted" title="Network (hashed IP)">
              net {v.ip_hash.slice(0, 6)}
              {n > 1 && <b className="text-red"> · {n} votes</b>}
            </span>
          )}
        </>
      );
    }
    const p = people.get(v.voter_id);
    return (
      <>
        <span className="break-all">{p?.email ?? "?"}</span>
        {p?.name && <span className="block text-xs text-muted">{p.name}</span>}
      </>
    );
  };

  const deleteButtons = (v: Who, kind: "match" | "qualifying") => (
    <div className="flex flex-wrap gap-1">
      <ActionButton
        action={(kind === "match" ? deleteMatchVote : deleteQualifyingVote).bind(null, v.id)}
        label="Delete"
        confirm="Delete this vote?"
        className="btn bg-red-soft text-xs py-1! px-3!"
      />
      {!v.voter_id && v.ip_hash && (netCount.get(v.ip_hash) ?? 0) > 1 && (
        <ActionButton
          action={deleteVotesByNetwork.bind(null, v.ip_hash)}
          label="Delete network"
          confirm={`Delete all ${netCount.get(v.ip_hash)} votes from this network?`}
          className="btn bg-red-soft text-xs py-1! px-3!"
        />
      )}
    </div>
  );

  return (
    <>
      <AdminNav current="/admin/votes" />
      <h1 className="font-display text-4xl font-extrabold">Votes</h1>
      <p className="mt-2 text-sm text-muted">
        Every vote stored in the database: {votesRes.count ?? 0} match votes and {qvotesRes.count ?? 0} qualifying
        votes{(votesRes.count ?? 0) > LIMIT || (qvotesRes.count ?? 0) > LIMIT ? ` (showing the newest ${LIMIT} of each)` : ""}.
      </p>

      <form className="mt-4 flex gap-2" action="/admin/votes">
        <input name="q" defaultValue={q} className="field" placeholder="Filter by voter email/name, site, ref or match ID" />
        <button className="btn bg-card text-sm">Filter</button>
        {q && (
          <Link href="/admin/votes" className="btn bg-card text-sm">
            Clear
          </Link>
        )}
      </form>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Match votes ({shownMatchVotes.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Voter</th>
                <th className="py-2 pr-3">Voted for</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Ref</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shownMatchVotes.map((v) => {
                const m = matchById.get(v.match_id);
                return (
                  <tr key={v.id} className="border-b border-line/10 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{when(v.created_at)}</td>
                    <td className="py-2 pr-3">{voter(v)}</td>
                    <td className="py-2 pr-3 font-semibold">{prod.get(v.product_id)?.name ?? "?"}</td>
                    <td className="py-2 pr-3">
                      {m ? (
                        <Link href={`/admin/tournaments/${m.tournament_id}`} className="underline">
                          {matchLabel(m)}
                        </Link>
                      ) : (
                        "?"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">{v.ref ?? ""}</td>
                    <td className="py-2">
                      {deleteButtons(v, "match")}
                    </td>
                  </tr>
                );
              })}
              {shownMatchVotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-muted">
                    No match votes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Qualifying votes ({shownQVotes.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Voter</th>
                <th className="py-2 pr-3">Voted for</th>
                <th className="py-2 pr-3">Tournament</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shownQVotes.map((v) => (
                <tr key={v.id} className="border-b border-line/10 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{when(v.created_at)}</td>
                  <td className="py-2 pr-3">{voter(v)}</td>
                  <td className="py-2 pr-3 font-semibold">{prod.get(v.product_id)?.name ?? "?"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/tournaments/${v.tournament_id}`} className="underline">
                      {tournaments.get(v.tournament_id)?.name ?? "?"}
                    </Link>
                  </td>
                  <td className="py-2">
                    {deleteButtons(v, "qualifying")}
                  </td>
                </tr>
              ))}
              {shownQVotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-muted">
                    No qualifying votes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Manual adjustments</h2>
        <p className="mt-1 text-sm text-muted">
          Numbers you changed in the admin panel. These are added on top of the real votes above.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {adjustedMatches.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/tournaments/${m.tournament_id}`} className="underline">
                {matchLabel(m)}
              </Link>{" "}
              · A {sign(m.a_adjust ?? 0)} · B {sign(m.b_adjust ?? 0)}
            </li>
          ))}
          {adjustedEntries.map((e) => (
            <li key={e.id}>
              Qualifying · {prod.get(e.product_id)?.name ?? "?"} in{" "}
              <Link href={`/admin/tournaments/${e.tournament_id}`} className="underline">
                {tournaments.get(e.tournament_id)?.name ?? "?"}
              </Link>{" "}
              · {sign(e.vote_adjust ?? 0)}
            </li>
          ))}
          {adjustedMatches.length === 0 && adjustedEntries.length === 0 && (
            <li className="text-muted">No manual adjustments.</li>
          )}
        </ul>
      </section>
    </>
  );
}
