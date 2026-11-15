import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductLogo } from "@/components/ProductLogo";
import { getWinners } from "@/lib/data";

export const metadata: Metadata = {
  title: "Winners",
  description: "Past Backlink Arena champions and the backlinks they won.",
};

export default function WinnersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">Hall of champions</h1>
      <p className="mt-2 text-muted">Every winner gets a backlink on a real DA 50+ site in their niche.</p>
      <Suspense fallback={<div className="card mt-6 h-40" />}>
        <WinnerList />
      </Suspense>
    </div>
  );
}

async function WinnerList() {
  const winners = await getWinners();
  if (!winners.length) {
    return <p className="card mt-6 p-6 text-center font-semibold">The first champion is still to be crowned.</p>;
  }
  return (
    <ul className="mt-6 flex flex-col gap-4">
      {winners.map(({ tournament, product }) => (
        <li key={tournament.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          {product && <ProductLogo src={product.logo_url} name={product.name} size={64} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-muted">{tournament.name}</p>
            {product ? (
              <Link href={`/p/${product.slug}`} className="font-display text-2xl font-extrabold hover:underline">
                🏆 {product.name}
              </Link>
            ) : (
              <p className="font-display text-2xl font-extrabold">Winner removed</p>
            )}
          </div>
          {tournament.prize_url ? (
            <a href={tournament.prize_url} target="_blank" rel="noopener noreferrer" className="btn bg-mint-soft text-sm">
              ✓ Backlink placed ↗
            </a>
          ) : (
            <span className="rounded-full border-2 border-dashed border-line/40 px-3 py-1 text-sm font-semibold">
              Backlink being placed
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
