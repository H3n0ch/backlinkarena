import Link from "next/link";
import { Suspense } from "react";
import { JoinField } from "@/components/JoinField";
import { HeroVideo } from "@/components/HeroVideo";
import { GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { Services } from "@/components/Services";
import { SponsorCard } from "@/components/SponsorCard";
import { TournamentSection } from "@/components/TournamentSection";
import { WallOfLove } from "@/components/WallOfLove";
import { faqSchema, JsonLd } from "@/lib/json-ld";
import { getArenaStats, getCurrentOrLastTournament, getRecentProducts, getWinners } from "@/lib/data";
import { getTournamentSponsor } from "@/lib/sponsors";

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

      <WallOfLove />
      <EveryoneWins />
      <Pricing />
      <Services />
      <Faq />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

const STEPS = [
  {
    n: "01",
    t: "Enter",
    d: "Add your website. It gets its own page in the arena right away.",
    // Door with an arrow going in
    icon: (
      <>
        <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m9 17 5-5-5-5" />
        <path d="M14 12H3" />
      </>
    ),
  },
  {
    n: "02",
    t: "Battle",
    d: "16 brands, 1v1 knockouts. Every matchup puts you in front of a whole new crowd: your opponent's followers, plus everyone who comes to vote.",
    // Crossed swords
    icon: (
      <>
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
        <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
        <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
        <path d="m5 14 4 4M7 17l-3 3M3 19l2 2" />
      </>
    ),
  },
  {
    n: "03",
    t: "Win",
    d: "The champion gets a backlink on a real DA 50+ site in their niche.",
    // Trophy
    icon: (
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </>
    ),
  },
];

function Hero() {
  return (
    <section className="relative isolate mx-auto max-w-3xl px-4 pt-12 pb-6 text-center sm:pt-20">
      <HeroVideo />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-80 max-w-2xl rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.28),rgb(225_29_72/0.12)_55%,transparent)] blur-2xl"
      />
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-red/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-dark shadow-sm backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad-brand)]" /> DA 50+ backlinks · Free with our badge
      </span>
      <h1 className="headline text-5xl sm:text-7xl">
        Battle for{" "}
        <span className="text-gradient animate-shimmer">
          free{" "}
          {/* nowrap keeps the logo on the same line as "backlinks." */}
          <span className="whitespace-nowrap">
            backlinks.
            <img
              src="/badge/backlink-arena-icon-v6.svg"
              alt=""
              aria-hidden="true"
              width={80}
              height={80}
              className="ml-2 inline-block h-[1.15em] w-[1.15em] rotate-6 align-[-0.22em] drop-shadow-[0_10px_18px_rgb(234_88_12/0.35)] sm:ml-3"
            />
          </span>
        </span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg">
        Go 1v1 against another brand. You both share the matchup, so <strong>their audience discovers you too</strong>, win or
        lose. Every round brings a new rival and <strong>a new audience</strong>. The winner gets a <strong>DA 50+ link worth $500</strong> in their niche. No outreach, no pitching.
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
        <ol className="relative mt-6 grid gap-4 text-left sm:grid-cols-3">
          {/* Gold connector behind the cards */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[16%] top-12 hidden h-px bg-linear-to-r from-amber-300/0 via-amber-300/70 to-amber-300/0 sm:block"
          />
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li
                key={s.n}
                className="group/step relative flex flex-col overflow-hidden rounded-[1.25rem] p-5 transition duration-300 hover:-translate-y-1"
                style={PREMIUM_FRAME}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent"
                />
                {/* Big faint step number */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3 right-3 font-display text-7xl font-black italic opacity-15"
                  style={GOLD_TEXT}
                >
                  {s.n}
                </span>

                {/* Icon medallion */}
                <span className="relative flex size-14 items-center justify-center">
                  <span
                    aria-hidden="true"
                    className={`absolute -inset-2 rounded-full blur-xl ${last ? "bg-amber-400/35" : "bg-orange-500/20"}`}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#fde68a,#f59e0b,#fff7ed,#b45309,#fde68a)] p-px"
                  >
                    <span className="block size-full rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0c0a09)]" />
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke={last ? "#fcd34d" : "#fde68a"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="relative transition-transform duration-300 group-hover/step:scale-110"
                    aria-hidden="true"
                  >
                    {s.icon}
                  </svg>
                </span>

                <p className="mt-4 text-[10px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">Step {s.n}</p>
                <p className="mt-1 font-display text-2xl font-extrabold leading-tight" style={last ? GOLD_TEXT : { color: "#fff" }}>
                  {s.t}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{s.d}</p>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

const SOCIAL_PROOF_MIN_SITES = 100;

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
        {/* Small numbers make the arena look empty, so only show them once they impress. */}
        {stats.sites >= SOCIAL_PROOF_MIN_SITES ? (
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
  const tournament = await getCurrentOrLastTournament();
  const sponsor = await getTournamentSponsor(tournament?.id);
  // An open slot is only advertised while the tournament still runs.
  const showSponsor = sponsor || (tournament && tournament.status !== "finished");
  return (
    <>
      {showSponsor && <SponsorCard sponsor={sponsor} tournamentName={tournament?.name} className="mb-8" />}
      <TournamentSection tournament={tournament} carousel />
    </>
  );
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

/* ---------------------------------------------------------- Everyone wins */

const PERKS = [
  {
    icon: "🏟️",
    t: "Your page in the arena",
    d: "The moment you enter, your brand gets its own page with your logo, pitch and a way to visit your site.",
  },
  {
    icon: "👀",
    t: "Seen by every voter",
    d: "Every matchup shows your logo, name and pitch to everyone who comes to vote. That's new eyes on your product.",
  },
  {
    icon: "📣",
    t: "New people discover you",
    d: "Everyone wants to win, so every brand shares its matchup with its followers. Each share shows both sites, so people who've never heard of you find you for free.",
  },
  {
    icon: "🏆",
    t: "The champion's prize",
    d: "The winner gets a backlink on a real DA 50+ site in their niche, placed by hand.",
  },
];

function EveryoneWins() {
  return (
    <section className="mx-auto mt-24 max-w-5xl px-4">
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">
        Not just for the winner
      </p>
      <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
        Every entry <span className="text-gradient">gets something</span>
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted">
        The DA 50+ backlink is the top prize. But from the moment you enter, your site is in front of an audience.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map((p, i) => (
          <li key={p.t} className={`card flex flex-col p-5 ${i === PERKS.length - 1 ? "border-gradient" : ""}`}>
            <span className="text-2xl" aria-hidden="true">
              {p.icon}
            </span>
            <p className="mt-3 font-display text-lg font-extrabold leading-tight">{p.t}</p>
            <p className="mt-1 text-sm text-muted">{p.d}</p>
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
        Two ways to get <span className="text-gradient">your seat</span>
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted">
        Both get you straight into the bracket. Neither adds a single vote inside a match.
      </p>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
        <div className="card flex flex-col p-6">
          <p className="font-display text-2xl font-extrabold">Badge + share</p>
          <p className="mt-1 text-sm text-muted">Help spread the word, get your seat.</p>
          <p className="mt-4 font-display text-4xl font-extrabold">$0</p>
          <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
            <li><Check />Add our badge to your site</li>
            <li><Check />Share 2 public posts about us</li>
            <li><Check />Seat in every tournament while the badge is live</li>
          </ul>
          <Link href="/join?plan=badge" className="btn mt-6 bg-red text-white">
            Add the badge →
          </Link>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-[0.875rem] bg-dark-gradient p-6 text-white shadow-[0_24px_60px_-24px_rgb(234_88_12/0.6)] ring-1 ring-white/10">
          <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
          <span className="absolute right-4 top-4 rounded-full bg-[image:var(--grad-brand)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow">
            Most popular
          </span>
          <p className="headline text-2xl">Guaranteed spot</p>
          <p className="mt-1 text-sm text-white/70">No badge, no posts. Just play.</p>
          <p className="mt-4 font-display text-4xl font-extrabold">$29</p>
          <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
            <li><Check />Nothing to add to your site</li>
            <li><Check />Seat in one tournament</li>
            <li><Check />Paid while no tournament is open? It counts for the next one</li>
          </ul>
          <Link
            href="/join?plan=pass"
            className="btn mt-6 bg-[image:var(--grad-brand)] text-white shadow-[0_10px_24px_-10px_rgb(234_88_12/0.8)] hover:brightness-110"
          >
            Pay $29 →
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Not ready for either?{" "}
        <Link href="/join" className="font-semibold underline">
          Join free and try to get voted in
        </Link>
        .
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. Add our badge to your site and share 2 posts about us, and you get a seat in the bracket for free. Don't want the badge? Pay $29 for a guaranteed spot in one tournament. Voting is always free.",
  },
  {
    q: "How does a tournament work?",
    a: "16 brands get a seat in the bracket: badge and paid brands first, then the most-voted free entries. Then it's knockout: round of 16, quarterfinals, semifinals, final. Each matchup runs for a set time, and the brand with more votes moves on.",
  },
  {
    q: "What exactly does the winner get?",
    a: "A backlink on a real DA 50+ website in your niche. We choose the site with you and place the link by hand. Every placed link is listed on the Winners page.",
  },
  {
    q: "Can I get backlinks without winning?",
    a: "Yes. Placing backlinks is our main service. We do the outreach and get your link into content on relevant sites in your niche, with no PBNs and no link farms. See Services below. Played in a tournament? You get 30% off for 7 days.",
  },
  {
    q: "Can I buy votes?",
    a: "No. Think of it like priority boarding: you get on faster, but everyone flies on the same plane. Paying $29 or adding our badge only skips qualifying and gets you into the bracket. It never adds votes to a matchup. Every visitor gets one vote per matchup, no sign-up needed, and you can't vote in a matchup you're part of.",
  },
  {
    q: "How do I get a seat?",
    a: "Two ways: add our badge and share 2 posts (free), or pay $29. Both take a seat as soon as they're done. Not ready for either? Join free and collect votes on the qualifying list. The most-voted brands fill any seats that are left.",
  },
  {
    q: "Why would I get exposure if I lose?",
    a: "Your opponent shares the matchup with their audience to win votes. The preview shows both brands, and every visitor sees both sites side by side. Every share they make puts you in front of a new community beyond your own, people who would never have found you otherwise.",
  },
  {
    q: "How are matchups paired?",
    a: "We never pair you with a direct competitor. In round 1 we look for a brand whose audience could also like you, so each matchup opens a new door. After that, winners meet winners.",
  },
  {
    q: "What if I lose?",
    a: "You keep the visitors and attention your matchups brought in, and you see your numbers in your dashboard. You also get 30% off our backlink placement service for 7 days, and you can enter the next tournament.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto mt-24 max-w-3xl scroll-mt-20 px-4 pb-6">
      <JsonLd data={faqSchema(FAQ)} />
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
