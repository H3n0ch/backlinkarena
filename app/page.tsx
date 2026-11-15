import Link from "next/link";
import { Suspense } from "react";
import { JoinField } from "@/components/JoinField";
import { ProductLogo } from "@/components/ProductLogo";
import { Services } from "@/components/Services";
import { TournamentSection } from "@/components/TournamentSection";
import { getArenaStats, getCurrentOrLastTournament, getRecentProducts, getWinners } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Hero />

      <div className="mt-6">
        <Suspense fallback={<div className="mx-auto h-[28rem] max-w-5xl animate-pulse rounded-xl bg-cream" />}>
          <Tournament />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <PastWinners />
      </Suspense>

      <Pricing />
      <Services />
      <Faq />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

const STEPS = [
  { n: "1", t: "Enter", d: "Add your website. Free entries play a short qualifying round." },
  { n: "2", t: "Battle", d: "16 brands, 1v1 knockouts. Share your matchup and rally votes." },
  { n: "3", t: "Win", d: "The champion gets a backlink on a real DA 50+ site in their niche." },
];

function Hero() {
  return (
    <section className="relative isolate mx-auto max-w-3xl px-4 pt-12 pb-6 text-center sm:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-80 max-w-2xl rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.28),rgb(225_29_72/0.12)_55%,transparent)] blur-2xl"
      />
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-red/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-dark shadow-sm backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad-brand)]" /> DA 50+ backlinks · Free to enter
      </span>
      <h1 className="headline text-5xl sm:text-7xl">
        Battle for <span className="text-gradient animate-shimmer">backlinks.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg">
        Win a <strong>DA 50+ backlink</strong> in your niche. Strong backlinks shouldn&apos;t only be for companies
        with big budgets. Play for one.
      </p>

      <div className="relative mx-auto mt-7 max-w-lg">
        <JoinField cta="Join" />
        <span className="text-gradient pointer-events-none absolute -right-2 -top-7 hidden rotate-6 font-display text-lg font-extrabold italic sm:block">
          Free ↓
        </span>
      </div>

      <Suspense fallback={<div className="mt-5 h-10" />}>
        <SocialProof />
      </Suspense>

      <details className="group mx-auto mt-8 max-w-2xl">
        <summary className="mx-auto inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-1.5 text-sm font-semibold shadow-sm backdrop-blur hover:bg-cream">
          <span className="text-red">?</span> How it works
          <span className="transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <ol className="mt-5 grid gap-3 text-left sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-4">
              <span className="headline text-gradient text-3xl">{s.n}</span>
              <p className="mt-1 font-display text-lg font-extrabold">{s.t}</p>
              <p className="text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

async function SocialProof() {
  const [stats, recent] = await Promise.all([getArenaStats(), getRecentProducts(6)]);
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {recent.length > 0 && (
        <div className="flex -space-x-2">
          {recent.map((p) => (
            <span key={p.id} title={p.name} className="rounded-full ring-2 ring-white">
              <ProductLogo src={p.logo_url} name={p.name} size={32} className="rounded-full!" />
            </span>
          ))}
        </div>
      )}
      <p className="text-sm text-muted">
        {stats.sites > 0 ? (
          <>
            Join <strong className="text-ink">{stats.sites.toLocaleString("en-US")}</strong> founders ·{" "}
            <strong className="text-ink">{stats.votes.toLocaleString("en-US")}</strong> votes cast
          </>
        ) : (
          "Be one of the first founders in the arena."
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ Tournament */

async function Tournament() {
  return <TournamentSection tournament={await getCurrentOrLastTournament()} />;
}

/* ----------------------------------------------------------- Past winners */

async function PastWinners() {
  const winners = (await getWinners()).filter((w) => w.product).slice(0, 4);
  if (!winners.length) return null;
  return (
    <section className="mx-auto mt-16 max-w-5xl px-4">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Past tournament winners</h2>
        <Link href="/winners" className="text-sm font-semibold text-red-dark hover:underline">
          All winners →
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {winners.map(({ tournament, product }) => (
          <li key={tournament.id}>
            <Link
              href={`/p/${product!.slug}`}
              className="border-gradient flex items-start gap-3 rounded-[0.875rem] p-4 transition-transform hover:-translate-y-0.5"
            >
              <ProductLogo src={product!.logo_url} name={product!.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{product!.name}</p>
                <p className="text-xs text-muted">
                  {tournament.name} · {product!.domain}
                </p>
                {product!.description && <p className="mt-1 line-clamp-2 text-sm">{product!.description}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-[linear-gradient(135deg,#fde68a,#fbbf24_50%,#f59e0b)] px-2 py-0.5 text-xs font-bold shadow-sm">🏆 #1</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- Pricing */

function Check() {
  return (
    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-mint text-[10px] text-white">
      ✓
    </span>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto mt-24 max-w-5xl scroll-mt-20 px-4">
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">Pricing</p>
      <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
        Pick your <span className="text-gradient">way in</span>
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted">
        Every path plays by the same rules. Nothing paid or earned adds votes inside a match.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="card flex flex-col p-6">
          <p className="font-display text-lg font-extrabold">Free entry</p>
          <p className="mt-1 text-sm text-muted">Play the qualifying round.</p>
          <p className="mt-4 font-display text-4xl font-extrabold">$0</p>
          <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
            <li><Check />Public product page with a dofollow link</li>
            <li><Check />Qualifying leaderboard spot</li>
            <li><Check />Top voted brands enter the bracket</li>
          </ul>
          <Link href="/join" className="btn mt-6 bg-card">
            Enter for free
          </Link>
        </div>

        <div className="card flex flex-col p-6">
          <p className="font-display text-lg font-extrabold">Badge entry</p>
          <p className="mt-1 text-sm text-muted">Skip qualifying by featuring us.</p>
          <p className="mt-4 font-display text-4xl font-extrabold">$0</p>
          <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
            <li><Check />Everything in Free</li>
            <li><Check />Add our badge to your site</li>
            <li><Check />Verified by hand, then straight into the bracket</li>
          </ul>
          <Link href="/dashboard" className="btn mt-6 bg-card">
            Get the badge
          </Link>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-[0.875rem] bg-dark-gradient p-6 text-white shadow-[0_24px_60px_-24px_rgb(234_88_12/0.6)] ring-1 ring-white/10 md:-my-3 md:py-9">
          <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
          <span className="absolute right-4 top-4 rounded-full bg-[image:var(--grad-brand)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow">
            Fastest
          </span>
          <p className="headline text-2xl">Contender Pass</p>
          <p className="mt-1 text-sm text-white/70">Skip qualifying, no badge needed.</p>
          <p className="mt-4 font-display text-4xl font-extrabold">
            <span className="text-gradient">$79</span>{" "}
            <span className="text-sm font-semibold text-white/60">one-time</span>
          </p>
          <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
            <li><Check />Everything in Free</li>
            <li><Check />Straight into the bracket</li>
            <li><Check />No badge on your site required</li>
          </ul>
          <Link href="/dashboard" className="btn mt-6 border-red bg-red text-white">
            Get the pass →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. Entering with your website and voting are free. The optional $79 Contender Pass only lets you skip the qualifying round.",
  },
  {
    q: "How does a tournament work?",
    a: "Qualifying picks the 16 brands for the bracket. Then it's knockout: round of 16, quarterfinals, semifinals, final. Each matchup runs for a set time, and the brand with more votes moves on.",
  },
  {
    q: "What exactly does the winner get?",
    a: "A backlink on a real DA 50+ website in your niche. We choose the site with you and place the link by hand. Every placed link is listed on the Winners page.",
  },
  {
    q: "Can I buy votes?",
    a: "No. Nothing paid or earned adds votes inside a match. Each account gets one vote per matchup, and you can't vote in your own.",
  },
  {
    q: "How does the qualifying round work?",
    a: "Free entries appear on a public leaderboard. Anyone logged in can vote once per brand. When qualifying ends, badge and pass holders take their spots first, then the most-voted brands fill the rest.",
  },
  {
    q: "What if I lose?",
    a: "Every participant gets a discount offer for our backlink service after the tournament, and you can enter the next one.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto mt-24 max-w-3xl scroll-mt-20 px-4 pb-6">
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">FAQ</p>
      <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
        Before you <span className="text-gradient">enter</span>
      </h2>
      <div className="mt-8 flex flex-col gap-2">
        {FAQ.map((f) => (
          <details key={f.q} className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-semibold">
              {f.q}
              <span className="shrink-0 text-muted transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="border-t border-line px-4 py-3 text-sm text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
