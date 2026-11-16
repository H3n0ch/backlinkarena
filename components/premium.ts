import type { CSSProperties } from "react";

/*
  Shared "premium" dark panel: deep ink with a gold hairline border and warm glows.
  Inline styles (not CSS utilities) so the panel always renders exactly the same.
*/
export const PREMIUM_FRAME: CSSProperties = {
  border: "1px solid transparent",
  background: [
    "radial-gradient(38% 46% at 50% 52%, rgb(251 191 36 / 0.18), transparent 70%) padding-box",
    "radial-gradient(120% 80% at 100% 0%, rgb(249 115 22 / 0.22), transparent 55%) padding-box",
    "radial-gradient(90% 70% at 0% 100%, rgb(13 148 136 / 0.2), transparent 60%) padding-box",
    "linear-gradient(165deg, #1f1b19 0%, #141110 55%, #0a0807 100%) padding-box",
    "linear-gradient(135deg, rgb(253 230 138 / 0.8), rgb(255 255 255 / 0.1) 28%, rgb(255 255 255 / 0.06) 72%, rgb(249 115 22 / 0.7)) border-box",
  ].join(", "),
  boxShadow:
    "0 50px 90px -45px rgb(12 10 9 / 0.75), 0 24px 60px -40px rgb(234 88 12 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.06)",
  color: "#fafaf9",
};

/**
 * Width of side A in a vote bar, as a %. The real share (0–100) is squeezed into 25–75 so the
 * trailing side always keeps at least a quarter of the bar: it reads as a fight that can still
 * turn around, not a knockout after one vote. Show the real percentages as text next to it.
 */
export function fightWidth(pctA: number): number {
  return 25 + Math.min(100, Math.max(0, pctA)) / 2;
}

/** Metallic gold text (inline, for the same reason as above). */
export const GOLD_TEXT: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #fef3c7 0%, #fcd34d 45%, #f59e0b 75%, #b45309 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};
