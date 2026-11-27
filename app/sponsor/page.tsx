import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PREMIUM_FRAME } from "@/components/premium";
import { getArenaStats } from "@/lib/data";
import { SPONSOR_PAYMENTS_CONFIGURED } from "@/lib/payments";
import { SPONSOR_PRICE } from "@/lib/sponsor-offer";
import { SponsorForm } from "./SponsorForm";

export const metadata: Metadata = {
  title: "Sponsor a tournament",
  description: `Put your product in front of every founder competing in a Backlink Arena tournament. ${SPONSOR_PRICE} per tournament, one sponsor at a time.`,
  alternates: { canonical: "/sponsor" },
};

const PERKS = [
  {
    t: "Every competitor sees you",
    d: "Your logo, pitch and link sit on the home page, the arena and every matchup page, where founders check their votes all tournament long.",
  },
  {
    t: "Voters see you too",
    d: "Each brand shares its matchups with its own audience. Those visitors land on pages that carry your sponsor card.",
  },
  {
    t: "The only sponsor",
    d: "One sponsor per tournament. No banner wall, no rotation: the whole slot is yours from qualifying to the final.",
  },
  {
    t: "Click stats",
    d: "We count every click on your card and send you the numbers when the tournament ends.",
  },
];

const STEPS = [
  "Fill in your brand, link and one-line pitch, then pay securely.",
  "We review it within one business day (no scams, nothing adult or illegal).",
  "It goes live in the next tournament with an open slot. We email you when it does.",
];

const FAQ = [
  {
    q: "What if you don't approve my sponsorship?",
    a: "You get a full refund. We only decline sponsors that would hurt founders: scams, adult content, gambling, or anything illegal.",
  },
  {
    q: "When does my sponsorship run?",
    a: "In the next tournament that doesn't have a sponsor yet, in the order sponsors paid. If you want a specific tournament, reply to the confirmation email.",
  },
  {
    q: "Is the link followed?",
    a: 'No. Sponsor links are marked rel="sponsored", as Google asks for paid links. You pay for attention from founders, not for link power.',
  },
  {
    q: "Can I change my pitch later?",
    a: "Yes. Reply to the confirmation email and we'll update it.",
  },
];

export default function SponsorPage({ searchParams }: PageProps<"/sponsor">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={null}>
        <StatusNotice searchParams={searchParams} />
      </Suspense>

      <section className="text-center">
        <p className="text-gradient mx-auto w-fit text-xs font-bold uppercase tracking-widest">Sponsorship</p>
        <h1 className="headline mt-2 text-4xl sm:text-6xl">
          Pitch your product to <span className="text-gradient">every founder in the arena</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Each Backlink Arena tournament is full of startup founders fighting for votes, checking their matchups every
          day. Sponsor one and your product is the one they see next to every fight.
        </p>
        <Suspense fallback={<div className="mx-auto mt-8 h-20 max-w-xl" />}>
          <Reach />
        </Suspense>
      </section>

      <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_26rem]">
        <section>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PERKS.map((p) => (
              <li key={p.t} className="card p-5">
                <p className="font-display text-lg font-extrabold leading-tight">{p.t}</p>
                <p className="mt-1 text-sm text-muted">{p.d}</p>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 font-display text-2xl font-extrabold">How it works</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="font-display font-extrabold text-red-dark">0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>

          <h2 className="mt-10 font-display text-2xl font-extrabold">Questions</h2>
          <div className="mt-4 flex flex-col gap-2">
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

        <section id="checkout" className="h-fit rounded-[0.875rem] p-6" style={PREMIUM_FRAME}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/55">One tournament</p>
          <p className="headline mt-1 text-5xl">{SPONSOR_PRICE}</p>
          <p className="mt-1 text-sm text-white/70">One-time payment. One sponsor per tournament.</p>
          <div className="mt-6 rounded-xl bg-card p-5 text-ink">
            <SponsorForm enabled={SPONSOR_PAYMENTS_CONFIGURED} />
          </div>
        </section>
      </div>

      <p className="mt-12 text-center text-sm text-muted">
        Want to compete instead? <Link href="/join" className="font-semibold underline">Enter your site for free</Link>.
      </p>
    </div>
  );
}

async function Reach() {
  const stats = await getArenaStats().catch(() => null);
  if (!stats || (!stats.sites && !stats.votes)) return null;
  const items = [
    { n: stats.sites, l: "brands entered" },
    { n: stats.votes, l: "votes cast" },
  ].filter((i) => i.n > 0);
  return (
    <ul className="mx-auto mt-8 flex max-w-xl justify-center gap-4">
      {items.map((i) => (
        <li key={i.l} className="card flex-1 px-4 py-3">
          <p className="font-display text-3xl font-extrabold">{i.n.toLocaleString("en-US")}</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{i.l}</p>
        </li>
      ))}
    </ul>
  );
}

const NOTICES: Record<string, { title: string; text: string }> = {
  success: {
    title: "Payment received, thank you!",
    text: "We'll review your sponsorship within one business day and email you when it's live.",
  },
  cancelled: { title: "Checkout cancelled", text: "Nothing was charged. You can try again below." },
  unavailable: { title: "Checkout isn't open yet", text: "Sponsorships open soon. Use the contact form in the footer to reserve a slot." },
};

async function StatusNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { status } = await searchParams;
  const n = typeof status === "string" ? NOTICES[status] : undefined;
  if (!n) return null;
  return (
    <div className={`mb-8 rounded-2xl border border-line p-4 text-sm ${status === "success" ? "bg-mint/15" : "bg-red-soft"}`}>
      <p className="font-bold">{n.title}</p>
      <p className="text-muted">{n.text}</p>
    </div>
  );
}
