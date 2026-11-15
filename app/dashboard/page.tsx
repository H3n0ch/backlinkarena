import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { ProductLogo } from "@/components/ProductLogo";
import { ShareButtons } from "@/components/ShareButtons";
import { requireUser } from "@/lib/auth";
import { getCurrentOrLastTournament, getProductsByIds, PRODUCT_PUBLIC_COLUMNS } from "@/lib/data";
import { PASS_PAYMENT_URL, SITE_URL } from "@/lib/env";
import { matchPath, matchShareUrl } from "@/lib/share";
import { createSupabaseServer } from "@/lib/supabase/server";
import { roundName } from "@/lib/time";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { BadgeCard } from "./BadgeCard";
import { EnterButton } from "./DashboardButtons";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Status = { label: string; tone: "sun" | "mint" | "red" | "blue" | "muted" };

function statusFor(t: Tournament | null, entry: Entry | undefined, productId: string): Status {
  if (!t || !entry) return { label: "Not entered", tone: "muted" };
  if (t.status === "draft" || t.status === "qualifying") {
    return entry.entry_path === "free"
      ? { label: "Qualifying", tone: "sun" }
      : { label: "Seeded: skips qualifying", tone: "blue" };
  }
  if (t.winner_product_id === productId) return { label: "🏆 Winner", tone: "mint" };
  if (entry.eliminated_round === 0) return { label: "Didn't qualify", tone: "red" };
  if (entry.eliminated_round) {
    return { label: `Out (${roundName(entry.eliminated_round, t.bracket_size)})`, tone: "red" };
  }
  return t.status === "bracket" ? { label: "In the bracket", tone: "mint" } : { label: "Played", tone: "muted" };
}

const TONE: Record<Status["tone"], string> = {
  sun: "bg-sun",
  mint: "bg-mint-soft",
  red: "bg-red-soft",
  blue: "bg-blue-soft",
  muted: "bg-paper",
};

async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const joined = (await searchParams).joined;
  const user = await requireUser("/dashboard");
  const supabase = await createSupabaseServer();
  const [{ data: productRows }, tournament] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .eq("owner_id", user.id)
      .order("created_at"),
    getCurrentOrLastTournament(),
  ]);
  const products = (productRows ?? []) as Product[];
  const ids = products.map((p) => p.id);

  let entries: Entry[] = [];
  let matches: Match[] = [];
  if (tournament && ids.length) {
    const [e, m] = await Promise.all([
      supabase.from("entries").select("*").eq("tournament_id", tournament.id).in("product_id", ids),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .or(`product_a.in.(${ids.join(",")}),product_b.in.(${ids.join(",")})`)
        .order("round", { ascending: false }),
    ]);
    entries = (e.data ?? []) as Entry[];
    matches = (m.data ?? []) as Match[];
  }
  // Opponents' slugs for readable matchup links (/vs/a-vs-b).
  const matchProducts = await getProductsByIds(matches.flatMap((m) => [m.product_a, m.product_b]));
  const pathOf = (m: Match) =>
    matchPath(
      m,
      m.product_a ? matchProducts.get(m.product_a)?.slug : null,
      m.product_b ? matchProducts.get(m.product_b)?.slug : null,
    );
  const canEnter = tournament?.status === "draft" || tournament?.status === "qualifying";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Your corner</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="text-sm font-semibold underline">Log out</button>
        </form>
      </div>

      {joined && (
        <p className="mt-4 rounded-2xl border border-line bg-mint-soft p-3 font-semibold">
          You&apos;re in! Share your page to collect votes.
        </p>
      )}

      {products.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <p className="text-lg font-bold">No website entered yet.</p>
          <Link href="/join" className="btn mt-4 bg-red text-white">
            Join with your website
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {products.map((p) => {
            const entry = entries.find((e) => e.product_id === p.id);
            const status = statusFor(tournament, entry, p.id);
            const current = matches.find(
              (m) => m.product_a === p.id || m.product_b === p.id,
            );
            const shareLink = current
              ? matchShareUrl(pathOf(current), p.slug)
              : `${SITE_URL}/arena?ref=${p.slug}`;
            return (
              <section key={p.id} className="card p-5">
                <div className="flex items-center gap-4">
                  <ProductLogo src={p.logo_url} name={p.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${p.slug}`} className="font-display text-xl font-extrabold hover:underline">
                      {p.name}
                    </Link>
                    <p className="truncate text-sm text-muted">{p.domain}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border border-line px-3 py-1 text-sm font-bold ${TONE[status.tone]}`}>
                    {status.label}
                  </span>
                </div>

                {tournament && (
                  <p className="mt-3 text-sm text-muted">
                    Tournament: <span className="font-semibold text-ink">{tournament.name}</span>
                  </p>
                )}

                {!entry && canEnter && (
                  <div className="mt-4">
                    <EnterButton productId={p.id} />
                  </div>
                )}

                {current && (
                  <Link href={`${pathOf(current)}?ref=${p.slug}`} className="btn mt-4 w-full bg-red text-white">
                    {current.status === "open" ? "Go to your matchup →" : "See your last matchup →"}
                  </Link>
                )}

                <div className="mt-5">
                  <ShareButtons
                    link={shareLink}
                    title={current ? "Rally votes for your matchup" : "Share your entry"}
                  />
                </div>

                <BadgeCard siteUrl={SITE_URL} slug={p.slug} productId={p.id} domain={p.domain} badgeStatus={p.badge_status} />

                {canEnter && entry?.entry_path === "free" && (
                  <div className="mt-4 rounded-2xl border border-line bg-sun/30 p-4">
                    <p className="font-display text-lg font-extrabold">No badge? Get the Contender Pass</p>
                    <p className="mt-1 text-sm">
                      $79 one-time. Skips qualifying, no badge needed. It never adds votes inside a match.
                    </p>
                    <p className="mt-2 text-xs text-muted">Pay with {user.email} so we can match it.</p>
                    {PASS_PAYMENT_URL ? (
                      <a href={PASS_PAYMENT_URL} target="_blank" rel="noopener noreferrer" className="btn mt-3 bg-ink text-white">
                        Get the Contender Pass
                      </a>
                    ) : (
                      <p className="mt-3 text-sm font-semibold">Coming soon.</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          <Link href="/join" className="text-center text-sm font-semibold underline">
            + Add another website
          </Link>
        </div>
      )}
    </>
  );
}
