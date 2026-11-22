import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Official rules",
  description: "How Backlink Arena works: entering, qualifying, the bracket, voting, ties, fair play and prizes.",
};

const UPDATED = "November 17, 2026";

type Section = { id: string; title: string; rules: ReactNode[] };

/*
 * Every rule here mirrors what the code enforces (supabase/migrations: seed_bracket,
 * close_due_matches, votes_before_insert, check_guest_limits, check_rate_limit).
 * Change the engine → change this page.
 */
const SECTIONS: Section[] = [
  {
    id: "entering",
    title: "Entering",
    rules: [
      "Anyone can enter a website for free. It gets its own brand page in the arena right away, with a link to your site.",
      "There are three ways in: free entry (you qualify with votes), adding our badge (free, skips qualifying) or the $29 guaranteed spot (skips qualifying).",
      "Badge and paid entries never add votes to a matchup. They only decide who gets into the bracket.",
      "You can only enter websites you own or run.",
    ],
  },
  {
    id: "qualifying",
    title: "Qualifying",
    rules: [
      "Free entries appear on a public leaderboard. Anyone can vote for them, once per brand.",
      "When qualifying ends, brands with a verified badge or a paid spot take their seats first. The most-voted free entries fill the rest.",
      "If two free entries have the same number of votes, the one that signed up first ranks higher.",
      "If not enough brands have entered when qualifying ends, qualifying runs 24 more hours. The bracket starts as soon as it's full.",
    ],
  },
  {
    id: "bracket",
    title: "The bracket",
    rules: [
      "The bracket is a knockout: usually 16 brands, so round of 16, quarterfinals, semifinals and final.",
      "Matchups are 1v1. We never pair you with a direct competitor. In round 1 we look for a brand whose audience could also like yours. After that, winners meet winners.",
      "Every matchup in a round runs for the same set time, shown on the matchup page. The next round starts when every matchup of the round has closed.",
      "When a matchup closes, the brand with more votes moves on. The other brand is out.",
      "If a seat is empty, the brand in that matchup moves on without a vote (a bye).",
    ],
  },
  {
    id: "ties",
    title: "Ties",
    rules: [
      "If both brands have the same number of votes when the matchup closes, the brand that reached that score first wins. In other words: the brand whose last vote came in earlier.",
      "If the matchup ends 0:0, the brand that signed up for the tournament first wins.",
      "A matchup never ends in a draw. There is always a winner.",
    ],
  },
  {
    id: "voting",
    title: "Voting",
    rules: [
      "Every visitor gets one vote per matchup. No sign-up needed. Votes can't be changed once cast.",
      "With an account, you can't vote in a matchup you're part of, and you can't vote for your own brand in qualifying.",
      "Without an account, you vote as a guest: one vote per browser. A single network (for example one office or home Wi-Fi) can cast at most 3 votes per matchup.",
      "Each account and each network can cast up to 30 votes per hour.",
      "Votes only count while a matchup is open. If a tournament is paused, voting stops until it continues.",
    ],
  },
  {
    id: "fair-play",
    title: "Fair play",
    rules: [
      "Share your matchups as much as you like: with your followers, your newsletter, your community. That's how the game works.",
      "Don't use bots, scripts, vote exchanges or fake accounts, and don't pay or reward people for votes.",
      "We check votes. We can remove votes we believe are fake and correct the score of a matchup.",
      "If a brand breaks these rules, we can disqualify it from the tournament, and it loses any prize.",
    ],
  },
  {
    id: "badge",
    title: "Badge rules",
    rules: [
      "Put the badge on a page of your own site (or a subdomain), ideally in the footer.",
      "Use a normal link: no nofollow, sponsored or ugc.",
      "Also share two public posts about Backlink Arena on social accounts of your choice, and add their links in your dashboard.",
      "Keep the badge and the posts live. We may check them again at any time.",
      "If it's removed, you can lose your guaranteed spot and go back to free qualifying.",
      "A verified badge carries over: it skips qualifying in every tournament you enter while the badge is live.",
    ],
  },
  {
    id: "pass",
    title: "Guaranteed spot ($29)",
    rules: [
      "The $29 guaranteed spot skips qualifying for one tournament.",
      "It's used up once your brand gets a seat in a bracket. If you pay while no tournament is open, it applies to the next one.",
    ],
  },
  {
    id: "prizes",
    title: "Prizes",
    rules: [
      "The champion gets a backlink on a real DA 50+ website in their niche. We choose the site with you and place the link by hand.",
      "Every placed link is listed on the Winners page.",
      "Every other brand keeps the visitors and attention their matchups brought in, and sees its numbers in the dashboard.",
      "When your run ends, you get 30% off our backlink placement service for 7 days. We email it to you when your run ends, and you'll find it in your dashboard.",
      "When the final is decided, we email every brand in the tournament the result.",
    ],
  },
  {
    id: "changes",
    title: "Changes",
    rules: [
      "We may pause a tournament, or change the timing, if something goes wrong (for example a technical problem or an attack on voting).",
      "We may update these rules. Changes apply to tournaments that start after the update.",
    ],
  },
];

export default function RulesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">Official rules</p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">
        How the <span className="text-gradient">arena</span> works
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Everything that decides who gets in, who moves on and who wins. Last updated {UPDATED}.
      </p>

      <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-line bg-white/70 px-3 py-1 text-sm font-semibold hover:bg-cream"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 flex flex-col gap-4">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="card scroll-mt-20 p-5 sm:p-6">
            <h2 className="flex items-baseline gap-3 font-display text-2xl font-extrabold">
              <span className="text-gradient text-sm font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-red">
              {s.rules.map((r, k) => (
                <li key={k}>{r}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        Questions about a rule or a result? Check the <Link href="/#faq" className="font-semibold underline">FAQ</Link>{" "}
        or <Link href="/winners" className="font-semibold underline">see past winners</Link>.
      </p>
    </article>
  );
}
