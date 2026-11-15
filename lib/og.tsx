import { ImageResponse } from "next/og";
import { getMatchView } from "@/lib/data";
import { fetchImageDataUrl } from "@/lib/metadata";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#1c1917";

function Logo({ src, name, color }: { src: string | null; name: string; color: string }) {
  return src ? (
    <img
      src={src}
      width={180}
      height={180}
      style={{ borderRadius: 36, border: `6px solid ${INK}`, background: "white", objectFit: "contain" }}
      alt=""
    />
  ) : (
    <div
      style={{
        width: 180,
        height: 180,
        borderRadius: 36,
        border: `6px solid ${INK}`,
        background: color,
        color: "white",
        fontSize: 96,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Draws the share image for a matchup (used by /match/[id] and /vs/[pair]). */
export async function renderMatchImage(id: string) {
  const view = await getMatchView(id);
  const aName = view?.a?.name ?? "TBD";
  const bName = view?.b?.name ?? "TBD";
  const [aLogo, bLogo] = await Promise.all([
    fetchImageDataUrl(view?.a?.logo_url ?? null),
    fetchImageDataUrl(view?.b?.logo_url ?? null),
  ]);
  const a = view?.counts.a_votes ?? 0;
  const b = view?.counts.b_votes ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fff8f1",
          color: INK,
          padding: 48,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>
            Backlink<span style={{ color: "#f97316" }}>Arena</span>
          </div>
          <div
            style={{
              display: "flex",
              background: "#fbbf24",
              border: `4px solid ${INK}`,
              borderRadius: 999,
              padding: "8px 28px",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            Vote now
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
          {[
            { name: aName, logo: aLogo, color: "#f97316", n: a },
            null,
            { name: bName, logo: bLogo, color: "#0d9488", n: b },
          ].map((s, i) =>
            s === null ? (
              <div
                key="vs"
                style={{
                  display: "flex",
                  fontSize: 88,
                  fontWeight: 900,
                  background: "#fbbf24",
                  border: `6px solid ${INK}`,
                  borderRadius: 999,
                  padding: "12px 36px",
                }}
              >
                VS
              </div>
            ) : (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 420, gap: 18 }}
              >
                <Logo src={s.logo} name={s.name} color={s.color} />
                <div style={{ display: "flex", fontSize: 48, fontWeight: 800, textAlign: "center" }}>
                  {clip(s.name, 22)}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 800,
                    color: "white",
                    background: s.color,
                    border: `4px solid ${INK}`,
                    borderRadius: 999,
                    padding: "4px 28px",
                  }}
                >
                  {s.n} {s.n === 1 ? "vote" : "votes"}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
