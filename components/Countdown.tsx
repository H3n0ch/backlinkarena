"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

/** Time left until `to`. While `pausedAt` is set the clock is frozen at the time left when it was paused. */
export function Countdown({
  to,
  endedText = "Ended",
  pausedAt = null,
}: {
  to: string;
  endedText?: string;
  pausedAt?: string | null;
}) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (pausedAt) return;
    // Initial tick deferred to the timer so render stays pure.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [pausedAt]);

  if (pausedAt) {
    const left = target - Date.parse(pausedAt);
    return <span className="tabular-nums">paused · {left > 0 ? formatDuration(left) : endedText}</span>;
  }
  if (now === null) return <span className="tabular-nums">…</span>;
  const left = target - now;
  return <span className="tabular-nums">{left > 0 ? formatDuration(left) : endedText}</span>;
}
