"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fightWidth } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { BRAND_ICONS as ICONS } from "@/lib/brand-icons";
import { shareLinks } from "@/lib/share";

export type ShareSide = { name: string; logo: string | null; votes: number };

function Brand({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Line({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Mini version of the matchup card, so people see exactly what they're sharing. */
function Preview({ a, b }: { a: ShareSide; b: ShareSide }) {
  const total = a.votes + b.votes;
  const pct = total ? (a.votes / total) * 100 : 50;
  const side = (s: ShareSide, color: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <div className="rounded-2xl bg-white p-0.5 shadow-lg ring-1 ring-white/20">
        <ProductLogo src={s.logo} name={s.name} size={52} className="border-0!" />
      </div>
      <p className="w-full truncate text-sm font-bold text-white">{s.name}</p>
      <p className={`font-display text-xl leading-none font-black tabular-nums ${color}`}>{s.votes}</p>
    </div>
  );
  return (
    <div className="relative rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        {side(a, "text-amber-300")}
        <span className="flex size-11 shrink-0 -rotate-6 items-center justify-center rounded-full bg-[image:var(--grad-brand)] font-display text-base font-black text-white italic shadow-[0_6px_18px_-4px_rgb(234_88_12/0.8)] ring-4 ring-[#1c1917]">
          VS
        </span>
        {side(b, "text-teal-300")}
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[linear-gradient(90deg,#22c55e,#14b8a6_45%,#0ea5e9_75%,#2563eb)]">
        <div className="h-full border-r-2 border-[#1c1917] bg-[linear-gradient(90deg,#fbbf24,#f97316_45%,#ea580c_70%,#e11d48)]" style={{ width: `${fightWidth(pct)}%` }} />
      </div>
    </div>
  );
}

/** "Share" button that opens a designed share sheet (modal on desktop, bottom sheet on mobile). */
export function ShareMenu({
  link,
  a,
  b,
  label = "Share",
  className = "btn border-red/40 bg-red-soft py-1.5! px-3! text-sm text-red-dark",
}: {
  link: string;
  a?: ShareSide;
  b?: ShareSide;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const [canNative, setCanNative] = useState(false);
  const s = shareLinks(link);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setCanNative("share" in navigator), 0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function doCopy(kind: "link" | "text") {
    try {
      await navigator.clipboard.writeText(kind === "link" ? link : s.text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: the link stays visible to copy by hand */
    }
  }

  const networks = [
    { name: "X", href: s.x, d: ICONS.x, bg: "bg-black", glow: "hover:shadow-white/20" },
    { name: "WhatsApp", href: s.whatsapp, d: ICONS.whatsapp, bg: "bg-[#25D366]", glow: "hover:shadow-[#25D366]/50" },
    { name: "LinkedIn", href: s.linkedin, d: ICONS.linkedin, bg: "bg-[#0A66C2]", glow: "hover:shadow-[#0A66C2]/50" },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      d: ICONS.facebook,
      bg: "bg-[#1877F2]",
      glow: "hover:shadow-[#1877F2]/50",
    },
    {
      name: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(s.text.replace(` ${link}`, ""))}`,
      d: ICONS.telegram,
      bg: "bg-[#26A5E4]",
      glow: "hover:shadow-[#26A5E4]/50",
    },
  ];
  const display = link.replace(/^https?:\/\//, "");

  const sheet = (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="animate-fade-in absolute inset-0 cursor-default bg-[#0c0a09]/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share this matchup"
        className="animate-share-in relative w-full max-w-md rounded-t-[2rem] bg-[image:var(--grad-brand)] p-px pb-0 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] sm:rounded-[2rem] sm:pb-px"
      >
        <div className="relative overflow-hidden rounded-t-[calc(2rem-1px)] bg-dark-gradient px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-left text-white sm:rounded-[calc(2rem-1px)] sm:p-6">
          {/* Decorative glows + grain-like grid */}
          <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-orange-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-56 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

          {/* Grab handle (mobile) */}
          <div className="relative mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-amber-300 uppercase ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_2px] shadow-amber-300/60" />
                Rally your votes
              </span>
              <h2 className="mt-2.5 font-display text-2xl leading-tight font-extrabold">
                Share this <span className="text-gradient italic">battle</span>
              </h2>
              <p className="mt-1 text-sm text-white/60">Every share brings new voters. One click can swing it.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:rotate-90 hover:bg-white/15 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <Line size={16}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </Line>
            </button>
          </div>

          {a && b && (
            <div className="relative mt-5">
              <Preview a={a} b={b} />
            </div>
          )}

          {/* Networks */}
          <p className="relative mt-5 text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">Share to</p>
          <div className="relative mt-2.5 grid grid-cols-5 gap-2">
            {networks.map((n) => (
              <a
                key={n.name}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-2xl ${n.bg} text-white shadow-lg ring-1 ring-white/15 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl ${n.glow}`}
                >
                  <Brand d={n.d} size={22} />
                </span>
                <span className="text-[11px] font-semibold text-white/65 transition group-hover:text-white">{n.name}</span>
              </a>
            ))}
          </div>

          {/* Link + copy */}
          <p className="relative mt-5 text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">Or copy the link</p>
          <div className="relative mt-2.5 flex items-center gap-2 rounded-2xl bg-black/30 p-1.5 pl-3.5 ring-1 ring-white/10 focus-within:ring-amber-300/60">
            <span className="text-white/50">
              <Line size={16}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </Line>
            </span>
            <input
              readOnly
              value={display}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Matchup link"
              className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-white/85 outline-none"
            />
            <button
              type="button"
              onClick={() => doCopy("link")}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition active:scale-95 ${
                copied === "link"
                  ? "bg-mint shadow-[0_6px_18px_-6px_rgb(22_163_74/0.8)]"
                  : "bg-[image:var(--grad-brand)] shadow-[0_6px_18px_-6px_rgb(234_88_12/0.8)] hover:brightness-110"
              }`}
            >
              {copied === "link" ? "✓ Copied!" : "Copy link"}
            </button>
          </div>

          <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs">
            <button
              type="button"
              onClick={() => doCopy("text")}
              className="inline-flex items-center gap-1.5 font-semibold text-white/65 transition hover:text-white"
            >
              <Line size={14}>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </Line>
              {copied === "text" ? "✓ Post text copied" : "Copy ready-made post"}
            </button>
            {canNative && (
              <button
                type="button"
                onClick={() => navigator.share({ url: link, text: s.text }).catch(() => {})}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white/90 ring-1 ring-white/10 transition hover:bg-white/20"
              >
                More apps
                <Line size={12}>
                  <polyline points="9 18 15 12 9 6" />
                </Line>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Line size={14}>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </Line>
        {label}
      </button>
      {open && createPortal(sheet, document.body)}
    </>
  );
}
