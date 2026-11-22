import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { LeadButton } from "@/components/LeadButton";
import { ProductLogo } from "@/components/ProductLogo";
import { RallyKit } from "@/components/RallyKit";
import { ShareButtons } from "@/components/ShareButtons";
import { requireUser } from "@/lib/auth";
import { getCurrentOrLastTournament, getProductsByIds, PRODUCT_PUBLIC_COLUMNS } from "@/lib/data";
import { startPassCheckout } from "@/app/actions/pass";
import { PUBLIC_SITE_URL, SITE_URL } from "@/lib/env";
import {
  hasFixedPrice,
  OFFER_DAYS,
  offerExpiresAt,
  PARTICIPANT_DISCOUNT,
  participantPrice,
  runEndedAt,
  SERVICES,
} from "@/lib/services";
import { PAYMENTS_CONFIGURED } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { qualifyingPostText } from "@/lib/qualifying";
import { matchPath, matchShareUrl } from "@/lib/share";
import { createSupabaseServer } from "@/lib/supabase/server";
import { roundName } from "@/lib/time";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { BadgeCard } from "./BadgeCard";
import { EnterButton } from "./DashboardButtons";
import { HowItWorks, StatsRow, TournamentBanner } from "./TournamentBanner";

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
        {note ? `${note} ` : ""}Entering is free, but free entries have to be voted in. Pick one of these to skip qualifying and go straight to the bracket. Neither adds votes inside a match.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 ${
            plan === "pass" ? "border-red ring-2 ring-red/30" : "border-line"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold">Pay $29 · guaranteed seat</p>
            <p className="text-sm text-muted">Your bracket seat is secured right away and comes first. One-time payment, one tournament.</p>
          </div>
          {PAYMENTS_CONFIGURED ? (
            <form action={startPassCheckout.bind(null, p.id)}>
              <button className="btn bg-red text-white">Pay $29 →</button>
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
              <span className="block font-bold">Add our badge · skip qualifying for free</span>
              <span className="block text-sm text-muted">
                Put a link to Backlink Arena on your site and share two posts about us on your social accounts. Once we&apos;ve verified them, you skip qualifying in every tournament for as long as the badge stays up. Badge seats are filled right after paid ones.
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
            name={p.name}
            posts={p.badge_posts ?? []}
            compact
          />
        </details>
      </div>
    </section>
  );
}

type Exposure = { views: number; clicks: number; votes: number };

/** Views, votes and clicks this brand collected across its matchups, as one quiet line. */
function ExposureLine({ stats }: { stats: Exposure }) {
  const n = (x: number) => <span className="font-bold text-ink tabular-nums">{x.toLocaleString("en-US")}</span>;
  return (
    <p className="text-sm text-muted">
      {n(stats.views)} matchup views · {n(stats.votes)} votes · {n(stats.clicks)} clicks to your site
    </p>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const pctLabel = `${Math.round(PARTICIPANT_DISCOUNT * 100)}% off`;
/** Offer rows shown before "See all services". */
const OFFER_PREVIEW = 2;

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
  const offer = { productId: product.id, discountLabel: pctLabel };
  const rows = SERVICES.flatMap((s) =>
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
                <span className="block font-display text-xl font-extrabold">{pctLabel}</span>
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
  );
  const list = "flex flex-col divide-y divide-line rounded-xl border border-line bg-white";
  return (
    <div className="border-gradient mt-4 rounded-[0.875rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-red-dark">Participant offer · {pctLabel}</p>
        <span className="rounded-full bg-sun/40 px-2.5 py-0.5 text-xs font-bold">Valid until {dayFmt.format(expires)}</span>
      </div>
      <p className="mt-1 font-display text-xl font-extrabold leading-tight">
        {stats.views > 0
          ? `Your matchups got ${stats.views.toLocaleString("en-US")} views and ${stats.clicks.toLocaleString("en-US")} clicks. Turn it into lasting SEO.`
          : "Turn your arena run into lasting SEO."}
      </p>
      <p className="mt-1 text-sm text-muted">
        You played and shared your matchups, so you get our services at {pctLabel} for {OFFER_DAYS} days.
      </p>
      <ul className={`mt-4 ${list}`}>{rows.slice(0, OFFER_PREVIEW)}</ul>
      {rows.length > OFFER_PREVIEW && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-center text-sm font-semibold underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">See all {rows.length} services ▾</span>
            <span className="hidden group-open:inline">Show fewer ▴</span>
          </summary>
          <ul className={`mt-2 ${list}`}>{rows.slice(OFFER_PREVIEW)}</ul>
        </details>
      )}
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

/** True once `d` is in the past (request time; the page is dynamic). */
function hasPassed(d: Date): boolean {
  return d.getTime() < Date.now();
}

/** The single thing a site card leads with, in priority order. */
type Step = "live" | "enter" | "seat" | "offer" | "idle";

function nextStep(s: { live: boolean; canEnter: boolean; entered: boolean; needsSeat: boolean; hasOffer: boolean }): Step {
  if (s.live) return "live";
  if (!s.entered && s.canEnter) return "enter";
  if (s.needsSeat) return "seat";
  if (s.hasOffer) return "offer";
  return "idle";
}

/** What an idle card says: nothing to do, and why. */
function idleText(t: Tournament | null, entry: Entry | undefined, autoEntered: boolean): string {
  if (!t || t.status === "finished" || !entry || entry.eliminated_round != null || entry.disqualified_at) {
    return autoEntered
      ? "Nothing to do right now. You'll be entered automatically when the next tournament opens."
      : "Nothing to do right now. We'll email you when the next tournament opens.";
  }
  if (t.status === "bracket") return "You're through. We'll email you when your next matchup opens.";
  return "You're seeded and skip qualifying. We'll email you when the bracket starts.";
}

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
      .select(`${PRODUCT_PUBLIC_COLUMNS}, badge_posts`)
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
  // Opponents' slugs for readable matchup links (/vs/a-vs-b), plus the winner's name for the strip.
  const [matchProducts, { data: countRows }] = await Promise.all([
    getProductsByIds([...matches.flatMap((m) => [m.product_a, m.product_b]), tournament?.winner_product_id ?? null]),
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
  function siteRunEndedAt(entry: Entry | undefined, productId: string): Date | null {
    if (!tournament || !entry) return null;
    const last = matches.find((m) => m.product_a === productId || m.product_b === productId);
    return runEndedAt({
      eliminatedRound: entry.eliminated_round,
      tournamentFinished: tournament.status === "finished",
      lastMatchEndsAt: last?.ends_at,
      qualifyingEndsAt: tournament.qualifying_ends_at,
    });
  }

  // Everything a card needs, worked out up front so the JSX stays flat. Live matchups first.
  const sites = products
    .map((p) => {
      const entry = entries.find((e) => e.product_id === p.id);
      const current = matches.find((m) => m.product_a === p.id || m.product_b === p.id);
      const live = Boolean(tournament && current?.status === "open");
      const seated = p.pass_paid || p.badge_status === "verified";
      const needsSeat = !seated && (!entry || entry.entry_path === "free") && !live;
      const ended = siteRunEndedAt(entry, p.id);
      const expires = ended ? offerExpiresAt(ended) : null;
      const offerExpires = expires && !hasPassed(expires) ? expires : null;
      return {
        p,
        entry,
        current,
        live,
        seated,
        needsSeat,
        offerExpires,
        stats: exposure.get(p.id),
        status: statusFor(tournament, entry, p.id),
        // Free entries in qualifying share their own page: it has the vote button, so voters don't hunt the list.
        qualifyingAsk: !current && canEnter && entry?.entry_path === "free" && !entry.disqualified_at,
        shareLink: current
          ? matchShareUrl(pathOf(current), p.slug)
          : canEnter && entry?.entry_path === "free"
            ? `${SITE_URL}/p/${p.slug}`
            : `${SITE_URL}/arena?ref=${p.slug}`,
        step: nextStep({ live, canEnter, entered: Boolean(entry), needsSeat, hasOffer: Boolean(offerExpires) }),
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live));

  const winner = tournament?.winner_product_id ? (matchProducts.get(tournament.winner_product_id)?.name ?? null) : null;

  // Banner data: how full the bracket is, and when the open round ends (any matchup, not just ours).
  let enteredCount = 0;
  let openRound: { ends_at: string; round: number } | null = null;
  if (tournament && tournament.status !== "finished") {
    const admin = createSupabaseAdmin();
    const [{ count }, { data: open }] = await Promise.all([
      admin
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournament.id)
        .is("disqualified_at", null),
      tournament.status === "bracket"
        ? admin
            .from("matches")
            .select("ends_at, round")
            .eq("tournament_id", tournament.id)
            .eq("status", "open")
            .order("ends_at")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    enteredCount = count ?? 0;
    openRound = (open as { ends_at: string; round: number } | null) ?? null;
  }

  // Totals across all sites, and where the user is in the three steps.
  const totals = sites.reduce(
    (acc, s) => ({
      views: acc.views + (s.stats?.views ?? 0),
      votes: acc.votes + (s.stats?.votes ?? 0),
      clicks: acc.clicks + (s.stats?.clicks ?? 0),
    }),
    { views: 0, votes: 0, clicks: 0 },
  );
  const stillIn = sites.some(
    (s) => s.entry && s.entry.eliminated_round == null && !s.entry.disqualified_at && tournament?.status !== "finished",
  );
  const guideStep: number | null = sites.some((s) => s.status.tone === "mint" && s.status.label.includes("Winner"))
    ? 2
    : sites.some((s) => s.live || s.qualifyingAsk) || (stillIn && sites.some((s) => s.seated || s.live))
      ? 1
      : products.length === 0 || canEnter || !tournament || tournament.status === "finished"
        ? 0
        : null;

  return (
    <>
      {tournament && (
        <TournamentBanner
          tournament={tournament}
          winner={winner}
          entered={enteredCount}
          roundEndsAt={openRound?.ends_at ?? null}
          liveRound={openRound?.round ?? null}
        />
      )}
    <div className="mx-auto mt-8 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-dark">Dashboard</p>
          <h1 className="font-display text-4xl font-extrabold">Your corner</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <HowItWorks current={guideStep} />

      {products.length > 0 && (
        <StatsRow
          items={[
            { label: products.length === 1 ? "Website" : "Websites", value: products.length },
            { label: "Matchup views", value: totals.views },
            { label: "Votes", value: totals.votes },
            { label: "Clicks to you", value: totals.clicks },
          ]}
        />
      )}

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
              {plan === "pass" ? " ($29)" : " (with our badge)"}.
            </p>
          )}
          <Link href={plan ? `/join?plan=${plan}` : "/join"} className="btn mt-4 bg-red text-white">
            Join with your website
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <h2 className="-mb-2 font-display text-xl font-extrabold">
            Your {products.length === 1 ? "website" : "websites"}
          </h2>
          {sites.map(({ p, entry, current, live, seated, needsSeat, offerExpires, stats, status, shareLink, qualifyingAsk, step }) => {
            const offer = offerExpires && (
              <ParticipantOffer
                product={p}
                stats={stats ?? { views: 0, clicks: 0, votes: 0 }}
                expires={offerExpires}
                email={user.email ?? ""}
              />
            );
            const getSeat = (
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
            );
            return (
              <section key={p.id} className="card p-5">
                {/* Who, and where they stand */}
                <div className="flex items-center gap-4">
                  <ProductLogo src={p.logo_url} name={p.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${p.slug}`} className="font-display text-xl font-extrabold hover:underline">
                      {p.name}
                    </Link>
                    <p className="truncate text-sm text-muted">{p.domain}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full border border-line px-3 py-1 text-sm font-bold ${TONE[status.tone]}`}>
                      {status.label}
                    </span>
                    {seated && (
                      <span
                        className="rounded-full bg-mint-soft px-2.5 py-0.5 text-xs font-bold"
                        title={
                          p.pass_paid
                            ? "Paid: you skip qualifying."
                            : "Badge verified: you skip qualifying. Keep the badge on your site."
                        }
                      >
                        ✓ Seat secured · {p.pass_paid ? "paid" : "badge"}
                      </span>
                    )}
                  </div>
                </div>

                {/* The one thing to do now */}
                {step === "live" && current && tournament && (() => {
                  const mine = current.product_a === p.id ? "a" : "b";
                  const rivalId = mine === "a" ? current.product_b : current.product_a;
                  const c = countsOf.get(current.id);
                  return (
                    <>
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
                      <Link href={`${pathOf(current)}?ref=${p.slug}`} className="btn mt-3 w-full bg-red text-white">
                        Go to your matchup →
                      </Link>
                    </>
                  );
                })()}

                {qualifyingAsk && (
                  <div className="mt-4 rounded-xl border-2 border-red bg-paper p-4">
                    <p className="font-bold">Get voted in</p>
                    <p className="mb-3 text-sm text-muted">
                      You&apos;re in qualifying: the {tournament?.bracket_size} most-voted brands get into the bracket. Share your
                      page. It has a one-click vote button, no sign-up needed.
                    </p>
                    <ShareButtons link={shareLink} title="Share your vote page" text={qualifyingPostText(p.name, shareLink)} />
                  </div>
                )}

                {step === "enter" && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4">
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="block font-bold">{tournament?.name} is open.</span>
                      <span className="text-muted">Enter for free and collect votes in qualifying, or get a seat below to skip it.</span>
                    </p>
                    <EnterButton productId={p.id} />
                  </div>
                )}

                {(step === "seat" || (step === "enter" && needsSeat)) && getSeat}

                {step === "offer" && offer}

                {step === "idle" && <p className="mt-4 rounded-xl border border-line bg-paper p-4 text-sm">{idleText(tournament, entry, p.pass_paid)}</p>}

                {/* Secondary: stats, share, history, offer teaser */}
                {((entry && stats) || (entry && !live) || (current && !live) || (offerExpires && step !== "offer")) && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
                    {entry && stats && <ExposureLine stats={stats} />}
                    {entry && !live && !qualifyingAsk && (
                      <ShareButtons link={shareLink} title={current ? "Share your last matchup" : "Share your entry"} />
                    )}
                    {current && !live && (
                      <Link href={`${pathOf(current)}?ref=${p.slug}`} className="text-sm font-semibold underline">
                        See your last matchup →
                      </Link>
                    )}
                    {offerExpires && step !== "offer" && (
                      <details className="group">
                        <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
                          <span className="font-bold text-red-dark">Participant offer:</span> our services at {pctLabel} until{" "}
                          {dayFmt.format(offerExpires)} ·{" "}
                          <span className="font-semibold underline">
                            <span className="group-open:hidden">View ▾</span>
                            <span className="hidden group-open:inline">Hide ▴</span>
                          </span>
                        </summary>
                        {offer}
                      </details>
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
    </div>
    </>
  );
}
