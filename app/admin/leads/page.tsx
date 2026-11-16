import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { OFFER_DAYS } from "@/lib/services";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { roundName } from "@/lib/time";
import type { Entry, Match, Tournament } from "@/lib/types";
import { AdminNav } from "../AdminNav";
import { LeadStatus } from "../LeadStatus";

export const metadata: Metadata = { title: "Admin · Leads", robots: { index: false } };

export default function AdminLeadsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Leads />
      </Suspense>
    </div>
  );
}

type Lead = {
  id: string;
  created_at: string;
  source: "services" | "participant_offer";
  service: string;
  tier: string | null;
  name: string | null;
  email: string;
  website: string | null;
  message: string | null;
  discount: number;
  status: "new" | "contacted" | "won" | "lost";
};

const dt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
/** Request-time check; admin pages are dynamic. */
function isLive(expires: Date) {
  return expires.getTime() > Date.now();
}

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

async function Leads() {
  await requireAdmin();
  const db = createSupabaseAdmin();

  const [{ data: leadRows, error: leadsError }, { data: tRows }] = await Promise.all([
    db.from("leads").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("tournaments").select("*").order("created_at", { ascending: false }).limit(3),
  ]);
  const leads = (leadRows ?? []) as Lead[];
  const tournaments = (tRows ?? []) as Tournament[];

  // Participants whose run is over in the latest tournaments = warm leads for the 30% offer.
  const tIds = tournaments.map((t) => t.id);
  const [{ data: eRows }, { data: mRows }] = tIds.length
    ? await Promise.all([
        db.from("entries").select("*, products(id, name, domain, slug, owner_id)").in("tournament_id", tIds),
        db.from("matches").select("*").in("tournament_id", tIds),
      ])
    : [{ data: [] }, { data: [] }];
  const matches = (mRows ?? []) as Match[];
  type Row = Entry & { products: { id: string; name: string; domain: string; slug: string; owner_id: string } | null };
  const done = ((eRows ?? []) as Row[]).filter((e) => {
    const t = tournaments.find((x) => x.id === e.tournament_id);
    return e.products && t && (e.eliminated_round !== null || t.status === "finished");
  });

  const productIds = done.map((e) => e.product_id);
  const ownerIds = [...new Set(done.map((e) => e.products!.owner_id))];
  const [{ data: exp }, { data: owners }] = await Promise.all([
    productIds.length ? db.rpc("product_exposure", { p_ids: productIds }) : Promise.resolve({ data: [] }),
    ownerIds.length ? db.from("profiles").select("id, email").in("id", ownerIds) : Promise.resolve({ data: [] }),
  ]);
  const stats = new Map(
    ((exp ?? []) as { product_id: string; views: number; clicks: number; votes: number }[]).map((r) => [r.product_id, r]),
  );
  const emailOf = new Map(((owners ?? []) as { id: string; email: string | null }[]).map((o) => [o.id, o.email]));
  const asked = new Set(leads.map((l) => l.email.toLowerCase()));

  const participants = done
    .map((e) => {
      const t = tournaments.find((x) => x.id === e.tournament_id)!;
      const last = matches
        .filter((m) => m.tournament_id === t.id && (m.product_a === e.product_id || m.product_b === e.product_id))
        .sort((a, b) => b.round - a.round)[0];
      const ended = new Date(last?.ends_at ?? t.qualifying_ends_at ?? t.created_at);
      const expires = new Date(ended.getTime() + OFFER_DAYS * 86400_000);
      const reached =
        t.winner_product_id === e.product_id
          ? "🏆 Winner"
          : e.eliminated_round === 0
            ? "Didn't qualify"
            : e.eliminated_round
              ? `Out in ${roundName(e.eliminated_round, t.bracket_size)}`
              : "Played";
      const email = emailOf.get(e.products!.owner_id) ?? null;
      return { e, t, expires, reached, email, s: stats.get(e.product_id) };
    })
    .sort((a, b) => b.expires.getTime() - a.expires.getTime());

  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <>
      <AdminNav current="/admin/leads" />
      <h1 className="font-display text-4xl font-extrabold">Leads</h1>
      {leadsError && (
        <p className="mt-3 rounded-2xl border border-line bg-red-soft p-3 text-sm font-semibold">
          Run migration <code>0008_exposure_leads.sql</code> in Supabase to start collecting leads.
        </p>
      )}

      <section className="card mt-6 p-5">
        <h2 className="font-display text-2xl font-extrabold">
          Enquiries ({leads.length}
          {newCount ? `, ${newCount} new` : ""})
        </h2>
        <p className="text-sm text-muted">From &quot;Talk to us&quot; on the homepage and the participant offer in dashboards.</p>
        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No enquiries yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Website</th>
                  <th className="py-2 pr-3">Interested in</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">{dt.format(new Date(l.created_at))}</td>
                    <td className="py-2 pr-3">
                      <a href={`mailto:${l.email}`} className="font-semibold underline">
                        {l.email}
                      </a>
                      {l.name && <span className="block text-xs text-muted">{l.name}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {l.website ? (
                        <a href={l.website} target="_blank" rel="noopener noreferrer" className="underline">
                          {l.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {l.service}
                      {l.tier && <span className="block text-xs text-muted">{l.tier}</span>}
                      {l.source === "participant_offer" && (
                        <span className="mt-1 inline-block rounded-full bg-sun/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                          Participant · {Math.round(Number(l.discount) * 100)}% off
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs py-2 pr-3 whitespace-pre-wrap">{l.message ?? <span className="text-muted">–</span>}</td>
                    <td className="py-2">
                      <LeadStatus id={l.id} status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-2xl font-extrabold">Participants to follow up ({participants.length})</h2>
        <p className="text-sm text-muted">
          Sites whose run is over in the last tournaments. They see a {OFFER_DAYS}-day 30% offer in their dashboard.
        </p>
        {participants.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nobody yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Site</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2 pr-3 text-right">Views</th>
                  <th className="py-2 pr-3 text-right">Votes</th>
                  <th className="py-2 pr-3 text-right">Clicks</th>
                  <th className="py-2 pr-3">Offer</th>
                  <th className="py-2">Enquired</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(({ e, t, expires, reached, email, s }) => {
                  const live = isLive(expires);
                  return (
                    <tr key={e.id} className="border-b border-line">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/products/${e.product_id}`} className="font-semibold underline">
                          {e.products!.name}
                        </Link>
                        <span className="block text-xs text-muted">{e.products!.domain}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {email ? (
                          <a href={`mailto:${email}`} className="underline">
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {reached}
                        <span className="block text-xs text-muted">{t.name}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{Number(s?.views ?? 0)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{Number(s?.votes ?? 0)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{Number(s?.clicks ?? 0)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {live ? `until ${day.format(expires)}` : <span className="text-muted">expired</span>}
                      </td>
                      <td className="py-2">{email && asked.has(email.toLowerCase()) ? "✓" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
