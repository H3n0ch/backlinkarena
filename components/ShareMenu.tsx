"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fightWidth } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { shareLinks } from "@/lib/share";

/* Official brand marks (Simple Icons paths, 24×24). */
const ICONS = {
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.230-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.230.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
} as const;

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
