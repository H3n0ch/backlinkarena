import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminNav } from "../AdminNav";
import { UserRow } from "../CrmForms";

export const metadata: Metadata = { title: "Admin · Users", robots: { index: false } };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Profile = { id: string; email: string | null; full_name: string | null; is_admin: boolean; created_at: string };

async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const db = createSupabaseAdmin();
  const [{ data: profiles }, { data: products }, { data: votes }, { data: qvotes }] = await Promise.all([
    db.from("profiles").select("id, email, full_name, is_admin, created_at").order("created_at", { ascending: false }),
    db.from("products").select("id, name, owner_id"),
    db.from("votes").select("voter_id"),
    db.from("qualifying_votes").select("voter_id"),
  ]);
  const voteCount = new Map<string, number>();
  for (const v of [...(votes ?? []), ...(qvotes ?? [])]) {
    voteCount.set(v.voter_id as string, (voteCount.get(v.voter_id as string) ?? 0) + 1);
  }
  const owned = new Map<string, { id: string; name: string }[]>();
  for (const p of products ?? []) {
    const list = owned.get(p.owner_id as string) ?? [];
    list.push({ id: p.id as string, name: p.name as string });
    owned.set(p.owner_id as string, list);
  }
  const all = (profiles ?? []) as Profile[];
  const users = q
    ? all.filter((u) => `${u.email ?? ""} ${u.full_name ?? ""}`.toLowerCase().includes(q))
    : all;

  return (
    <>
      <AdminNav current="/admin/users" />
      <h1 className="font-display text-4xl font-extrabold">Users ({all.length})</h1>
      <p className="mt-2 text-sm text-muted">
        To move a site to another user, open the site and change its owner email.
      </p>
      <section className="card mt-6 p-5">
        <form className="flex gap-2" action="/admin/users">
          <input name="q" defaultValue={q} className="field" placeholder="Search email or name" />
          <button className="btn bg-card text-sm">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Admin</th>
                <th className="py-2 pr-3">Sites</th>
                <th className="py-2 pr-3 text-right">Votes cast</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={`${u.id}:${u.full_name}:${u.is_admin}:${voteCount.get(u.id) ?? 0}`}
                  id={u.id}
                  email={u.email}
                  fullName={u.full_name}
                  isAdmin={u.is_admin}
                  votes={voteCount.get(u.id) ?? 0}
                  products={(owned.get(u.id) ?? []).map((p) => (
                    <Link key={p.id} href={`/admin/products/${p.id}`} className="block underline">
                      {p.name}
                    </Link>
                  ))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
