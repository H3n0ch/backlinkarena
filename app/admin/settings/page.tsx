import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminNav } from "../AdminNav";
import { HomepageStatsForm } from "../CrmForms";

export const metadata: Metadata = { title: "Admin · Homepage numbers", robots: { index: false } };

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireAdmin();
  const db = createSupabaseAdmin();
  const [{ data: stats }, { data: settings, error }] = await Promise.all([
    db.rpc("arena_stats"),
    db.from("site_settings").select("*").maybeSingle(),
  ]);
  const row = (stats as { sites: number; votes: number; backlinks_won: number }[] | null)?.[0];
  const shown = { sites: row?.sites ?? 0, votes: row?.votes ?? 0, backlinks: row?.backlinks_won ?? 0 };

  return (
    <>
      <AdminNav current="/admin/settings" />
      <h1 className="font-display text-4xl font-extrabold">Homepage numbers</h1>
      {error && (
        <p className="mt-4 rounded-xl border border-line bg-red-soft p-3 text-sm font-semibold">
          Run <code>supabase/migrations/0005_admin_crm.sql</code> in the Supabase SQL editor first.
        </p>
      )}
      <section className="card mt-6 p-5">
        <p className="text-sm text-muted">
          These are the totals shown in the homepage stats strip. Type the numbers you want displayed. Real activity
          keeps counting up from there.
        </p>
        {settings && (
          <p className="mt-2 text-xs text-muted">
            Current offsets: sites {settings.sites_offset >= 0 ? "+" : ""}
            {settings.sites_offset}, votes {settings.votes_offset >= 0 ? "+" : ""}
            {settings.votes_offset}, backlinks {settings.backlinks_offset >= 0 ? "+" : ""}
            {settings.backlinks_offset}
          </p>
        )}
        <div className="mt-4">
          <HomepageStatsForm key={JSON.stringify(shown)} shown={shown} />
        </div>
      </section>
    </>
  );
}
