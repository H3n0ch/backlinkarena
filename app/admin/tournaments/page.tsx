import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Tournament } from "@/lib/types";
import { CreateTournamentForm } from "../AdminForms";
import { AdminNav } from "../AdminNav";

export const metadata: Metadata = { title: "Admin · Tournaments", robots: { index: false } };

export default function AdminTournamentsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Tournaments />
      </Suspense>
    </div>
  );
}

async function Tournaments() {
  await requireAdmin();
  const db = createSupabaseAdmin();
  const [{ data }, { data: entries }] = await Promise.all([
    db.from("tournaments").select("*").order("created_at", { ascending: false }),
    db.from("entries").select("tournament_id"),
  ]);
  const ts = (data ?? []) as Tournament[];
  const counts = new Map<string, number>();
  for (const e of entries ?? []) counts.set(e.tournament_id as string, (counts.get(e.tournament_id as string) ?? 0) + 1);
  const hasActive = ts.some((t) => t.status !== "finished");

  return (
    <>
      <AdminNav current="/admin/tournaments" />
      <h1 className="font-display text-4xl font-extrabold">Tournaments</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {ts.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/tournaments/${t.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-cream">
              <span className="font-bold">{t.name}</span>
              <span className="text-sm text-muted">
                <span className="rounded-full bg-sun px-2 font-bold text-ink">{t.status}</span> · {counts.get(t.id) ?? 0} entries ·
                bracket {t.bracket_size} · created {new Date(t.created_at).toLocaleDateString("en-GB")}
              </span>
            </Link>
          </li>
        ))}
        {ts.length === 0 && <li className="text-muted">No tournaments yet.</li>}
      </ul>
      {!hasActive && (
        <section className="card mt-6 p-5">
          <h2 className="font-display text-xl font-extrabold">New tournament</h2>
          <div className="mt-3">
            <CreateTournamentForm />
          </div>
        </section>
      )}
    </>
  );
}
