import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Entry, Product, Tournament } from "@/lib/types";
import { AdminNav } from "../../AdminNav";
import { AddEntryForm, DeleteProductForm, EntryRow, LogoUploadForm, ProductEditForm } from "../../CrmForms";

export const metadata: Metadata = { title: "Admin · Edit site", robots: { index: false } };

export default function AdminProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <ProductAdmin params={params} />
      </Suspense>
    </div>
  );
}

async function ProductAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createSupabaseAdmin();
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const product = data as Product;

  const [{ data: owner }, { data: entryRows }, { data: tRows }, { data: qv }] = await Promise.all([
    db.from("profiles").select("email").eq("id", product.owner_id).maybeSingle(),
    db.from("entries").select("*").eq("product_id", id),
    db.from("tournaments").select("*").order("created_at", { ascending: false }),
    db.from("qualifying_votes").select("tournament_id").eq("product_id", id),
  ]);
  const entries = (entryRows ?? []) as Entry[];
  const tournaments = (tRows ?? []) as Tournament[];
  const tOptions = tournaments.map((t) => ({ id: t.id, label: `${t.name} (${t.status})` }));
  const tName = new Map(tournaments.map((t) => [t.id, t]));
  const realVotes = new Map<string, number>();
  for (const r of qv ?? []) realVotes.set(r.tournament_id as string, (realVotes.get(r.tournament_id as string) ?? 0) + 1);
  const notIn = tOptions.filter((t) => !entries.some((e) => e.tournament_id === t.id));

  return (
    <>
      <AdminNav current="/admin/products" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-4xl font-extrabold">{product.name}</h1>
        <div className="flex gap-3 text-sm font-semibold">
          <Link href={`/p/${product.slug}`} className="underline" target="_blank">
            Public page ↗
          </Link>
          <a href={product.url} className="underline" target="_blank" rel="noopener noreferrer">
            {product.domain} ↗
          </a>
        </div>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Logo</h2>
        <p className="mt-1 text-sm text-muted">Upload a file here, or paste a URL in the form below.</p>
        <div className="mt-3">
          <LogoUploadForm
            key={product.logo_url ?? "none"}
            productId={product.id}
            current={product.logo_url}
            name={product.name}
          />
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Details</h2>
        <div className="mt-3">
          <ProductEditForm
            key={JSON.stringify(product)}
            product={product}
            ownerEmail={(owner?.email as string | null) ?? ""}
          />
        </div>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Tournaments</h2>
        <p className="mt-1 text-sm text-muted">
          Change the tournament to move this site to another one. “Out in round” empty = still in; 0 = didn’t
          qualify. Qualifying votes is the number shown publicly.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Tournament</th>
                <th className="py-2 pr-3">Entry</th>
                <th className="py-2 pr-3">Qualified</th>
                <th className="py-2 pr-3">Out in round</th>
                <th className="py-2 pr-3">Qualifying votes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <EntryRow
                  key={JSON.stringify(e)}
                  entry={e}
                  realVotes={realVotes.get(e.tournament_id) ?? 0}
                  tournaments={tOptions}
                  heading={
                    <Link href={`/admin/tournaments/${e.tournament_id}`} className="underline">
                      {tName.get(e.tournament_id)?.status ?? "?"}
                    </Link>
                  }
                />
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-muted">
                    Not in any tournament.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {notIn.length > 0 && (
          <div className="mt-4">
            <AddEntryForm productId={product.id} tournaments={notIn} />
          </div>
        )}
      </section>

      <section className="card mt-6 border-red/40 p-5">
        <h2 className="font-display text-xl font-extrabold">Danger zone</h2>
        <div className="mt-3">
          <DeleteProductForm productId={product.id} domain={product.domain} />
        </div>
      </section>
    </>
  );
}
