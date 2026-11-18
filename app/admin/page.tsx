import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  markPassPaid,
  recheckBadge,
  rejectBadge,
  runEngineNow,
  startBracketNow,
  startQualifying,
  verifyBadge,
} from "@/app/actions/admin";
import {
  addAllToTournament,
  addToTournament,
  autoFillSeats,
  clearSeats,
  pauseTournament,
  placeInNextSeat,
  reinstateEntry,
  resumeTournament,
  stopTournament,
} from "@/app/actions/control";
import { deleteProductAdmin, setMatchWinner } from "@/app/actions/crm";
import { ProductLogo } from "@/components/ProductLogo";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { matchMinutes, roundName } from "@/lib/time";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { ActionButton, CreateTournamentForm, PrizeForm, TimerPanel, VoteRemovalForms } from "./AdminForms";
import { AdminNav } from "./AdminNav";
import { nicheKey } from "@/lib/niche";
import { DqButton, PathChip, Seat, type SeatBrand } from "./ControlRoom";
import { InlineVotes } from "./CrmForms";
import { PagedList } from "./PagedList";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Admin />
      </Suspense>
    </div>
  );
}

const small = "btn bg-card text-xs py-1! px-3!";
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Paid pass first (who paid first), then badge, then free by votes, then earliest signup. */
function rankEntries<T extends { path: SeatBrand["path"]; votes: number; created: string; paidAt: string | null }>(
  rows: T[],
): T[] {
  const r = (p: SeatBrand["path"]) => (p === "pass" ? 0 : p === "badge" ? 1 : 2);
  const at = (x: T) => (x.path === "pass" ? (x.paidAt ?? x.created) : x.created);
  return [...rows].sort(
    (a, b) => r(a.path) - r(b.path) || (r(a.path) === 2 ? b.votes - a.votes : 0) || at(a).localeCompare(at(b)),
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
  const byId = new Map(products.map((p) => [p.id, p]));
  const emails = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      p.full_name ? `${p.full_name as string} (${p.email as string})` : ((p.email as string | null) ?? null),
    ]),
  );
  const active = ts.find((t) => t.status !== "finished") ?? null;
  const finished = ts.filter((t) => t.status === "finished");

  let entries: Entry[] = [];
  let matches: Match[] = [];
  const realQ = new Map<string, number>();
  const realM = new Map<string, number>();
  if (active) {
    const [{ data }, { data: ms }, { data: qv }] = await Promise.all([
      db.from("entries").select("*").eq("tournament_id", active.id),
      db.from("matches").select("*").eq("tournament_id", active.id).order("round").order("position"),
      db.from("qualifying_votes").select("product_id").eq("tournament_id", active.id),
    ]);
    entries = (data ?? []) as Entry[];
    matches = (ms ?? []) as Match[];
    for (const v of qv ?? []) realQ.set(v.product_id as string, (realQ.get(v.product_id as string) ?? 0) + 1);
    if (matches.length) {
      const { data: vs } = await db.from("votes").select("match_id, product_id").in("match_id", matches.map((m) => m.id));
      for (const v of vs ?? []) {
        const k = `${v.match_id}:${v.product_id}`;
        realM.set(k, (realM.get(k) ?? 0) + 1);
      }
    }
  }
  const entryOf = new Map(entries.map((e) => [e.product_id, e]));
  const matchOf = new Map<string, Match>();
  for (const m of matches) {
    if (m.product_a) matchOf.set(m.product_a, m);
    if (m.product_b) matchOf.set(m.product_b, m);
  }
  const qVotes = (e: Entry) => Math.max(0, (realQ.get(e.product_id) ?? 0) + (e.vote_adjust ?? 0));
  const mVotes = (m: Match, side: "a" | "b") => {
    const pid = side === "a" ? m.product_a : m.product_b;
    if (!pid) return 0;
    return Math.max(0, (realM.get(`${m.id}:${pid}`) ?? 0) + ((side === "a" ? m.a_adjust : m.b_adjust) ?? 0));
  };

  const preBracket = active && (active.status === "draft" || active.status === "qualifying");
  const live = entries.filter((e) => !e.disqualified_at);
  const disqualified = entries.filter((e) => e.disqualified_at);
  const toBrand = (e: Entry): SeatBrand & { created: string; productId: string; paidAt: string | null } => {
    const p = byId.get(e.product_id);
    return {
      entryId: e.id,
      productId: e.product_id,
      name: p?.name ?? "?",
      domain: p?.domain ?? "",
      logo: p?.logo_url ?? null,
      path: e.entry_path,
      votes: qVotes(e),
      category: p?.category ?? null,
      created: e.created_at,
      paidAt: p?.pass_paid_at ?? null,
    };
  };
  const seated = new Map(live.filter((e) => e.seat).map((e) => [e.seat!, toBrand(e)]));
  const waiting = rankEntries(live.filter((e) => !e.seat).map(toBrand));
  // Paid first (who paid first), then badge, then newest sign-ups first.
  const guaranteedFirst = (p: Product) => (p.pass_paid ? 0 : p.badge_status === "verified" ? 1 : 2);
  const notEntered = products
    .filter((p) => !entryOf.has(p.id))
    .sort(
      (a, b) =>
        guaranteedFirst(a) - guaranteedFirst(b) ||
        (a.pass_paid && b.pass_paid ? (a.pass_paid_at ?? "").localeCompare(b.pass_paid_at ?? "") : 0) ||
        b.created_at.localeCompare(a.created_at),
    );
  // "New" = signed up after the most recent tournament was created.
  const newSince = ts[0]?.created_at ?? null;
  const newCount = notEntered.filter((p) => !newSince || p.created_at > newSince).length;
  const size = active?.bracket_size ?? 16;
  const placed = seated.size;
  const canStart = preBracket && live.length >= size;
  const round = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const current = matches.filter((m) => m.round === round);
  // Manual badge checks, oldest request first.
  const badgeQueue = products
    .filter((p) => p.badge_status === "pending")
    .sort((a, b) => (a.badge_requested_at ?? a.created_at).localeCompare(b.badge_requested_at ?? b.created_at));
  const pendingBadges = badgeQueue.length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <AdminNav current="/admin" />
        <h1 className="font-display text-4xl font-extrabold">Control room</h1>
        <p className="mt-1 text-sm text-muted">Everything for the running tournament on one page.</p>
      </div>

      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
          How sign-ups reach the bracket
          <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>
            Someone adds their website. If a tournament is open (draft or qualifying), it lands on the{" "}
            <strong>waiting list</strong> below as <PathChip path="free" />. If none is open, it shows under{" "}
            <strong>Signed up, not entered</strong>.
          </li>
          <li>
            Paying $29 or a verified badge turns it into <PathChip path="pass" /> or <PathChip path="badge" />. Those move
            to the top of the waiting list. With no open tournament, paid passes join the next one automatically; badge brands enter themselves and skip qualifying when they do.
          </li>
          <li>
            You place brands into the {size} seats one by one (or click <strong>Auto-fill</strong>: paid → badge → most
            votes). Seat 1 plays seat 2, seat 3 plays seat 4, and so on.
          </li>
          <li>
            <strong>Start bracket</strong> needs {size} brands. Seats you placed are kept; any empty seat is filled from
            the top of the waiting list. Everyone left over is out for this tournament.
          </li>
          <li>
            <strong>Pause</strong> freezes voting and timers. <strong>Disqualify</strong> removes a brand (in the bracket, its
            opponent goes through). <strong>Stop</strong> ends the tournament without a winner and gives paid passes back.
          </li>
        </ol>
      </details>

      {/* Status + controls */}
      <section className="card p-5">
        {active ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold">{active.name}</h2>
              <span className="rounded-full bg-sun px-2.5 py-0.5 text-sm font-bold">{active.status}</span>
              {active.paused_at && (
                <span className="rounded-full bg-red px-2.5 py-0.5 text-sm font-bold text-white">
                  ⏸ Paused since {dateFmt.format(new Date(active.paused_at))}
                </span>
              )}
              {active.qualifying_overtime && (
                <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-sm font-bold">Overtime: waiting to fill</span>
              )}
            </div>
            <p className="text-sm text-muted">
              {preBracket
                ? `${live.length} on the waiting list or seated · ${placed}/${size} seats placed · ${
                    live.filter((e) => e.entry_path !== "free").length
                  } paid or badge`
                : `${roundName(round, size)} · ${current.filter((m) => m.status === "open").length} matches open`}
            </p>
            <div className="flex flex-wrap gap-2">
              {active.status === "draft" && (
                <ActionButton
                  action={startQualifying.bind(null, active.id)}
                  label="▶ Open qualifying votes"
                  className="btn bg-red text-sm text-white"
                />
              )}
              {preBracket && (
                <ActionButton
                  action={startBracketNow.bind(null, active.id)}
                  label={`▶ Start bracket (${Math.min(live.length, size)}/${size})`}
                  confirm={`Start the bracket now? ${placed} placed seats are kept, ${Math.max(0, size - placed)} empty seats are filled from the top of the waiting list. Everyone else is out.`}
                  className={`btn text-sm text-white ${canStart ? "bg-ink" : "bg-ink/40"}`}
                />
              )}
              {active.paused_at ? (
                <ActionButton
                  action={resumeTournament.bind(null, active.id)}
                  label="▶ Resume"
                  className="btn bg-mint text-sm text-white"
                />
              ) : (
                <ActionButton
                  action={pauseTournament.bind(null, active.id)}
                  label="⏸ Pause"
                  confirm="Pause the tournament? Voting stops and timers freeze until you resume."
                  className="btn bg-sun text-sm"
                />
              )}
              <ActionButton
                action={stopTournament.bind(null, active.id)}
                label="■ Stop tournament"
                confirm={`Stop "${active.name}" for good? Open matches close without a winner, there is no champion, and paid passes are given back for the next tournament. This can't be undone.`}
                className="btn bg-red-soft text-sm"
              />
              <ActionButton action={runEngineNow} label="Run scheduled job now" className="btn bg-card text-sm" />
              <Link href={`/admin/tournaments/${active.id}`} className="btn bg-card text-sm">
                Advanced editor
              </Link>
              <Link href="/arena" target="_blank" className="btn bg-card text-sm">
                Public view ↗
              </Link>
            </div>
            <TimerPanel
              key={`${active.id}:${active.status}:${active.qualifying_ends_at}:${matchMinutes(active)}`}
              id={active.id}
              status={active.status}
              qualifyingEndsAt={active.qualifying_ends_at}
              matchMinutes={matchMinutes(active)}
              nextMatchEnd={
                current
                  .filter((m) => m.status === "open")
                  .map((m) => m.ends_at)
                  .sort()[0] ?? null
              }
              openMatches={current.filter((m) => m.status === "open").length}
              paused={Boolean(active.paused_at)}
            />
          </div>
        ) : (
          <>
            <h2 className="font-display text-2xl font-extrabold">No tournament running</h2>
            <p className="mt-1 text-sm text-muted">
              Create one. Everyone with an unused paid pass is entered automatically. Badge brands enter themselves.
            </p>
            <div className="mt-4">
              <CreateTournamentForm />
            </div>
          </>
        )}
      </section>

      {/* Seats (before the bracket) */}
      {active && preBracket && (
        <section className="card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold">
                Bracket seats{" "}
                <span className={`text-base ${placed === size ? "text-mint" : "text-muted"}`}>
                  {placed}/{size} placed
                </span>
              </h2>
              <p className="text-sm text-muted">
                Pick a brand for each seat, or click × to send it back to waiting. Try to pair related niches (not direct
                competitors): Auto-fill seats the same niche side by side.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton action={autoFillSeats.bind(null, active.id)} label="Auto-fill empty seats" className="btn bg-ink text-sm text-white" />
              <ActionButton
                action={clearSeats.bind(null, active.id)}
                label="Clear all seats"
                confirm="Send everyone back to the waiting list?"
                className="btn bg-card text-sm"
              />
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-[image:var(--grad-brand)]" style={{ width: `${(placed / size) * 100}%` }} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Array.from({ length: size / 2 }, (_, i) => {
              const x = seated.get(2 * i + 1);
              const y = seated.get(2 * i + 2);
              const same = x && y && nicheKey(x.category) && nicheKey(x.category) === nicheKey(y.category);
              return (
              <div key={i} className="rounded-2xl border border-line bg-paper/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Match {i + 1}</p>
                  {x && y && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${same ? "bg-mint-soft text-mint" : "bg-sun/40 text-ink"}`}
                    >
                      {same ? "✓ Same niche" : "Different niches"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Seat seat={2 * i + 1} brand={seated.get(2 * i + 1) ?? null} waiting={waiting} editable />
                  <p className="text-center text-[10px] font-extrabold uppercase text-muted">vs</p>
                  <Seat seat={2 * i + 2} brand={seated.get(2 * i + 2) ?? null} waiting={waiting} editable />
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Live bracket */}
      {active && active.status === "bracket" && (
        <section className="card p-5">
          <h2 className="font-display text-2xl font-extrabold">Live: {roundName(round, size)}</h2>
          <p className="text-sm text-muted">Set a winner by hand or disqualify a side; the opponent goes through.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {current.map((m) => {
              const sides = (["a", "b"] as const).map((k) => {
                const pid = k === "a" ? m.product_a : m.product_b;
                return { k, p: pid ? byId.get(pid) : undefined, e: pid ? entryOf.get(pid) : undefined, votes: mVotes(m, k) };
              });
              return (
                <div key={m.id} className="rounded-2xl border border-line bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                    <span>Match {m.position}</span>
                    <span>{m.status === "open" ? `ends ${dateFmt.format(new Date(m.ends_at))}` : "closed"}</span>
                  </div>
                  {sides.map(({ k, p, e, votes }) => (
                    <div
                      key={k}
                      className={`flex flex-wrap items-center gap-2 rounded-xl p-2 ${
                        m.winner_product_id && m.winner_product_id === p?.id ? "bg-mint-soft" : ""
                      }`}
                    >
                      {p ? <ProductLogo src={p.logo_url} name={p.name} size={28} /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p?.name ?? "Bye / empty"}</p>
                        {e?.disqualified_at && <p className="text-[11px] font-bold text-red">Disqualified</p>}
                      </div>
                      <span className="font-mono text-sm font-bold tabular-nums">{votes}</span>
                      {m.status === "open" && p && (
                        <>
                          <ActionButton action={setMatchWinner.bind(null, m.id, p.id)} label="Wins" className={small} />
                          {e && <DqButton entryId={e.id} name={p.name} label="DQ" />}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Badge checks */}
      {badgeQueue.length > 0 && (
        <section id="badge-checks" className="card scroll-mt-24 border-sun! p-5">
          <h2 className="font-display text-2xl font-extrabold">
            Badge checks <span className="text-base text-muted">({badgeQueue.length})</span>
          </h2>
          <p className="text-sm text-muted">
            These owners say our badge is on their site, but the automatic check didn&apos;t find it. Open their page and
            look for a followed link to Backlink Arena (it may only show after the page loads). <strong>Approve</strong>{" "}
            makes them a badge entry (seated right after paid brands). <strong>Reject</strong> keeps them free and emails
            them what to fix.
          </p>
          <ul className="mt-3 divide-y divide-line/40">
            {badgeQueue.map((p) => {
              const page = p.badge_page ?? p.url;
              const e = entryOf.get(p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <ProductLogo src={p.logo_url} name={p.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {emails.get(p.owner_id) ?? "?"} · asked{" "}
                      {dateFmt.format(new Date(p.badge_requested_at ?? p.created_at))}
                      {e && !e.disqualified_at ? ` · in ${active?.name ?? "tournament"} as ${e.entry_path}` : ""}
                    </p>
                  </div>
                  <a
                    href={page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn bg-card px-3! py-1! text-xs underline"
                    title={page}
                  >
                    Open their page ↗
                  </a>
                  <ActionButton action={recheckBadge.bind(null, p.id)} label="Check again" className={small} />
                  <ActionButton
                    action={verifyBadge.bind(null, p.id)}
                    label="Approve"
                    className="btn border-mint! bg-mint-soft text-mint px-3! py-1! text-xs font-semibold"
                  />
                  <ActionButton
                    action={rejectBadge.bind(null, p.id)}
                    label="Reject"
                    confirm={`Reject the badge for ${p.domain}? They stay a free entry and get an email to fix it.`}
                    className="btn bg-red-soft px-3! py-1! text-xs"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Waiting list */}
      {active && preBracket && (
        <section className="card p-5">
          <h2 className="font-display text-2xl font-extrabold">
            Waiting list <span className="text-base text-muted">({waiting.length})</span>
          </h2>
          <p className="text-sm text-muted">Signed up for this tournament but not seated yet. Paid brands are on top (who paid first gets in first), then badge brands.</p>
          {waiting.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nobody waiting.</p>
          ) : (
            <PagedList
              layout="table"
              empty="Nobody in this group."
              tabs={[
                { tag: "pass", label: "Paid" },
                { tag: "badge", label: "Badge" },
                { tag: "free", label: "Free" },
              ]}
              head={
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Brand</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Votes</th>
                    <th className="py-2 pr-3">Signed up</th>
                    <th className="py-2" />
                  </tr>
                </thead>
              }
              items={waiting.map((w, i) => {
                    const p = byId.get(w.productId);
                    const e = entryOf.get(w.productId)!;
                    const owner = p ? (emails.get(p.owner_id) ?? "") : "";
                    return {
                      key: w.entryId,
                      text: `${w.name} ${w.domain} ${owner}`.toLowerCase(),
                      tags: [w.path],
                      node: (
                      <tr className="border-b border-line/40 align-middle">
                        <td className="py-2 pr-3 font-mono text-muted">{i + 1}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <ProductLogo src={w.logo} name={w.name} size={28} />
                            <div className="min-w-0">
                              <Link href={`/admin/products/${w.productId}`} className="block truncate font-semibold hover:underline">
                                {w.name}
                              </Link>
                              <a href={p?.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-muted underline">
                                {w.domain}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs">{p ? (emails.get(p.owner_id) ?? "?") : "?"}</td>
                        <td className="py-2 pr-3">
                          <PathChip path={w.path} />
                          {w.path === "free" && p?.badge_status === "pending" && (
                            <a href="#badge-checks" className="ml-1 rounded-full bg-sun px-2 py-0.5 text-[10px] font-extrabold uppercase">
                              Badge to check
                            </a>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {w.path === "free" ? (
                            <InlineVotes
                              key={`${e.id}:${w.votes}`}
                              label="Qualifying"
                              value={w.votes}
                              real={realQ.get(w.productId) ?? 0}
                              target={{ kind: "entry", id: e.id }}
                            />
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted">{dateFmt.format(new Date(w.created))}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <ActionButton action={placeInNextSeat.bind(null, w.entryId)} label="Seat →" className="btn bg-ink px-3! py-1! text-xs text-white" />
                            {w.path === "free" && p?.badge_status === "pending" && (
                              <ActionButton
                                action={verifyBadge.bind(null, w.productId)}
                                label="Approve badge"
                                className="btn border-mint! bg-mint-soft text-mint px-3! py-1! text-xs font-semibold"
                              />
                            )}
                            {w.path === "free" && (
                              <ActionButton
                                action={markPassPaid.bind(null, w.productId)}
                                label="Mark paid"
                                confirm={`Mark ${w.name} as paid ($29 pass)? Use this for payments made outside the payment provider.`}
                                className="btn border-mint! bg-mint-soft text-mint px-3! py-1! text-xs font-semibold"
                              />
                            )}
                            <DqButton entryId={w.entryId} name={w.name} />
                          </div>
                        </td>
                      </tr>
                      ),
                    };
                  })}
            />
          )}
        </section>
      )}

      {/* Signed up, not entered */}
      {notEntered.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-extrabold">
              Signed up, not entered <span className="text-base text-muted">({notEntered.length})</span>
            </h2>
            {active && preBracket && notEntered.length > 1 && (
              <ActionButton
                action={addAllToTournament.bind(null, active.id)}
                label={`Add all ${notEntered.length} to ${active.name}`}
                className="btn bg-ink text-sm text-white"
              />
            )}
          </div>
          <p className="text-sm text-muted">
            {active
              ? preBracket
                ? `These sites aren't in ${active.name} yet. Add them one by one or all at once.`
                : `These sites aren't in ${active.name}. The bracket has started, so they can join the next tournament.`
              : "No tournament is open. Paid passes join the next one automatically; badge brands enter themselves."}
          </p>
          <PagedList
            defaultTab={newCount > 0 ? "new" : "all"}
            empty="Nobody in this group."
            tabs={[
              { tag: "new", label: newSince ? `New since ${dateFmt.format(new Date(newSince))}` : "New" },
              { tag: "old", label: "Older" },
              { tag: "guaranteed", label: "Paid & badge" },
            ]}
            items={notEntered.map((p) => {
              const owner = emails.get(p.owner_id) ?? "";
              const guaranteed = p.pass_paid || p.badge_status === "verified";
              const isNew = !newSince || p.created_at > newSince;
              return {
                key: p.id,
                text: `${p.name} ${p.domain} ${owner}`.toLowerCase(),
                tags: [isNew ? "new" : "old", ...(guaranteed ? ["guaranteed"] : [])],
                node: (
                  <li className="flex flex-wrap items-center gap-3 py-2">
                    <ProductLogo src={p.logo_url} name={p.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {p.domain} · {owner || "?"} · {dateFmt.format(new Date(p.created_at))}
                      </p>
                    </div>
                    {isNew && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-extrabold uppercase">New</span>}
                    {p.pass_paid ? <PathChip path="pass" /> : p.badge_status === "verified" ? <PathChip path="badge" /> : null}
                    {active && preBracket && (
                      <ActionButton action={addToTournament.bind(null, p.id, active.id)} label={`Add to ${active.name}`} className={small} />
                    )}
                  </li>
                ),
              };
            })}
          />
        </section>
      )}

      {/* Disqualified */}
      {disqualified.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-2xl font-extrabold">
            Disqualified <span className="text-base text-muted">({disqualified.length})</span>
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-line/40">
            {disqualified.map((e) => {
              const p = byId.get(e.product_id);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="font-semibold">{p?.name ?? "?"}</span>
                  <span className="text-muted">{p?.domain}</span>
                  <span className="flex-1 text-xs text-muted">
                    {e.dq_reason ? `“${e.dq_reason}”` : "No reason given"} ·{" "}
                    {e.disqualified_at && dateFmt.format(new Date(e.disqualified_at))}
                  </span>
                  {preBracket && <ActionButton action={reinstateEntry.bind(null, e.id)} label="Reinstate" className={small} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
                    <span className="font-bold">
                      {w ? `${w.name} (${w.domain}, ${emails.get(w.owner_id) ?? "?"})` : "none (stopped)"}
                    </span>
                    {t.prize_delivered_at && " · ✓ delivered"}
                  </p>
                  {w && <PrizeForm tournamentId={t.id} current={t.prize_url} />}
                  <a href={`/admin/export?tournament=${t.id}`} className="text-sm font-semibold underline">
                    Export losers CSV
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* All sites */}
      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="font-display text-2xl font-extrabold">
            All sites <span className="text-base text-muted">({products.length}, {pendingBadges} badge checks pending)</span>
          </span>
          <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-220 text-left text-sm">
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
                    <td className="py-2 pr-3">
                      {e ? (e.disqualified_at ? "disqualified" : e.seat ? `seat ${e.seat}` : e.entry_path) : "-"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={p.badge_status === "pending" ? "rounded bg-sun px-1 font-bold" : ""}>
                        {p.badge_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{p.pass_paid ? "paid" : "-"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/admin/products/${p.id}`} className="btn bg-ink px-3! py-1! text-xs text-white">
                          Edit
                        </Link>
                        {(p.badge_status !== "verified" || e?.entry_path === "free") && (
                          <ActionButton action={verifyBadge.bind(null, p.id)} label="Verify badge" />
                        )}
                        {p.badge_status !== "none" && <ActionButton action={rejectBadge.bind(null, p.id)} label="Reset badge" />}
                        {(!p.pass_paid || e?.entry_path === "free") && (
                          <ActionButton action={markPassPaid.bind(null, p.id)} label="Mark pass paid" />
                        )}
                        <ActionButton
                          action={deleteProductAdmin.bind(null, p.id, true)}
                          label="Remove"
                          confirm={
                            matchOf.has(p.id)
                              ? `${p.domain} is in the bracket. Removing it empties its match slots (the opponent gets a bye) and deletes its entries and votes. Continue?`
                              : `Remove ${p.domain}? This deletes its entries and votes.`
                          }
                          className="btn bg-red-soft px-3! py-1! text-xs"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="font-display text-2xl font-extrabold">Anti-cheat</span>
          <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4">
          <VoteRemovalForms />
        </div>
      </details>
    </div>
  );
}
