import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import type { SponsorStatus } from "@/lib/sponsor-offer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { safeHttpUrl } from "@/lib/url";
import { AdminNav } from "../AdminNav";
import { SponsorControls } from "../SponsorControls";
import { SponsorPreview } from "../SponsorPreview";

export const metadata: Metadata = { title: "Admin · Sponsors", robots: { index: false } };

export default function AdminSponsorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Sponsors />
      </Suspense>
    </div>
  );
}

type Row = {
  id: string;
  created_at: string;
  status: SponsorStatus;
  brand_name: string;
  website: string;
  tagline: string;
  logo_url: string | null;
  email: string;
  tournament_id: string | null;
  provider: string | null;
  payment_ref: string | null;
  amount_total: number | null;
  currency: string | null;
  paid_at: string | null;
  clicks: number;
};

const dt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_STYLE: Record<SponsorStatus, string> = {
  pending_payment: "bg-cream text-muted",
  paid: "bg-sun/40",
  approved: "bg-mint/30",
  paused: "bg-blue-soft",
  rejected: "bg-red-soft",
  refunded: "bg-red-soft",
};

/** Paid ones waiting for review first, then live ones, then the rest. */
const ORDER: SponsorStatus[] = ["paid", "approved", "paused", "rejected", "refunded", "pending_payment"];

async function Sponsors() {
  await requireAdmin();
  const db = createSupabaseAdmin();
  const [{ data: rows, error }, { data: tRows }] = await Promise.all([
    db.from("sponsorships").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("tournaments").select("id, name, status").neq("status", "finished").order("created_at", { ascending: true }),
  ]);
  const sponsors = ((rows ?? []) as Row[]).sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at),
  );
  const assigned = [...new Set(sponsors.map((s) => s.tournament_id).filter((id): id is string => Boolean(id)))];
  const { data: allT } = assigned.length
    ? await db.from("tournaments").select("id, name").in("id", assigned)
    : { data: [] };
  const tName = new Map(((allT ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const taken = new Set(sponsors.filter((s) => s.status === "approved" || s.status === "paused").map((s) => s.tournament_id));
  const open = ((tRows ?? []) as { id: string; name: string }[]).filter((t) => !taken.has(t.id));
  const waiting = sponsors.filter((s) => s.status === "paid").length;
  const revenue = sponsors
    .filter((s) => ["paid", "approved", "paused"].includes(s.status))
    .reduce((sum, s) => sum + (s.amount_total ?? 0), 0);

  return (
    <>
      <AdminNav current="/admin/sponsors" />
      <h1 className="font-display text-4xl font-extrabold">Sponsors</h1>
      <p className="text-sm text-muted">
        Paid on /sponsor. Approve one per tournament: it shows on /arena and every match page of that tournament. To
        reject, click Reject and refund the payment in the payment dashboard (the refund webhook marks it refunded).
      </p>
      {error && (
        <p className="mt-3 rounded-2xl border border-line bg-red-soft p-3 text-sm font-semibold">
          Run migration <code>0020_sponsorships.sql</code> in Supabase to start selling sponsorships.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Waiting for review</p>
          <p className="font-display text-3xl font-extrabold">{waiting}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Open slots</p>
          <p className="font-display text-3xl font-extrabold">{open.length}</p>
          <p className="text-xs text-muted">{open.map((t) => t.name).join(", ") || "Create a tournament to open one"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Paid (not refunded)</p>
          <p className="font-display text-3xl font-extrabold">${(revenue / 100).toLocaleString("en-US")}</p>
        </div>
      </div>

      <SponsorPreview tournaments={open} />

      <section className="card mt-6 p-5">
        {sponsors.length === 0 ? (
          <p className="text-sm text-muted">No sponsors yet. Share /sponsor with brands that sell to founders.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sponsor</th>
                  <th className="py-2 pr-3">Pitch</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Tournament</th>
                  <th className="py-2 pr-3 text-right">Clicks</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s) => {
                  const logo = safeHttpUrl(s.logo_url);
                  return (
                    <tr key={s.id} className="border-b border-line align-top">
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[s.status]}`}>
                          {s.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-start gap-2">
                          {logo && (
                            <img src={logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg border border-line object-cover" />
                          )}
                          <div>
                            <p className="font-semibold">{s.brand_name}</p>
                            <a href={safeHttpUrl(s.website) ?? "#"} target="_blank" rel="noopener noreferrer" className="block text-xs underline">
                              {s.website.replace(/^https?:\/\//, "")}
                            </a>
                            <a href={`mailto:${s.email}`} className="block text-xs text-muted underline">
                              {s.email}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-xs py-2 pr-3">{s.tagline}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted">
                        {s.paid_at ? dt.format(new Date(s.paid_at)) : "–"}
                        {s.amount_total != null && (
                          <span className="block text-xs">
                            {(s.amount_total / 100).toFixed(2)} {s.currency?.toUpperCase()} · {s.provider}
                          </span>
                        )}
                        {s.payment_ref && <span className="block font-mono text-[10px]">{s.payment_ref}</span>}
                      </td>
                      <td className="py-2 pr-3">{s.tournament_id ? (tName.get(s.tournament_id) ?? "–") : "–"}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{s.clicks}</td>
                      <td className="py-2">
                        <SponsorControls id={s.id} status={s.status} tournaments={open} />
                      </td>
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
