"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type Dot = { dx: number; dy: number; color: string; size: number; delay: number };
type Burst = { id: number; x: number; y: number; color: string; dots: Dot[] };

const DOTS = 14;
const LIFETIME_MS = 1000;
const GOLD = "#fbbf24";

let nextId = 0;

/**
 * Celebration when a vote lands: a ring, confetti dots and a floating "+1" from the button.
 * Drawn in a fixed portal so the button's `overflow: hidden` can't clip it.
 * Hidden entirely for prefers-reduced-motion (see .vote-burst in globals.css).
 *
 *   const { fire, bursts } = useVoteBurst();
 *   fire(buttonRect, "#f97316");   // after the vote is counted
 *   return <>{button}{bursts}</>;
 */
export function useVoteBurst() {
  const [list, setList] = useState<Burst[]>([]);

  const fire = useCallback((rect: DOMRect, color: string) => {
    const id = nextId++;
    const dots: Dot[] = Array.from({ length: DOTS }, (_, i) => {
      const angle = (i / DOTS) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 46 + Math.random() * 42;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: i % 3 === 0 ? GOLD : color,
        size: 5 + Math.round(Math.random() * 5),
        delay: Math.round(Math.random() * 60),
      };
    });
    const burst = { id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, color, dots };
    setList((l) => [...l, burst]);
    setTimeout(() => setList((l) => l.filter((b) => b.id !== id)), LIFETIME_MS);
  }, []);

  const bursts =
    list.length > 0 && typeof document !== "undefined"
      ? createPortal(
          list.map((b) => (
            <span
              key={b.id}
              aria-hidden="true"
              className="vote-burst"
              style={{ left: b.x, top: b.y, "--c": b.color } as CSSProperties}
            >
              <span className="vote-burst-ring" />
              {b.dots.map((d, i) => (
                <span
                  key={i}
                  className="vote-burst-dot"
                  style={
                    {
                      "--dx": `${d.dx}px`,
                      "--dy": `${d.dy}px`,
                      "--dc": d.color,
                      width: d.size,
                      height: d.size,
                      animationDelay: `${d.delay}ms`,
                    } as CSSProperties
                  }
                />
              ))}
              <span className="vote-burst-plus">+1</span>
            </span>
          )),
          document.body,
        )
      : null;

  return { fire, bursts };
}
