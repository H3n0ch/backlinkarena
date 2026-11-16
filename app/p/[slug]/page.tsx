import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { TrackedLink } from "@/components/Track";
import { getProductBySlug, getProductHistory } from "@/lib/data";
import { roundName } from "@/lib/time";
import { safeHttpUrl } from "@/lib/url";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found" };
  return { title: p.name, description: p.description ?? `${p.name} on Backlink Arena` };
}

export default function ProductPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const history = await getProductHistory(product.id);
  const href = safeHttpUrl(product.url);

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <ProductLogo src={product.logo_url} name={product.name} size={72} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-extrabold leading-tight">{product.name}</h1>
            <p className="text-muted">{product.domain}</p>
          </div>
        </div>
        {product.description && <p className="mt-4 text-lg">{product.description}</p>}
        {product.category && (
          <span className="mt-3 inline-block rounded-full border border-line bg-blue-soft px-3 py-0.5 text-sm font-semibold">
            {product.category}
          </span>
        )}
        {href && (
          <div className="mt-5">
            {/* Intentionally dofollow: this link is part of what participants play for. */}
            <TrackedLink href={href} productId={product.id} className="btn bg-card">
              Visit {product.domain} ↗
            </TrackedLink>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-display text-2xl font-extrabold">Tournament history</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-muted">No tournaments yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {history.map(({ tournament, entry, matches }) => {
            const won = tournament.winner_product_id === product.id;
            const status = won
              ? "🏆 Winner"
              : entry.eliminated_round === 0
                ? "Didn't qualify"
                : entry.eliminated_round
                  ? `Out in ${roundName(entry.eliminated_round, tournament.bracket_size)}`
                  : tournament.status === "qualifying" || tournament.status === "draft"
                    ? "Qualifying"
                    : tournament.status === "bracket"
                      ? "Still in"
                      : "Played";
            return (
              <li key={entry.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{tournament.name}</p>
                  <span className="rounded-full bg-sun px-3 py-0.5 text-sm font-bold">{status}</span>
                </div>
                {matches.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <Link href={`/match/${m.id}`} className="underline decoration-2 underline-offset-2">
                          {roundName(m.round, tournament.bracket_size)}
                          {m.status === "closed" && (m.winner_product_id === product.id ? " ✓" : " ✗")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
