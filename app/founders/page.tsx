import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why we started Backlink Arena",
  description:
    "No budget, no leads. No leads, no budget. Why Backlink Arena exists: helping founders break that loop with backlinks and exposure, even without a budget.",
  alternates: { canonical: "/founders" },
};

const LOOP = [
  { t: "No budget", d: "So you can't pay for ads, PR or the links that would get you found." },
  { t: "No leads", d: "So nobody finds you, nobody buys, and there's still no budget." },
];

const BUILT = [
  {
    t: "Free to enter",
    d: "Every brand gets its own page in the arena with a link to its site, the moment it enters. No card needed.",
  },
  {
    t: "Votes instead of money",
    d: "Free brands qualify by getting votes. Sharing your matchup brings people to your site while you play.",
  },
  {
    t: "A real prize",
    d: "The champion of each tournament wins a backlink on a real DA 50+ site in their niche, the kind of link that usually costs hundreds.",
  },
  {
    t: "A fair price after",
    d: "When you're ready to pay for links, everyone who played gets 30% off our placements. No PBNs, no link farms.",
  },
];

export default function FoundersPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 pb-6 sm:pt-16">
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">From the founder</p>
      <h1 className="headline mt-2 text-center text-4xl sm:text-5xl">
        Why we started <span className="text-gradient">Backlink Arena</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">
        I help founders break the loop that keeps most new products invisible, and land their first customers.
      </p>

      {/* The loop */}
      <section className="mt-14">
        <div className="relative overflow-hidden rounded-[0.875rem] bg-dark-gradient p-6 text-white ring-1 ring-white/10 sm:p-10">
          <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-200/80">The chicken and the egg</p>
          <p className="headline mt-3 text-3xl sm:text-4xl">
            No budget, no leads.
            <br />
            <span className="text-gradient">No leads, no budget.</span>
          </p>
          <div className="mt-8 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <p className="font-display text-lg font-extrabold">{LOOP[0].t}</p>
              <p className="mt-1 text-sm text-white/70">{LOOP[0].d}</p>
            </div>
            <span aria-hidden="true" className="text-center font-display text-2xl text-amber-300">
              ⇄
            </span>
            <div className="rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <p className="font-display text-lg font-extrabold">{LOOP[1].t}</p>
              <p className="mt-1 text-sm text-white/70">{LOOP[1].d}</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-white/60">
            Every founder I talk to knows this loop. You need customers to afford growth, and you need growth to get
            customers.
          </p>
        </div>
      </section>

      {/* The story */}
      <section className="mt-14 space-y-4 text-[17px] leading-relaxed">
        <h2 className="headline text-3xl">Backlinks matter. They&apos;re also expensive.</h2>
        <p>
          When you launch something new, Google doesn&apos;t know you exist. One of the strongest ways to change that is
          still the oldest one: other trusted sites linking to yours. A few good backlinks from relevant sites help you
          get found, ranked, and lately also named by AI search tools.
        </p>
        <p>
          The problem: a single placement on a good site in your niche easily costs a few hundred dollars, and more for
          strong DA 50+ sites. That&apos;s nothing for a funded company. For a founder with no revenue yet, it&apos;s
          exactly the budget that isn&apos;t there. So the cheap route wins: PBNs, link farms and spam directories that
          do nothing, or worse.
        </p>
        <p>
          I kept seeing good products stuck there. Not because they were bad, but because nobody could find them. So I
          asked a different question: what if founders could <strong>earn</strong> a strong backlink instead of buying
          one?
        </p>
      </section>

      {/* What we built */}
      <section className="mt-14">
        <h2 className="headline text-3xl">
          So we built an <span className="text-gradient">arena</span>
        </h2>
        <p className="mt-2 text-muted">
          Brands go head to head in a bracket. People vote. The winner gets the backlink.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {BUILT.map((b) => (
            <li key={b.t} className="card p-5">
              <p className="font-display text-lg font-extrabold">{b.t}</p>
              <p className="mt-1 text-sm text-muted">{b.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Building in public */}
      <section className="mt-14">
        <div className="border-gradient rounded-[0.875rem] p-6 sm:p-8">
          <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">Building in public</p>
          <p className="mt-2 font-display text-2xl font-extrabold">I&apos;m in the same loop as you.</p>
          <p className="mt-2 text-muted">
            Backlink Arena is a young product too, and I&apos;m building it in public: what works, what doesn&apos;t, and
            the numbers along the way. If you&apos;re a founder looking for your first customers, enter your site, play a
            tournament, and tell me what would help you most.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/join" className="btn border-red bg-red text-white">
              Enter the arena, free →
            </Link>
            <Link href="/rules" className="btn bg-card">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
