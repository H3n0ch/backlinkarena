import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Backlink Arena collects, why, who it is shared with and how to get it deleted.",
};

const UPDATED = "November 17, 2026";

/*
 * Every point here mirrors what the code does (lib/guest.ts, app/api/track, app/actions/vote.ts,
 * app/actions/lead.ts, components/Analytics.tsx, lib/email.ts, payment providers).
 * Change the data flow → change this page.
 * When the company is set up, name the legal entity (and its address) in "Who we are".
 */

const contact = CONTACT_EMAIL ? (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
    {CONTACT_EMAIL}
  </a>
) : (
  "the contact address in the site footer"
);

type Section = { id: string; title: string; points: ReactNode[] };

const SECTIONS: Section[] = [
  {
    id: "who",
    title: "Who we are",
    points: [
      <>Backlink Arena (&quot;we&quot;, &quot;us&quot;) runs this website and the tournaments on it. We decide how your data is used and are responsible for it.</>,
      <>Questions or requests about your data: {contact}.</>,
    ],
  },
  {
    id: "collect",
    title: "What we collect",
    points: [
      "Account: your email address, and your name and profile picture if you sign in with Google. Sign-in links are sent to your email.",
      "Brands you enter: website address, name, description and logo. These are public in the arena and on your brand page.",
      "Votes: which brand you voted for in each matchup. Votes are counted publicly but never shown with your name or email.",
      "Guest voting: if you vote without an account, we set a cookie with a random ID and store a salted hash of your IP address. This stops duplicate votes. We never store your raw IP address.",
      "Visits and clicks on brand pages: counted once per visitor per day (by account ID, guest ID or hashed IP) so brand owners can see their exposure.",
      "Forms: if you request a quote or join the waitlist, we store your email, and the name, website and message you give us.",
      "Payments: whether a payment succeeded, was refunded, and its amount. Card details go straight to our payment provider. We never see or store them.",
    ],
  },
  {
    id: "use",
    title: "How we use it",
    points: [
      "To run the tournaments: show entries, count votes, seed the bracket, publish winners and place prize backlinks.",
      "To keep voting fair: detect duplicate and automated votes.",
      "To send emails you need: sign-in links, confirmation when your brand enters the arena, and replies to your requests. Payment receipts come from our payment provider.",
      "To answer quote requests and support questions.",
      "To understand how the site is used (only if analytics is on, see below) and improve it.",
      "We do not sell your data and do not use it for advertising.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and analytics",
    points: [
      "Necessary cookies: your sign-in session and the guest voting ID. The site doesn't work properly without them.",
      "Analytics: we use Google Analytics to see which pages are visited. Where consent is required, it only loads after you accept, and you can change your choice any time via \"Cookie settings\" in the footer.",
      "You can also block or delete cookies in your browser settings.",
    ],
  },
  {
    id: "sharing",
    title: "Who we share it with",
    points: [
      "Supabase (database and sign-in), Netlify (hosting), Resend (email), Google (sign-in and analytics) and Dodo Payments (payments, acting as merchant of record). Each only gets what it needs to provide its service to us.",
      "Authorities, if the law requires it.",
      "A buyer or successor, if Backlink Arena is sold or merged. This policy would still apply to your data.",
      "Some of these providers process data outside the EU. Where they do, they rely on safeguards such as the EU Standard Contractual Clauses.",
    ],
  },
  {
    id: "retention",
    title: "How long we keep it",
    points: [
      "Account and brand data: until you delete your account or ask us to.",
      "Votes and tournament results: as long as the tournament results are published, without personal details once your account is deleted.",
      "Payment records: as long as tax and accounting law requires.",
      "When you ask us to delete your account, we do so within 30 days, except data we must keep by law.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    points: [
      "You can ask for a copy of your data, have it corrected or deleted, object to or restrict how we use it, and take it elsewhere.",
      <>Email {contact} from the address linked to your account, so we can confirm it&apos;s you. We reply within 30 days.</>,
      "If you're in the EU or UK and think we've mishandled your data, you can complain to your local data protection authority.",
    ],
  },
  {
    id: "security",
    title: "Security",
    points: [
      "Data is sent over HTTPS, access to the database is restricted per user, and IP addresses are only stored as salted hashes.",
      "No system is perfectly secure. If a breach affects your data, we'll tell you as the law requires.",
    ],
  },
  {
    id: "children",
    title: "Children",
    points: ["Backlink Arena is not meant for anyone under 16, and we don't knowingly collect their data."],
  },
  {
    id: "changes",
    title: "Changes",
    points: [
      "If we change this policy, we update the date at the top. For significant changes, we'll also tell you by email or on the site.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">Privacy policy</p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">
        Your data in the <span className="text-gradient">arena</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        What we collect, why, and how to get it deleted. Last updated {UPDATED}.
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
              {s.points.map((p, k) => (
                <li key={k}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        See also the <Link href="/rules" className="font-semibold underline">official rules</Link>.
      </p>
    </article>
  );
}
