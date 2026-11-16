"use client";

import { useEffect, type ReactNode } from "react";

type Event = { kind: "view"; matchId: string } | { kind: "click"; productId: string; matchId?: string };

function send(e: Event) {
  const body = JSON.stringify(e);
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
    () => {},
  );
}

/** Counts a matchup view for both brands (once per visitor per day, deduped server-side). */
export function TrackView({ matchId }: { matchId: string }) {
  useEffect(() => {
    send({ kind: "view", matchId });
  }, [matchId]);
  return null;
}

/** Counts a click through to a brand's website. */
export function trackClick(productId: string, matchId?: string) {
  send({ kind: "click", productId, matchId });
}

/** Outbound "Visit site" link that records the click. */
export function TrackedLink({
  href,
  productId,
  matchId,
  className,
  children,
}: {
  href: string;
  productId: string;
  matchId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className} onClick={() => trackClick(productId, matchId)}>
      {children}
    </a>
  );
}
