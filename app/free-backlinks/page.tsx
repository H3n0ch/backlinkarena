import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta, FaqList } from "@/components/content/Prose";
import { JoinField } from "@/components/JoinField";
import { POSTS } from "@/content/blog";
import { breadcrumbSchema, faqSchema, JsonLd } from "@/lib/json-ld";

// Keyword target: "free backlinks for startups" (+ "free backlinks for saas", "get free backlinks").
export const metadata: Metadata = {
  title: { absolute: "Free Backlinks for Startups: Win a DA 50+ Link | Backlink Arena" },
  description:
    "Get free backlinks for your startup: a brand page linking to your site the moment you enter, and a shot at a DA 50+ niche backlink in a 1v1 tournament. No outreach.",
  alternates: { canonical: "/free-backlinks" },
};

const WHAT_YOU_GET = [
  {
    t: "A brand page, right away",
    d: "The moment you enter, your brand gets its own page in the arena with a normal, followed link to your website. No queue, no card.",
  },
  {
    t: "Matchup pages that get shared",
    d: "Every 1v1 matchup has its own page showing both brands. You and your opponent both share it, so it collects visits from two audiences.",
  },
  {
    t: "A DA 50+ niche backlink for the champion",
    d: "Win the tournament and we place a backlink for you on a real DA 50+ site in your niche, chosen with you and placed by hand.",
  },
  {
    t: "Exposure even if you lose",
    d: "Your opponent's followers see your brand in every share. You keep the visitors your matchups brought in, and see the numbers in your dashboard.",
  },
];

const STEPS = [
  { t: "Enter your site", d: "Paste your URL. We pull your name, description and logo." },
  {
    t: "Get a seat",
    d: "Add our badge and share two posts (free), pay $29, or collect votes in qualifying.",
  },
  { t: "Play 1v1", d: "Rally your audience. More votes than your opponent and you move on." },
  { t: "Win the link", d: "The champion gets a backlink on a DA 50+ site in their niche." },
];

const FAQ = [
  {
    q: "Are these backlinks really free?",
    a: "Yes. Entering is free and your brand page with a link to your site goes live right away. You can get a guaranteed seat in the bracket for free by adding our badge and sharing two posts. The $29 guaranteed spot is optional.",
  },
  {
    q: "Is the link on my brand page do-follow?",
    a: "Yes. The link from your brand page to your website is a normal link without nofollow, ugc or sponsored.",
  },
  {
    q: "What is the DA 50+ backlink?",
    a: "The champion of each tournament gets a backlink on a real website with a Domain Authority of 50 or more, in their niche. We choose the site with you and place the link by hand inside real content. Every placed link is listed on our Winners page.",
  },
  {
    q: "Can I buy votes to win?",
    a: "No. Paying or adding the badge only gets you into the bracket. It never adds votes. Every visitor gets one vote per matchup.",
  },
  {
    q: "What if I don't win?",
    a: "You keep your brand page and the exposure your matchups brought in. You also get 30% off our backlink placement service for 7 days, and you can enter the next tournament.",
  },
];

export default function FreeBacklinksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <JsonLd data={faqSchema(FAQ)} />
      <JsonLd data={breadcrumbSchema([["Free backlinks", "/free-backlinks"]])} />

      <section className="mx-auto max-w-3xl text-center">
        <p className="text-gradient mx-auto w-fit text-xs font-bold uppercase tracking-widest">Free backlinks for startups</p>
        <h1 className="headline mt-3 text-5xl sm:text-6xl">
          Free backlinks, <span className="text-gradient">earned by playing</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg">
          Enter your website and get a brand page that links to you today. Then go 1v1 against other founders. The
          champion wins a <strong>backlink on a real DA 50+ site</strong> in their niche. No outreach, no pitching.
        </p>
        <div className="mx-auto mt-7 max-w-lg">
          <JoinField cta="Enter free" />
        </div>
        <p className="mt-3 text-sm text-muted">
          Free to enter · Voting needs no account · <Link href="/rules" className="underline">Full rules</Link>
        </p>
      </section>

      <section className="mt-20">
        <h2 className="headline text-center text-3xl sm:text-4xl">What you get for free</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {WHAT_YOU_GET.map((w) => (
            <li key={w.t} className="card p-5 sm:p-6">
              <p className="font-display text-lg font-extrabold">{w.t}</p>
              <p className="mt-2 leading-relaxed text-muted">{w.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20">
        <h2 className="headline text-center text-3xl sm:text-4xl">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card p-5">
              <span className="text-gradient text-sm font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 font-display text-lg font-extrabold">{s.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="headline text-3xl sm:text-4xl">Why not just submit to 100 directories?</h2>
        <div className="mt-4 space-y-4 text-[17px] leading-relaxed">
          <p>
            You can, and a few good ones are worth it. But most directory listings are a page on a site nobody visits,
            with a link that may be nofollow. They help a little with getting crawled, and that&apos;s it.
          </p>
          <p>
            What moves a new site is a link from a real, established site in its niche. Those usually cost hundreds of
            dollars because someone has to do the outreach. In the arena, that&apos;s the prize. Read more in{" "}
            <Link href="/blog/are-launch-directories-worth-it" className="font-semibold underline">
              are launch directories worth it?
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="headline text-3xl sm:text-4xl">Questions</h2>
        <FaqList items={FAQ} />
      </section>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="font-display text-xl font-extrabold">Guides</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="font-semibold underline decoration-red/40 underline-offset-2">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto max-w-3xl">
        <ContentCta title="Start with a free brand page" />
      </div>
    </div>
  );
}
