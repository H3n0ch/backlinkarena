"use client";

import { Fragment, useState, type ReactNode } from "react";

export type PagedItem = {
  key: string;
  /** Lower-cased text the search box matches against (name, domain, owner…). */
  text: string;
  /** Tab tags this row belongs to, e.g. ["pass", "new"]. */
  tags: string[];
  node: ReactNode;
};

/**
 * Client-side tabs + search + pagination around server-rendered rows.
 * Keeps the order it is given, so ranked lists stay ranked.
 */
export function PagedList({
  items,
  tabs = [],
  defaultTab = "all",
  pageSize = 25,
  layout = "list",
  head,
  tableClassName = "w-full min-w-[760px] text-left text-sm",
  empty = "Nothing here.",
}: {
  items: PagedItem[];
  /** Extra tabs besides "All". */
  tabs?: { tag: string; label: string }[];
  defaultTab?: string;
  pageSize?: number;
  layout?: "list" | "table";
  head?: ReactNode;
  tableClassName?: string;
  empty?: string;
}) {
  const [tab, setTab] = useState(defaultTab);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const query = q.trim().toLowerCase();
  const inTab = tab === "all" ? items : items.filter((i) => i.tags.includes(tab));
  const shown = query ? inTab.filter((i) => i.text.includes(query)) : inTab;
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const p = Math.min(page, pages - 1);
  const slice = shown.slice(p * pageSize, (p + 1) * pageSize);

  const allTabs = [{ tag: "all", label: "All" }, ...tabs];
  const count = (tag: string) => (tag === "all" ? items.length : items.filter((i) => i.tags.includes(tag)).length);
  const pick = (t: string) => {
    setTab(t);
    setPage(0);
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      {(tabs.length > 0 || items.length > pageSize) && (
        <div className="flex flex-wrap items-center gap-2">
          {tabs.length > 0 &&
            allTabs.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => pick(t.tag)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  tab === t.tag ? "border-ink bg-ink text-white" : "border-line bg-card"
                }`}
              >
                {t.label} <span className="opacity-60">{count(t.tag)}</span>
              </button>
            ))}
          <input
            type="search"
            className="field ml-auto w-full max-w-xs py-1! text-sm"
            placeholder="Search name, domain, owner…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
      )}

      {slice.length === 0 ? (
        <p className="text-sm text-muted">{query ? "No match for that search." : empty}</p>
      ) : layout === "table" ? (
        <div className="overflow-x-auto">
          <table className={tableClassName}>
            {head}
            <tbody>{slice.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</tbody>
          </table>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line/40">{slice.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">
            {p * pageSize + 1}–{Math.min(shown.length, (p + 1) * pageSize)} of {shown.length}
          </span>
          <div className="flex gap-1">
            <button type="button" className="btn bg-card px-3! py-1! text-xs" disabled={p === 0} onClick={() => setPage(p - 1)}>
              ← Prev
            </button>
            <span className="px-2 py-1 font-mono text-xs">
              {p + 1}/{pages}
            </span>
            <button
              type="button"
              className="btn bg-card px-3! py-1! text-xs"
              disabled={p >= pages - 1}
              onClick={() => setPage(p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

