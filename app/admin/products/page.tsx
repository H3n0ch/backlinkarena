import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";
import { AdminNav } from "../AdminNav";
import { CreateProductForm } from "../CrmForms";

export const metadata: Metadata = { title: "Admin · Sites", robots: { index: false } };

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Products({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const db = createSupabaseAdmin();
  const [{ data: rows }, { data: profiles }] = await Promise.all([
    db.from("products").select("*").order("created_at", { ascending: false }),
    db.from("profiles").select("id, email"),
  ]);
  const emails = new Map((profiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? ""]));
  const all = (rows ?? []) as Product[];
  const products = q
    ? all.filter((p) =>
        [p.name, p.domain, p.category ?? "", emails.get(p.owner_id) ?? ""].some((s) => s.toLowerCase().includes(q)),
      )
    : all;

  return (
    <>
      <AdminNav current="/admin/products" />
      <h1 className="font-display text-4xl font-extrabold">Sites ({all.length})</h1>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Add a site manually</h2>
        <div className="mt-3">
          <CreateProductForm />
        </div>
      </section>

      <section className="card mt-6 p-5">
        <form className="flex gap-2" action="/admin/products">
          <input name="q" defaultValue={q} className="field" placeholder="Search name, domain, category or owner email" />
          <button className="btn bg-card text-sm">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Badge</th>
                <th className="py-2 pr-3">Pass</th>
                <th className="py-2 pr-3">Added</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line/10">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <ProductLogo src={p.logo_url} name={p.name} size={36} />
                      <span>
                        <span className="block font-semibold">{p.name}</span>
                        <span className="block text-xs text-muted">{p.domain}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-2 pr-3 break-all">{emails.get(p.owner_id) || "?"}</td>
                  <td className="py-2 pr-3">{p.badge_status}</td>
                  <td className="py-2 pr-3">{p.pass_paid ? "paid" : "-"}</td>
                  <td className="py-2 pr-3">{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
                  <td className="py-2">
                    <Link href={`/admin/products/${p.id}`} className="btn bg-ink text-white text-xs py-1! px-3!">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">
                    No sites found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
