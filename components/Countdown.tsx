"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

export function Countdown({ to, endedText = "Ended" }: { to: string; endedText?: string }) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Initial tick deferred to the timer so render stays pure.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (now === null) return <span className="tabular-nums">…</span>;
  const left = target - now;
  return <span className="tabular-nums">{left > 0 ? formatDuration(left) : endedText}</span>;
}
