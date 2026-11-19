import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LeadButton } from "@/components/LeadButton";
import { Services } from "@/components/Services";
import { faqSchema, JsonLd, servicesSchema } from "@/lib/json-ld";

// Keyword target: "buy high da backlinks" (+ "buy high da quality backlinks", "white hat link building").
export const metadata: Metadata = {
  title: { absolute: "Buy High DA Backlinks: Real Outreach, No PBNs | Backlink Arena" },
  description:
    "Buy high DA backlinks placed through manual outreach: do-follow links in real content on relevant sites in your niche. White hat link building, no PBNs, from $249.",
  alternates: { canonical: "/services" },
};

const WHY_LINKS = [
  {
    icon: "📈",
    t: "Better rankings",
    d: "Google reads a link from a relevant site as a vote of trust. Pages with strong links from their niche rank higher than pages without them, even with great content.",
  },
  {
    icon: "🚪",
    t: "Visitors who are already interested",
    d: "A link inside an article on a site your customers read sends people who are looking for exactly what you do, long after the article goes live.",
  },
  {
    icon: "⚡",
    t: "A head start for new sites",
    d: "A brand-new domain has no trust yet. A few good links help Google find, crawl and take your pages seriously much sooner.",
  },
  {
    icon: "🤖",
    t: "Found by AI search",
    d: "Tools like ChatGPT and Perplexity pull from pages that rank and from sites that mention you. Links and mentions in your niche make you part of those answers.",
  },
];

const WHY_PRESS = [
  {
    t: "Instant trust",
    d: "An \"As seen in\" logo on your homepage tells new visitors you're real. That helps more of them sign up or buy.",
  },
  {
    t: "A bigger audience",
    d: "Your brand appears in front of the outlet's readers, people who would never have found you through search.",
  },
  {
    t: "More people search for you",
    d: "After a feature, more people google your brand name. That's a signal Google notices too.",
  },
  {
    t: "A source AI tools cite",
    d: "AI search leans on well-known media. Being in an article there makes it likelier you're named in answers about your market.",
  },
];

const GOOD = [
  "Sites in your industry, with real readers and traffic",
  "Your link inside an article that fits the site",
  "Placed through personal outreach to the owner or editor",
  "A handful of strong links, built at a natural pace",
];

const BAD = [
  "PBNs: networks of sites built only to sell links",
  "Link farms and spam directories",
  "Hundreds of links overnight from unrelated sites",
  "Comment and forum spam",
];

const STEPS = [
  {
    t: "We pick the sites with you",
    d: "Established sites that match your industry and audience, with real traffic. You see the list before anything goes live.",
  },
  {
    t: "Manual outreach",
    d: "We contact real site owners and editors personally. No automated mass emails, no networks we own.",
  },
  {
    t: "Your link goes into real content",
    d: "A do-follow link inside an article that fits the site, so it reads naturally and stays up.",
  },
  {
    t: "You get a report",
    d: "Every live link, the page it sits on and the site's metrics, in one report.",
  },
];

const FAQ: { q: string; a: React.ReactNode; plain?: string }[] = [
  {
    q: "Are backlinks still important?",
    a: "Yes. Links from relevant, trusted sites are still one of the strongest signals Google uses to rank pages. What changed is that quality matters far more than quantity: one link from a real site in your niche is worth more than hundreds of spammy ones, which can even hurt you.",
  },
  {
    q: "What is a DA 50+ backlink?",
    a: "DA (Domain Authority) is a 0–100 score from Moz that estimates how strong a website's link profile is. A DA 50+ site is an established site with many good links of its own, so a link from it carries a lot of weight.",
  },
  {
    q: "Where's the best place to buy high DA backlinks?",
    a: "Anywhere that places your link on a real site with real traffic, in content that fits your niche, and shows you the site before you pay. Avoid offers built on PBNs, link farms or bulk directories: they're cheap because the sites only exist to sell links, and Google discounts them. That's the standard we hold ourselves to.",
  },
  {
    q: "How much do backlinks cost?",
    a: "A placement on a relevant niche site usually costs a few hundred dollars, more for DA 50+ sites and well-known media. You can start with a single placement for $249. Packages are $870 for 3 placements and $1,670 for 5 (incl. 1 DA 50+ site); bigger orders on request. The final price depends on your industry and the sites you pick.",
  },
  {
    q: "Are these white hat backlinks?",
    a: "Yes. Every link comes from outreach to a real site owner or editor and sits in content on that site. We don't use PBNs, link farms, spam directories or automated link schemes.",
  },
  {
    q: "Are the links do-follow?",
    a: "Backlink placements are do-follow links inside real content. Press features are different: big outlets often mark them as sponsored, so we sell those for trust and visibility, not link power.",
  },
  {
    q: "How long until my links are live?",
    a: "Usually a few weeks, since every placement goes through a real editor. You get a report as links go live.",
  },
  {
    q: "Can I get backlinks for free?",
    a: (
      <>
        Yes, by winning one. Enter your website in the <Link href="/" className="font-semibold underline">Backlink Arena</Link>:
        the champion of each tournament gets a backlink on a real DA 50+ site in their niche. Everyone who plays gets 30% off
        our placements for 7 days.
      </>
    ),
    plain:
      "Yes, by winning one. Enter your website in the Backlink Arena: the champion of each tournament gets a backlink on a real DA 50+ site in their niche. Everyone who plays gets 30% off our placements for 7 days.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={servicesSchema()} />
      <JsonLd data={faqSchema(FAQ.map((f) => ({ q: f.q, a: f.plain ?? String(f.a) })))} />
      <Services page />

      {/* Why backlinks */}
      <section className="mx-auto mt-24 max-w-5xl px-4">
        <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">Why backlinks</p>
        <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
          Why backlinks <span className="text-gradient">still matter</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          Every link to your site from another site is a recommendation. Search engines count those recommendations, and
          people follow them.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_LINKS.map((w) => (
            <li key={w.t} className="card flex flex-col p-5">
              <span className="text-2xl" aria-hidden="true">
                {w.icon}
              </span>
              <p className="mt-3 font-display text-lg font-extrabold leading-tight">{w.t}</p>
              <p className="mt-1 text-sm text-muted">{w.d}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="border-gradient rounded-[0.875rem] p-6">
            <p className="font-display text-lg font-extrabold">Links that help you</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {GOOD.map((g) => (
                <li key={g} className="flex items-start">
                  <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint text-[10px] text-white">✓</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <p className="font-display text-lg font-extrabold">Links that can hurt you</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
              {BAD.map((b) => (
                <li key={b} className="flex items-start">
                  <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red text-[10px] text-white">✕</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted">
          Google ignores or penalizes the second kind. We only place the first.
        </p>
      </section>

      {/* Why press */}
      <section className="mx-auto mt-24 max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-[0.875rem] bg-dark-gradient p-6 text-white ring-1 ring-white/10 sm:p-10">
          <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-200/80">Why press features</p>
          <h2 className="headline mt-2 text-4xl sm:text-5xl">
            Being in the news <span className="text-gradient">builds trust</span>
          </h2>
          <p className="mt-3 max-w-2xl text-white/70">
            A backlink tells Google you&apos;re trustworthy. A feature in well-known media tells people. The two do
            different jobs, and most growing brands need both.
          </p>
          <figure className="mt-8">
            <Image
              src="/press/press-grid.webp"
              width={1488}
              height={715}
              alt="Illustration of brand features in online news media"
              sizes="(min-width: 1024px) 944px, 100vw"
              className="h-auto w-full rounded-xl ring-1 ring-white/10"
            />
            <figcaption className="mt-2 text-xs text-white/45">
              Illustration only. Outlets and placements are agreed per request.
            </figcaption>
          </figure>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {WHY_PRESS.map((w) => (
              <li key={w.t} className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <p className="font-display text-lg font-extrabold">{w.t}</p>
                <p className="mt-1 text-sm text-white/70">{w.d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-white/60">
            Honest note: big outlets usually label paid features as sponsored, and those links often don&apos;t pass
            ranking power. Buy a press feature for trust and visibility, and backlink placements for rankings.
          </p>
          <div className="mt-6">
            <LeadButton label="Request a quote →" service="Press Feature" className="btn border-white bg-white text-ink" />
          </div>
        </div>
      </section>

      {/* How we help */}
      <section className="mx-auto mt-24 max-w-5xl px-4">
        <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">How it works</p>
        <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
          White hat link building: <span className="text-gradient">no PBNs, no link farms</span>
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card flex flex-col p-5">
              <span className="font-display text-sm font-extrabold text-red-dark">0{i + 1}</span>
              <p className="mt-2 font-display text-lg font-extrabold leading-tight">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-24 max-w-3xl px-4 pb-6">
        <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">FAQ</p>
        <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
          Buying backlinks, <span className="text-gradient">answered</span>
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
        <div className="mt-10 text-center">
          <LeadButton label="Talk to us →" service="Backlink Placement · 5 placements" className="btn border-red bg-red text-white" />
        </div>
      </section>
    </>
  );
}
