"use client";

import { useEffect, useState } from "react";

/** DD : HH : MM : SS in boxes, like a scoreboard clock. */
export function CountdownBoxes({ to, label }: { to: string; label: string }) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const left = now === null ? null : Math.max(0, target - now);
  const s = left === null ? 0 : Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: "days" },
    { v: Math.floor((s % 86400) / 3600), l: "hours" },
    { v: Math.floor((s % 3600) / 60), l: "mins" },
    { v: s % 60, l: "secs" },
  ];

  return (
    <div className="text-right">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="flex items-start gap-1">
        {parts.map((p, i) => (
          <div key={p.l} className="flex items-start gap-1">
            {i > 0 && <span className="font-mono text-lg font-bold leading-8">:</span>}
            <div className="text-center">
              <span className="block min-w-9 rounded-md bg-dark-gradient px-1.5 font-mono text-lg font-bold leading-8 text-white tabular-nums">
                {left === null ? "--" : String(p.v).padStart(2, "0")}
              </span>
              <span className="text-[9px] font-semibold uppercase text-muted">{p.l}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
