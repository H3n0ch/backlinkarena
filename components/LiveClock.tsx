"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 10_000;

/**
 * Keeps open pages in step with the tournament clock: when an admin moves a timer, a
 * match closes or the next round starts, the page re-renders with fresh data (no reload).
 * It also checks right when the next timer hits zero, so the switch shows up at once.
 */
export function LiveClock() {
  const router = useRouter();

  useEffect(() => {
    let last: string | null = null;
    let stopped = false;
    let atDeadline: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/clock", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const j = (await res.json()) as { v: string; next: number | null };
        if (last !== null && j.v !== last) router.refresh();
        last = j.v;
        clearTimeout(atDeadline);
        if (j.next) {
          const wait = j.next - Date.now() + 1500;
          if (wait > 0 && wait < POLL_MS) atDeadline = setTimeout(check, wait);
        }
      } catch {}
    }

    check();
    const id = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      clearTimeout(atDeadline);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  return null;
}
