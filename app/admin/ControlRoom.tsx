"use client";

import { useState } from "react";
import { disqualifyEntry, placeInSeat, removeFromSeat } from "@/app/actions/control";
import { ProductLogo } from "@/components/ProductLogo";
import { useAction } from "./AdminForms";

export type SeatBrand = {
  entryId: string;
  name: string;
  domain: string;
  logo: string | null;
  path: "free" | "badge" | "pass";
  votes: number;
  category: string | null;
};

const PATH_CHIP: Record<SeatBrand["path"], string> = {
  pass: "bg-mint-soft text-mint",
  badge: "bg-blue-soft text-blue",
  free: "bg-paper text-muted",
};
const PATH_LABEL: Record<SeatBrand["path"], string> = { pass: "Paid", badge: "Badge", free: "Free" };

export function PathChip({ path }: { path: SeatBrand["path"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${PATH_CHIP[path]}`}>
      {PATH_LABEL[path]}
    </span>
  );
}

/** One bracket seat: shows the brand, or a picker to place someone from the waiting list. */
export function Seat({
  seat,
  brand,
  waiting,
  editable,
}: {
  seat: number;
  brand: SeatBrand | null;
  waiting: SeatBrand[];
  editable: boolean;
}) {
  const { pending, run, note } = useAction();
  const [pick, setPick] = useState("");

  if (brand) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-2">
          <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-muted">{seat}</span>
          <ProductLogo src={brand.logo} name={brand.name} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{brand.name}</p>
            <p className="truncate text-[11px] text-muted">
              {brand.domain}
              {brand.category && <span className="ml-1 rounded bg-blue-soft px-1 text-blue">{brand.category}</span>}
            </p>
          </div>
          <PathChip path={brand.path} />
          {editable && (
            <button
              title="Back to the waiting list"
              className="rounded-lg px-1.5 text-lg leading-none text-muted hover:bg-red-soft hover:text-red"
              disabled={pending}
              onClick={() => run(() => removeFromSeat(brand.entryId))}
            >
              ×
            </button>
          )}
        </div>
        {note}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-paper/60 p-2">
        <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-muted">{seat}</span>
        {editable && waiting.length ? (
          <>
            <select className="field min-w-0 flex-1 py-1! text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Empty · pick a brand…</option>
              {waiting.map((w) => (
                <option key={w.entryId} value={w.entryId}>
                  {PATH_LABEL[w.path]} · {w.name}
                  {w.category ? ` · ${w.category}` : ""} ({w.votes} votes)
                </option>
              ))}
            </select>
            <button
              className="btn bg-ink px-3! py-1! text-xs text-white"
              disabled={!pick || pending}
              onClick={() => run(() => placeInSeat(pick, seat))}
            >
              {pending ? "…" : "Place"}
            </button>
          </>
        ) : (
          <span className="text-sm text-muted">Empty</span>
        )}
      </div>
      {note}
    </div>
  );
}

/** Disqualify with a reason (asked in a prompt). */
export function DqButton({ entryId, name, label = "Disqualify" }: { entryId: string; name: string; label?: string }) {
  const { pending, run, note } = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className="btn bg-red-soft px-3! py-1! text-xs"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt(`Disqualify ${name}? Reason (shown only to admins):`, "");
          if (reason === null) return;
          run(() => disqualifyEntry(entryId, reason));
        }}
      >
        {pending ? "…" : label}
      </button>
      {note}
    </span>
  );
}

/** Normalised niche for comparing two brands. */
