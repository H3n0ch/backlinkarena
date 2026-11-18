"use client";

import { Children, useRef, useState, type ReactNode } from "react";

/** Shows a long list a page at a time, like flipping through a book. */
export function PagedList({ children, pageSize = 20 }: { children: ReactNode; pageSize?: number }) {
  const items = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const top = useRef<HTMLOListElement>(null);
  const current = Math.min(page, pages);

  function go(p: number) {
    setPage(p);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <ol ref={top} className="flex scroll-mt-24 flex-col gap-2">
        {items.slice((current - 1) * pageSize, current * pageSize)}
      </ol>
      {pages > 1 && (
        <nav aria-label="Leaderboard pages" className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 1}
            className="btn bg-card px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-current={p === current ? "page" : undefined}
              className={`h-9 min-w-9 rounded-full px-2 text-sm font-bold tabular-nums transition ${
                p === current ? "bg-[image:var(--grad-brand)] text-white shadow" : "bg-card ring-1 ring-line hover:bg-cream"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === pages}
            className="btn bg-card px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </>
  );
}
