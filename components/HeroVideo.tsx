"use client";

import { useEffect, useState } from "react";

const VIDEO_ID = "LYfKrJJwdMI";
const THUMB = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

/**
 * Floating "watch the demo" card next to the hero. It sits outside the hero's
 * layout flow (absolute on wide screens, a fixed pill on small ones), so the
 * hero itself is untouched. Clicking opens a YouTube player in a modal.
 */
export function HeroVideo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Wide screens: floating card to the right of the hero */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch the Backlink Arena demo video"
        className="group absolute top-28 left-full z-10 ml-6 hidden w-60 rotate-3 cursor-pointer overflow-hidden rounded-2xl border border-white/60 bg-white p-1.5 text-left shadow-[0_20px_50px_-12px_rgb(234_88_12/0.45)] transition duration-300 hover:-translate-y-1 hover:rotate-0 xl:block"
      >
        <span className="relative block aspect-video overflow-hidden rounded-xl bg-cream">
          <img src={THUMB} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />
          <span className="absolute inset-0 bg-black/15 transition group-hover:bg-black/5" />
          <PlayBadge className="absolute inset-0 m-auto size-12" />
        </span>
        <span className="flex items-center justify-between px-1.5 pt-2 pb-1 text-xs font-bold">
          <span>See how it works</span>
          <span className="text-red">▶ Watch</span>
        </span>
      </button>

      {/* Smaller screens: compact floating pill, bottom-right */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch the Backlink Arena demo video"
        className="fixed right-4 bottom-4 z-40 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/60 bg-white/90 py-1.5 pr-4 pl-1.5 text-sm font-bold shadow-lg backdrop-blur xl:hidden"
      >
        <PlayBadge className="size-8" />
        Watch demo
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Backlink Arena demo video"
          onClick={() => setOpen(false)}
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute -top-11 right-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 text-lg font-bold text-white hover:bg-white/20"
            >
              ✕
            </button>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="Backlink Arena demo"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="size-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlayBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-lg ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 size-1/2">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}
