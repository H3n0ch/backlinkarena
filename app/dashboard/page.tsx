import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { LeadButton } from "@/components/LeadButton";
import { ProductLogo } from "@/components/ProductLogo";
import { MatchCarousel } from "@/components/MatchCarousel";
import { RallyKit } from "@/components/RallyKit";
import { ShareButtons } from "@/components/ShareButtons";
import { requireUser } from "@/lib/auth";
import { getCurrentOrLastTournament, getProductsByIds, PRODUCT_PUBLIC_COLUMNS } from "@/lib/data";
import { startPassCheckout } from "@/app/actions/pass";
import { PUBLIC_SITE_URL, SITE_URL } from "@/lib/env";
import { hasFixedPrice, OFFER_DAYS, PARTICIPANT_DISCOUNT, participantPrice, SERVICES } from "@/lib/services";
import { PAYMENTS_CONFIGURED } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { matchPath, matchShareUrl } from "@/lib/share";
import { createSupabaseServer } from "@/lib/supabase/server";
import { roundName } from "@/lib/time";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { BadgeCard } from "./BadgeCard";
import { EnterButton } from "./DashboardButtons";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="card h-64" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Status = { label: string; tone: "sun" | "mint" | "red" | "blue" | "muted" };

function statusFor(t: Tournament | null, entry: Entry | undefined, productId: string): Status {
  if (!t || !entry) return { label: "Not entered", tone: "muted" };
  if (entry.disqualified_at) return { label: "Disqualified", tone: "red" };
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

/**
 * The one decision a site without a seat has to make: pay, or add our badge.
 * `plan` (picked on the pricing card) opens the badge steps or highlights the payment.
 */
function GetSeat({
  product: p,
  plan,
  when,
  note,
}: {
  product: Product;
  plan: "badge" | "pass" | null;
  when: string;
  note: string | null;
}) {
  return (
    <section className="border-gradient mt-4 rounded-[0.875rem] p-5">
      <h2 className="font-display text-2xl font-extrabold">Get your seat in {when}</h2>
      <p className="mt-1 text-sm text-muted">
        {note ? `${note} ` : ""}Pick one. Either way you skip qualifying, and it never adds votes inside a match.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 ${
            plan === "pass" ? "border-red ring-2 ring-red/30" : "border-line"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold">Pay $79</p>
            <p className="text-sm text-muted">Your seat is secured right away. One-time payment, one tournament.</p>
          </div>
          {PAYMENTS_CONFIGURED ? (
            <form action={startPassCheckout.bind(null, p.id)}>
              <button className="btn bg-red text-white">Pay $79 →</button>
            </form>
          ) : (
            <span className="text-sm font-semibold text-muted">Coming soon</span>
          )}
        </div>

        <details
          id={`badge-${p.id}`}
          open={plan === "badge" || p.badge_status === "pending"}
          className="group scroll-mt-6 rounded-xl border border-line bg-white p-4"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Add our badge · free</span>
              <span className="block text-sm text-muted">
                Put a link to Backlink Arena on your site. Once we&apos;ve verified it, you&apos;re in.
              </span>
            </span>
            {p.badge_status === "pending" ? (
              <span className="rounded-full bg-sun/40 px-3 py-1 text-sm font-bold">⏳ Check pending</span>
            ) : (
              <span className="btn bg-blue text-white">
                <span className="group-open:hidden">Show me how ▾</span>
                <span className="hidden group-open:inline">Hide steps ▴</span>
              </span>
            )}
          </summary>
          <BadgeCard
            siteUrl={PUBLIC_SITE_URL}
            slug={p.slug}
            productId={p.id}
            domain={p.domain}
            badgeStatus={p.badge_status}
            compact
          />
        </details>
      </div>
    </section>
  );
}

type Exposure = { views: number; clicks: number; votes: number };

/** Views, votes and clicks this brand collected across its matchups. */
function ExposureStats({ stats, reached }: { stats: Exposure; reached: string }) {
  const cells = [
    { n: stats.views, l: "Matchup views" },
    { n: stats.votes, l: "Votes received" },
    { n: stats.clicks, l: "Clicks to your site" },
  ];
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Your exposure · {reached}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.l}>
            <p className="font-display text-2xl font-extrabold tabular-nums">{c.n.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted">{c.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Post-tournament participant offer: services at 30% off for OFFER_DAYS. */
function ParticipantOffer({
  product,
  stats,
  expires,
  email,
}: {
  product: Product;
  stats: Exposure;
  expires: Date;
  email: string;
}) {
  const pct = `${Math.round(PARTICIPANT_DISCOUNT * 100)}% off`;
  const offer = { productId: product.id, discountLabel: pct };
  return (
    <div className="border-gradient mt-4 rounded-[0.875rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-red-dark">Participant offer · {pct}</p>
        <span className="rounded-full bg-sun/40 px-2.5 py-0.5 text-xs font-bold">Valid until {dayFmt.format(expires)}</span>
      </div>
      <p className="mt-1 font-display text-xl font-extrabold leading-tight">
        {stats.views > 0
          ? `Your matchups got ${stats.views.toLocaleString("en-US")} views and ${stats.clicks.toLocaleString("en-US")} clicks. Turn it into lasting SEO.`
          : "Turn your arena run into lasting SEO."}
      </p>
      <p className="mt-1 text-sm text-muted">
        You played and shared your matchups, so you get our services at {pct} for {OFFER_DAYS} days.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
        {SERVICES.flatMap((s) =>
          (s.tiers ?? [{ price: s.price ?? "", title: s.name, detail: s.priceUnit ?? "" }]).map((t) => {
            const option = s.tiers ? `${s.name} · ${t.title}` : s.name;
            return (
              <li key={option} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.tiers ? `${s.name}: ${t.title}` : s.name}</span>
                  <span className="block text-xs text-muted">{t.detail}</span>
                </span>
                <span className="flex items-center gap-3">
                  {hasFixedPrice(t.price) ? (
                    <span className="text-right">
                      <span className="block text-xs text-muted line-through">{t.price}</span>
                      <span className="block font-display text-xl font-extrabold">{participantPrice(t.price)}</span>
                    </span>
                  ) : (
                    <span className="text-right">
                      <span className="block text-xs text-muted">{t.price}</span>
                      <span className="block font-display text-xl font-extrabold">{pct}</span>
                    </span>
                  )}
                  <LeadButton
                    label="Claim →"
                    service={option}
                    defaultEmail={email}
                    defaultWebsite={product.url}
                    offer={offer}
                    className="btn bg-red px-3! py-1.5! text-sm text-white"
                  />
                </span>
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}

const PASS_NOTICE: Record<string, { text: string; tone: string }> = {
  success: {
    text: "Payment received! Your guaranteed spot is being activated (this can take a few seconds, refresh if you don't see it).",
    tone: "bg-mint-soft",
  },
  cancelled: { text: "Payment cancelled. Nothing was charged.", tone: "bg-paper" },
  failed: { text: "Payment didn't go through. Nothing was charged. Please try again.", tone: "bg-red-soft" },
  already: { text: "This site already has an unused guaranteed spot.", tone: "bg-blue-soft" },
  unavailable: { text: "Payments aren't switched on yet. Please try again later.", tone: "bg-sun/30" },
  error: { text: "Couldn't start the payment. Please try again.", tone: "bg-red-soft" },
};

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
  const params = await searchParams;
  const joined = params.joined;
  // Dodo appends `status` to the return URL: only "succeeded" means paid (display only, the
  // webhook grants the pass).
  const passParam = typeof params.pass === "string" ? params.pass : undefined;
  const pass =
    passParam === "success" && typeof params.status === "string" && params.status !== "succeeded" ? "failed" : passParam;
  // Path picked on the pricing card: "badge" or "pass" (anything else = no guided step).
  const plan = params.plan === "badge" || params.plan === "pass" ? params.plan : null;
  const user = await requireUser(plan ? `/dashboard?plan=${plan}` : "/dashboard");
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
  const [matchProducts, { data: countRows }] = await Promise.all([
    getProductsByIds(matches.flatMap((m) => [m.product_a, m.product_b])),
    matches.some((m) => m.status === "open") && tournament
      ? supabase.rpc("tournament_match_counts", { p_tournament_id: tournament.id })
      : Promise.resolve({ data: [] }),
  ]);
  // Public vote counts (real + admin adjustment) per match.
  const countsOf = new Map(
    ((countRows ?? []) as { match_id: string; a_votes: number; b_votes: number }[]).map((r) => [r.match_id, r]),
  );
  const pathOf = (m: Match) =>
    matchPath(
      m,
      m.product_a ? matchProducts.get(m.product_a)?.slug : null,
      m.product_b ? matchProducts.get(m.product_b)?.slug : null,
    );
  const canEnter = tournament?.status === "draft" || tournament?.status === "qualifying";

  // Exposure per site (service role: site_events has no public policies). Empty if migration 0008 isn't run.
  const exposure = new Map<string, Exposure>();
  if (ids.length) {
    const { data } = await createSupabaseAdmin().rpc("product_exposure", { p_ids: ids });
    for (const r of (data ?? []) as { product_id: string; views: number; clicks: number; votes: number }[]) {
      exposure.set(r.product_id, { views: Number(r.views), clicks: Number(r.clicks), votes: Number(r.votes) });
    }
  }
  /** When a site's run in this tournament ended (knocked out, didn't qualify, or tournament over). */
  function runEndedAt(entry: Entry | undefined, productId: string): Date | null {
    if (!tournament || !entry) return null;
    const out = entry.eliminated_round !== null && entry.eliminated_round !== undefined;
    if (!out && tournament.status !== "finished") return null;
    const last = matches.find((m) => m.product_a === productId || m.product_b === productId);
    const at = last?.ends_at ?? tournament.qualifying_ends_at ?? null;
    return at ? new Date(at) : new Date();
  }

  return (
    // Wide layout only when there are several sites to show side by side.
    <div className={products.length > 1 ? "" : "mx-auto max-w-3xl"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Your corner</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {pass && PASS_NOTICE[pass] && (
        <p className={`mt-4 rounded-2xl border border-line p-3 font-semibold ${PASS_NOTICE[pass].tone}`}>
          {PASS_NOTICE[pass].text}
        </p>
      )}

      {joined && (
        <p className="mt-4 rounded-2xl border border-line bg-mint-soft p-3 font-semibold">
          {plan
            ? "Your website is in! One step left: pick how to get your seat below."
            : "Your website is in!"}
        </p>
      )}

      {products.length === 0 ? (
        <div className="card mt-6 p-6 text-center">
          <p className="text-lg font-bold">No website entered yet.</p>
          {plan && (
            <p className="mt-1 text-sm text-muted">
              First add your website, then we&apos;ll get your guaranteed spot
              {plan === "pass" ? " ($79)" : " (with our badge)"}.
            </p>
          )}
          <Link href={plan ? `/join?plan=${plan}` : "/join"} className="btn mt-4 bg-red text-white">
            Join with your website
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <MatchCarousel
            itemLabel="Website"
            slideClassName={products.length > 1 ? "w-[92%] md:w-[calc(50%-0.5rem)]" : "w-full"}
          >
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
                <section key={p.id} className="card flex h-full flex-col p-5">
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

                  {entry && exposure.has(p.id) && (
                    <ExposureStats stats={exposure.get(p.id)!} reached={status.label} />
                  )}

                  {(() => {
                    const ended = runEndedAt(entry, p.id);
                    if (!ended) return null;
                    const expires = new Date(ended.getTime() + OFFER_DAYS * 86400_000);
                    if (expires.getTime() < Date.now()) return null;
                    return (
                      <ParticipantOffer
                        product={p}
                        stats={exposure.get(p.id) ?? { views: 0, clicks: 0, votes: 0 }}
                        expires={expires}
                        email={user.email ?? ""}
                      />
                    );
                  })()}

                  {current?.status === "open" && tournament ? (
                    (() => {
                      const mine = current.product_a === p.id ? "a" : "b";
                      const rivalId = mine === "a" ? current.product_b : current.product_a;
                      const c = countsOf.get(current.id);
                      return (
                        <RallyKit
                          mySide={mine}
                          me={p.name}
                          rival={(rivalId && matchProducts.get(rivalId)?.name) || "a bye"}
                          myLogo={p.logo_url}
                          rivalLogo={(rivalId && matchProducts.get(rivalId)?.logo_url) || null}
                          round={roundName(current.round, tournament.bracket_size)}
                          link={shareLink}
                          endsAt={current.ends_at}
                          myVotes={c ? (mine === "a" ? c.a_votes : c.b_votes) : 0}
                          rivalVotes={c ? (mine === "a" ? c.b_votes : c.a_votes) : 0}
                          imageUrl={`${pathOf(current)}/opengraph-image`}
                          pausedAt={tournament.paused_at}
                        />
                      );
                    })()
                  ) : (
                    entry && <div className="mt-5">
                      <ShareButtons link={shareLink} title={current ? "Share your last matchup" : "Share your entry"} />
                    </div>
                  )}

                  {p.pass_paid || p.badge_status === "verified" ? (
                    <p className="mt-4 rounded-2xl border border-line bg-mint-soft p-3 text-sm font-semibold">
                      ✓ Your seat is secured ({p.pass_paid ? "paid" : "badge verified"}).{" "}
                      {canEnter && entry
                        ? "You skip qualifying in this tournament."
                        : "You'll be entered automatically when the next tournament opens."}
                      {!p.pass_paid && " Keep the badge on your site."}
                    </p>
                  ) : (
                    (!entry || entry.entry_path === "free") &&
                    current?.status !== "open" && (
                      <GetSeat
                        product={p}
                        plan={plan}
                        when={canEnter ? "this tournament" : "the next tournament"}
                        note={
                          !entry && tournament && !canEnter && tournament.status !== "finished"
                            ? `${tournament.name} has already started.`
                            : null
                        }
                      />
                    )
                  )}

                  {current && (
                    <div className="mt-auto pt-5">
                      <Link href={`${pathOf(current)}?ref=${p.slug}`} className="btn w-full bg-red text-white">
                        {current.status === "open" ? "Go to your matchup →" : "See your last matchup →"}
                      </Link>
                    </div>
                  )}
                </section>
              );
            })}
          </MatchCarousel>
          <Link href="/join" className="text-center text-sm font-semibold underline">
            + Add another website
          </Link>
        </div>
      )}
    </div>
  );
}
