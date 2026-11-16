"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const DEFAULT_SLIDE = "w-[88%] sm:w-[70%] md:w-[calc(50%-0.5rem)]";

/** Horizontal, swipeable row of cards with arrows and dots. */
export function MatchCarousel({
  children,
  slideClassName = DEFAULT_SLIDE,
  itemLabel = "Matchup",
}: {
  children: ReactNode;
  /** Width classes for each slide. */
  slideClassName?: string;
  /** Used in the arrow and dot labels ("Previous matchup", "Matchup 2"). */
  itemLabel?: string;
}) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: slides.length <= 1 });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const left = el.scrollLeft;
    let best = 0;
    items.forEach((item, i) => {
      if (Math.abs(item.offsetLeft - el.offsetLeft - left) < Math.abs(items[best].offsetLeft - el.offsetLeft - left)) best = i;
    });
    setIndex(best);
    setEdges({ start: left <= 4, end: left + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  function go(i: number) {
    const el = track.current;
    const item = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (el && item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-900/90 text-xl font-bold text-amber-200 shadow-lg ring-1 ring-amber-300/40 backdrop-blur transition hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={update}
        className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-3 pb-2 [scrollbar-width:none] sm:-mx-4 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={i} className={`shrink-0 snap-start ${slideClassName}`}>
            {s}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button type="button" aria-label={`Previous ${itemLabel.toLowerCase()}`} className={`${arrow} -left-3`} onClick={() => go(index - 1)} disabled={edges.start}>
            ‹
          </button>
          <button type="button" aria-label={`Next ${itemLabel.toLowerCase()}`} className={`${arrow} -right-3`} onClick={() => go(index + 1)} disabled={edges.end}>
            ›
          </button>
          <div className="mt-4 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${itemLabel} ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-amber-500" : "w-1.5 bg-stone-300 hover:bg-stone-400"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
