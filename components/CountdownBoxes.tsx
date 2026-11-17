"use client";

import { useEffect, useState } from "react";

/** DD : HH : MM : SS in glass boxes, sized for the dark bracket header. Frozen while `pausedAt` is set. */
export function CountdownBoxes({ to, label, pausedAt = null }: { to: string; label: string; pausedAt?: string | null }) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (pausedAt) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [pausedAt]);

  const at = pausedAt ? Date.parse(pausedAt) : now;
  const left = at === null ? null : Math.max(0, target - at);
  const s = left === null ? 0 : Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: "days" },
    { v: Math.floor((s % 86400) / 3600), l: "hrs" },
    { v: Math.floor((s % 3600) / 60), l: "min" },
    { v: s % 60, l: "sec" },
  ];

  return (
    <div className="sm:text-right">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{pausedAt ? `${label} · Paused` : label}</p>
      <div className="flex items-start gap-1.5">
        {parts.map((p, i) => (
          <div key={p.l} className="flex items-start gap-1.5">
            {i > 0 && <span className="font-mono text-xl font-bold leading-10 text-amber-400/70">:</span>}
            <div className="text-center">
              <span className="block min-w-11 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 font-mono text-xl font-bold leading-10 text-white tabular-nums shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_8px_20px_-10px_rgb(0_0_0/0.8)]">
                {left === null ? "--" : String(p.v).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">{p.l}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
