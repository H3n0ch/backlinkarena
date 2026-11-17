"use client";

import { useState } from "react";
import { Countdown } from "@/components/Countdown";
import { CopyButton } from "@/components/CopyButton";
import { fightWidth, GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { ShareButtonRow } from "@/components/ShareButtons";

type Channel = "x" | "linkedin" | "friends" | "newsletter" | "community";

const CHANNELS: { id: Channel; label: string; icon: string; hint: string }[] = [
  { id: "x", label: "X / Threads", icon: "𝕏", hint: "Short and punchy. Reply to it later with the live score." },
  { id: "linkedin", label: "LinkedIn", icon: "in", hint: "Your network likes backing a founder. The link preview adds the matchup image." },
  { id: "friends", label: "Friends & team", icon: "💬", hint: "WhatsApp, Slack, Discord DMs. Personal asks convert best." },
  { id: "newsletter", label: "Newsletter", icon: "✉", hint: "One line in your next email or a quick note to your customers." },
  { id: "community", label: "Communities", icon: "#", hint: "Discord, Slack groups, forums. Keep it honest and follow each group's rules." },
];

const TIPS = [
  { t: "Post twice", d: "At the start and in the last hours. Most votes come at the end." },
  { t: "Reply with the score", d: "It pushes your post back into people's feeds." },
  { t: "Ask 5 people directly", d: "Personal messages beat public posts." },
  { t: "Say “one click”", d: "Voting needs no account. Tell people that." },
];

function standing(me: number, rival: number, rivalName: string) {
  if (me > rival) return { line: `We're ahead by ${me - rival}, help us hold on!`, chip: `▲ Ahead by ${me - rival}`, tone: "ahead" as const };
  if (me < rival)
    return {
      line: `We're ${rival - me} vote${rival - me === 1 ? "" : "s"} behind ${rivalName}.`,
      chip: `▼ ${rival - me} behind`,
      tone: "behind" as const,
    };
  return { line: "It's a tie right now. Every vote counts.", chip: "● Tied", tone: "tied" as const };
}

function messages(p: { me: string; rival: string; round: string; link: string; status: string }) {
  const { me, rival, round, link, status } = p;
  return {
    x: `🥊 ${me} vs ${rival}: ${round} on Backlink Arena. ${status} One click, no sign-up: ${link}`,
    linkedin: `We entered ${me} into Backlink Arena, a 1v1 tournament where founders battle for a DA 50+ backlink.\n\nWe're in the ${round} against ${rival}. ${status}\n\nIf you'd like to back us, it takes one click (no account needed):\n${link}\n\nThank you! 🙏`,
    friends: `Hey! Quick favor 🙏 ${me} is in a 1v1 battle on Backlink Arena (${round}) vs ${rival}. ${status} Could you vote for us? One click, no sign-up: ${link}`,
    newsletter: `P.S. We're battling ${rival} in the ${round} of Backlink Arena. ${status} If you have 5 seconds, one click helps us win: ${link}`,
    community: `Small ask: my project ${me} made the ${round} of Backlink Arena (founders battle 1v1 for a backlink). Up against ${rival}. If you want to help an indie founder, it's one click, no sign-up: ${link}`,
  } satisfies Record<Channel, string>;
}

function Logo({ src, name, side }: { src: string | null; name: string; side: "a" | "b" }) {
  const frame = side === "a" ? "from-amber-200 via-orange-400 to-rose-500" : "from-emerald-300 via-teal-400 to-sky-500";
  const glow = side === "a" ? "bg-orange-500/25" : "bg-teal-500/25";
  return (
    <div className="relative shrink-0">
      <span aria-hidden="true" className={`absolute -inset-2 rounded-3xl blur-xl ${glow}`} />
      <div className={`relative rounded-2xl bg-linear-to-br ${frame} p-0.5`}>
        <div className="rounded-[0.9rem] bg-white p-0.5">
          <ProductLogo src={src} name={name} size={52} className="rounded-xl! border-0!" />
        </div>
      </div>
    </div>
  );
}

/** Everything a brand needs to rally its audience for a live matchup. */
export function RallyKit({
  mySide,
  me,
  rival,
  myLogo,
  rivalLogo,
  round,
  link,
  endsAt,
  myVotes,
  rivalVotes,
  imageUrl,
  pausedAt = null,
}: {
  /** Which side of the matchup you are (a = left/orange, b = right/teal), as on the matchup card. */
  mySide: "a" | "b";
  me: string;
  rival: string;
  myLogo: string | null;
  rivalLogo: string | null;
  round: string;
  link: string;
  endsAt: string;
  myVotes: number;
  rivalVotes: number;
  imageUrl: string;
  /** Set while the tournament is paused: the clock freezes. */
  pausedAt?: string | null;
}) {
  const [channel, setChannel] = useState<Channel>("x");
  const s = standing(myVotes, rivalVotes, rival);
  const all = messages({ me, rival, round, link, status: s.line });
  const text = all[channel];
  const active = CHANNELS.find((c) => c.id === channel)!;
  const total = myVotes + rivalVotes;
  // Same order and colors as the matchup card: side A left (orange), side B right (teal).
  const A = mySide === "a"
    ? { name: me, logo: myLogo, votes: myVotes, label: "You" }
    : { name: rival, logo: rivalLogo, votes: rivalVotes, label: "Rival" };
  const B = mySide === "a"
    ? { name: rival, logo: rivalLogo, votes: rivalVotes, label: "Rival" }
    : { name: me, logo: myLogo, votes: myVotes, label: "You" };
  const pct = total ? (A.votes / total) * 100 : 50;
  const chipTone =
    s.tone === "ahead"
      ? "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30"
      : s.tone === "behind"
        ? "bg-rose-400/15 text-rose-300 ring-rose-300/30"
        : "bg-white/10 text-white/80 ring-white/20";

  return (
    <div className="relative mt-5 overflow-hidden rounded-[1.25rem]" style={PREMIUM_FRAME}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <span className="text-[10px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">Rally your audience · {round}</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 py-1 pr-3 pl-2.5 text-[10px] font-semibold tracking-[0.14em] text-emerald-300 uppercase">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
          <span className="font-mono tracking-normal text-white/80 tabular-nums normal-case">
            <Countdown to={endsAt} endedText="ending" pausedAt={pausedAt} />
          </span>
        </span>
      </div>

      {/* Scoreboard */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo src={A.logo} name={A.name} side="a" />
          <div className="min-w-0">
            <p className={`truncate text-[10px] font-semibold tracking-[0.18em] uppercase ${A.label === "You" ? "text-amber-200" : "text-white/45"}`}>{A.label}</p>
            <p className="truncate font-display text-base font-extrabold text-white sm:text-lg">{A.name}</p>
            <p className="font-display text-2xl font-black leading-none text-amber-300 tabular-nums">{A.votes}</p>
          </div>
        </div>
        <span className="relative flex size-11 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#fde68a,#f59e0b,#fff7ed,#b45309,#fde68a)] p-px">
            <span className="block size-full rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0c0a09)]" />
          </span>
          <span className="relative font-display text-sm font-black italic" style={GOLD_TEXT}>
            VS
          </span>
        </span>
        <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right">
          <Logo src={B.logo} name={B.name} side="b" />
          <div className="min-w-0">
            <p className={`truncate text-[10px] font-semibold tracking-[0.18em] uppercase ${B.label === "You" ? "text-teal-200" : "text-white/45"}`}>{B.label}</p>
            <p className="truncate font-display text-base font-extrabold text-white sm:text-lg">{B.name}</p>
            <p className="font-display text-2xl font-black leading-none text-teal-300 tabular-nums">{B.votes}</p>
          </div>
        </div>
      </div>

      {/* Tug of war */}
      <div className="mt-4 px-5">
        <div className="relative h-2">
          <div className="flex h-full overflow-hidden rounded-full ring-1 ring-white/10">
            <div className="h-full bg-linear-to-r from-amber-300 via-orange-500 to-rose-500" style={{ width: `${fightWidth(pct)}%` }} />
            <div className="h-full flex-1 bg-linear-to-r from-teal-400 to-sky-500" />
          </div>
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_3px_rgb(255_255_255/0.55),0_0_22px_6px_rgb(251_191_36/0.4)] ring-2 ring-stone-950"
            style={{ left: `${fightWidth(pct)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${chipTone}`}>{s.chip}</span>
          <span className="text-sm text-white/70">
            {rival} is sharing this with <em>their</em> audience right now. Rally yours.
          </span>
        </div>
      </div>

      {/* Message builder */}
      <div className="mt-5 border-t border-white/10 bg-black/25 px-5 py-5">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-amber-200/70 uppercase">1 · Where do you post?</p>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                channel === c.id
                  ? "bg-linear-to-b from-amber-200 via-amber-400 to-amber-600 text-stone-950 shadow-[0_6px_16px_-8px_rgb(251_191_36/0.9)]"
                  : "bg-white/5 text-white/75 ring-1 ring-white/10 hover:bg-white/10"
              }`}
            >
              <span aria-hidden="true" className="font-bold">
                {c.icon}
              </span>
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/50">{active.hint}</p>

        <p className="mt-5 text-[10px] font-semibold tracking-[0.22em] text-amber-200/70 uppercase">2 · Copy your post</p>
        {/* Post preview */}
        <div className="mt-2 rounded-2xl bg-white p-4 text-stone-900 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.9)]">
          <div className="flex items-center gap-2.5">
            <ProductLogo src={myLogo} name={me} size={36} className="rounded-full!" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">{me}</p>
              <p className="text-xs text-stone-500">{active.label} · now</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-line">{text}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton
            text={text}
            label="Copy post"
            className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-amber-200 via-amber-400 to-amber-600 px-5 py-2 text-sm font-bold text-stone-950 shadow-[0_8px_20px_-8px_rgb(251_191_36/0.8),inset_0_1px_0_rgb(255_255_255/0.5)] transition hover:brightness-110"
          />
          <a
            href={imageUrl}
            download="matchup.png"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
          >
            ↓ Matchup image
          </a>
        </div>

        <p className="mt-5 text-[10px] font-semibold tracking-[0.22em] text-amber-200/70 uppercase">3 · Or share in one click</p>
        <div className="mt-2">
          <ShareButtonRow link={link} text={all.friends} />
        </div>
        <p className="mt-2 text-xs text-white/45">LinkedIn doesn&apos;t prefill text, so copy your post first.</p>
      </div>

      {/* Tips */}
      <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
        {TIPS.map((t, i) => (
          <div key={t.t} className="bg-[#120f0e] px-4 py-3">
            <p className="text-xs font-bold text-white">
              <span className="mr-1.5 font-display" style={GOLD_TEXT}>
                {i + 1}
              </span>
              {t.t}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/50">{t.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
