import { ImageResponse } from "next/og";
import { fightWidth } from "@/components/premium";

export const OG_SIZE = { width: 1200, height: 630 };

const DISPLAY = "Archivo";
const GOLD = "linear-gradient(180deg, #fef3c7 0%, #fcd34d 42%, #f59e0b 72%, #b45309 100%)";
const SIDE = {
  a: { color: "#f97316", glow: "rgb(249 115 22 / 0.55)", bar: "linear-gradient(90deg, #c2410c, #f97316 70%, #fdba74)" },
  b: { color: "#14b8a6", glow: "rgb(20 184 166 / 0.5)", bar: "linear-gradient(90deg, #5eead4, #14b8a6 30%, #0f766e)" },
};

/* ---------- fonts (Archivo, same as the site's display face) ---------- */

type OgFont = { name: string; data: ArrayBuffer; weight: 800 | 900; style: "normal" | "italic" };
let fontsPromise: Promise<OgFont[]> | null = null;

async function loadFont(axis: string): Promise<ArrayBuffer> {
  // No browser user agent → Google serves plain TTF, which Satori can read.
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:${axis}`).then((r) => r.text());
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error("font url not found");
  return fetch(url).then((r) => r.arrayBuffer());
}

/** Loads once per server instance; falls back to the default font if Google is unreachable. */
export function getFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([loadFont("ital,wght@1,900"), loadFont("wght@800")])
    .then(([black, bold]): OgFont[] => [
      { name: DISPLAY, data: black, weight: 900, style: "italic" },
      { name: DISPLAY, data: bold, weight: 800, style: "normal" },
    ])
    .catch(() => {
      fontsPromise = null; // retry next time
      return [];
    });
  return fontsPromise;
}

/* ---------- pieces ---------- */

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function nameSize(name: string) {
  if (name.length <= 9) return 56;
  if (name.length <= 13) return 44;
  if (name.length <= 16) return 36;
  return 30;
}

function Logo({ src, name, side }: { src: string | null; name: string; side: "a" | "b" }) {
  const s = SIDE[side];
  return (
    <div
      style={{
        display: "flex",
        padding: 5,
        borderRadius: 41,
        background: `linear-gradient(145deg, #fde68a, ${s.color} 55%, #451a03)`,
        boxShadow: `0 0 70px 6px ${s.glow}, 0 30px 50px -20px rgb(0 0 0 / 0.9)`,
      }}
    >
      {src ? (
        <div
          style={{
            display: "flex",
            width: 160,
            height: 160,
            borderRadius: 36,
            background: "white",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img src={src} width={124} height={124} style={{ objectFit: "contain" }} alt="" />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            width: 160,
            height: 160,
            borderRadius: 36,
            background: `linear-gradient(160deg, ${s.color}, #1c1917)`,
            color: "white",
            fontFamily: DISPLAY,
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 92,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {name === "TBD" ? "?" : name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

type Fighter = { name: string; logo: string | null; votes: number; pct: number; won: boolean; lost: boolean };

function FighterCol({ f, side }: { f: Fighter; side: "a" | "b" }) {
  const s = SIDE[side];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 400,
        opacity: f.lost ? 0.45 : 1,
      }}
    >
      <div style={{ display: "flex", position: "relative" }}>
        <Logo src={f.logo} name={f.name} side={side} />
        {f.won && (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: -18,
              left: 0,
              right: 0,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                background: GOLD,
                color: "#1c1917",
                borderRadius: 999,
                padding: "6px 20px",
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontStyle: "italic",
                fontSize: 22,
                letterSpacing: 3,
                boxShadow: "0 8px 24px -6px rgb(251 191 36 / 0.9)",
              }}
            >
              WINNER
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 22,
          height: 62,
          maxWidth: 400,
          alignItems: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontStyle: "italic",
          fontSize: nameSize(f.name),
          letterSpacing: -1,
          color: "#fafaf9",
          textTransform: "uppercase",
          textShadow: `0 4px 30px ${s.glow}`,
        }}
      >
        {clip(f.name, 20)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 0,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: 2,
          color: s.color,
        }}
      >
        {f.votes.toLocaleString("en-US")} {f.votes === 1 ? "VOTE" : "VOTES"}
      </div>
    </div>
  );
}

/* ---------- image ---------- */


export type MatchCardData = {
  a: { id: string | null; name: string; logo: string | null; votes: number };
  b: { id: string | null; name: string; logo: string | null; votes: number };
  closed: boolean;
  winnerId: string | null;
  round: string;
  tournament: string;
  host: string;
};

/** Pure renderer: no data access, so it can be previewed with mock data. */
export async function drawMatchImage(d: MatchCardData) {
  const fonts = await getFonts();
  const total = d.a.votes + d.b.votes;
  const pctA = total ? Math.round((d.a.votes / total) * 100) : 50;
  const closed = d.closed;
  const winner = closed ? d.winnerId : null;
  const aWon = !!winner && winner === d.a.id;
  const bWon = !!winner && winner === d.b.id;

  const A: Fighter = { name: d.a.name, logo: d.a.logo, votes: d.a.votes, pct: pctA, won: aWon, lost: bWon };
  const B: Fighter = { name: d.b.name, logo: d.b.logo, votes: d.b.votes, pct: 100 - pctA, won: bWon, lost: aWon };
  const { round, tournament, host } = d;
  const barA = fightWidth(pctA);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 18,
          background: "#070505",
          fontFamily: fonts.length ? DISPLAY : "sans-serif",
        }}
      >
        {/* gold hairline frame */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: 2,
            borderRadius: 34,
            background:
              "linear-gradient(135deg, #fde68a, rgb(255 255 255 / 0.12) 26%, rgb(255 255 255 / 0.05) 70%, #f97316)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              position: "relative",
              borderRadius: 32,
              overflow: "hidden",
              background: "linear-gradient(165deg, #211c1a 0%, #141110 55%, #0a0807 100%)",
              color: "#fafaf9",
            }}
          >
            {/* glows */}
            <div
              style={{
                position: "absolute",
                left: -200,
                top: -120,
                width: 760,
                height: 760,
                display: "flex",
                background: "radial-gradient(circle, rgb(249 115 22 / 0.34), transparent 62%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: -200,
                bottom: -220,
                width: 760,
                height: 760,
                display: "flex",
                background: "radial-gradient(circle, rgb(13 148 136 / 0.36), transparent 62%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 382,
                top: 110,
                width: 400,
                height: 400,
                display: "flex",
                background: "radial-gradient(circle, rgb(251 191 36 / 0.28), transparent 65%)",
              }}
            />
            {/* diagonal center slash */}
            <div
              style={{
                position: "absolute",
                left: 579,
                top: 110,
                width: 3,
                height: 340,
                display: "flex",
                transform: "rotate(14deg)",
                background: "linear-gradient(180deg, transparent, rgb(253 230 138 / 0.55) 30%, rgb(253 230 138 / 0.55) 70%, transparent)",
              }}
            />

            {/* top bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "30px 40px 0",
              }}
            >
              <div style={{ display: "flex", fontWeight: 900, fontStyle: "italic", fontSize: 30, letterSpacing: 1 }}>
                <span style={{ color: "#fafaf9" }}>BACKLINK</span>
                <span style={{ marginLeft: 8, backgroundImage: GOLD, backgroundClip: "text", color: "transparent" }}>
                  ARENA
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 20px",
                  borderRadius: 999,
                  background: closed ? "rgb(255 255 255 / 0.08)" : "rgb(220 38 38 / 0.18)",
                  border: closed ? "2px solid rgb(255 255 255 / 0.18)" : "2px solid rgb(248 113 113 / 0.6)",
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: 3,
                  color: closed ? "#e7e5e4" : "#fecaca",
                }}
              >
                {!closed && (
                  <div
                    style={{
                      display: "flex",
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: "#ef4444",
                      boxShadow: "0 0 14px 3px rgb(239 68 68 / 0.9)",
                    }}
                  />
                )}
                {closed ? "FINAL RESULT" : "LIVE · VOTING OPEN"}
              </div>
            </div>

            {/* round */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 10, gap: 16 }}>
              <div style={{ display: "flex", width: 60, height: 2, background: "linear-gradient(90deg, transparent, #fcd34d)" }} />
              <div style={{ display: "flex", fontWeight: 800, fontSize: 20, letterSpacing: 5, color: "#fcd34d" }}>
                {`${clip(tournament, 30)} · ${round}`.toUpperCase()}
              </div>
              <div style={{ display: "flex", width: 60, height: 2, background: "linear-gradient(90deg, #fcd34d, transparent)" }} />
            </div>

            {/* fighters */}
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 50px 0",
              }}
            >
              <FighterCol f={A} side="a" />
              <div
                style={{
                  display: "flex",
                  marginTop: -50,
                  fontWeight: 900,
                  fontStyle: "italic",
                  fontSize: 160,
                  letterSpacing: -8,
                  lineHeight: 1,
                  backgroundImage: GOLD,
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                VS
              </div>
              <FighterCol f={B} side="b" />
            </div>

            {/* vote bar */}
            <div style={{ display: "flex", flexDirection: "column", padding: "14px 56px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontStyle: "italic", fontSize: 30 }}>
                <span style={{ color: SIDE.a.color }}>{total ? `${A.pct}%` : "—"}</span>
                <span style={{ color: "rgb(255 255 255 / 0.55)", fontStyle: "normal", fontWeight: 800, fontSize: 18, letterSpacing: 3, alignSelf: "center" }}>
                  {total ? `${total.toLocaleString("en-US")} VOTES CAST` : "FIRST VOTE COULD DECIDE IT"}
                </span>
                <span style={{ color: SIDE.b.color }}>{total ? `${B.pct}%` : "—"}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  height: 18,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "rgb(255 255 255 / 0.08)",
                  border: "2px solid rgb(255 255 255 / 0.12)",
                }}
              >
                <div style={{ display: "flex", width: `${barA}%`, background: SIDE.a.bar }} />
                <div style={{ display: "flex", width: 4, background: "#fef3c7", boxShadow: "0 0 16px 4px rgb(254 243 199 / 0.9)" }} />
                <div style={{ display: "flex", flex: 1, background: SIDE.b.bar }} />
              </div>
            </div>

            {/* CTA */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 40px 28px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontWeight: 800, fontSize: 22, color: "#e7e5e4" }}>
                  Winner takes a&nbsp;
                  <span style={{ backgroundImage: GOLD, backgroundClip: "text", color: "transparent" }}>DA 50+ backlink</span>
                </div>
                <div style={{ display: "flex", fontWeight: 800, fontSize: 16, letterSpacing: 2, color: "rgb(255 255 255 / 0.45)", marginTop: 2 }}>
                  {host.toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 34px",
                  borderRadius: 999,
                  background: "linear-gradient(180deg, #fde68a, #fbbf24 45%, #d97706)",
                  color: "#1c1917",
                  fontWeight: 900,
                  fontStyle: "italic",
                  fontSize: 30,
                  letterSpacing: 1,
                  boxShadow: "0 14px 34px -10px rgb(251 191 36 / 0.85), inset 0 2px 0 rgb(255 255 255 / 0.6)",
                }}
              >
                {closed ? "SEE THE BRACKET" : "CAST YOUR VOTE"}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
