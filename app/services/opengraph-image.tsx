import { ImageResponse } from "next/og";
import { getFonts, OG_SIZE } from "@/lib/og-card";
import { SERVICES } from "@/lib/services";

export const alt = "Buy high DA backlinks: real outreach, no PBNs. Packages from $870.";
export const size = OG_SIZE;
export const contentType = "image/png";

const GRAD = "linear-gradient(90deg, #fbbf24, #f97316 45%, #e11d48)";

export default async function Image() {
  const tiers = SERVICES.find((s) => s.tiers)?.tiers ?? [];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(circle at 80% 0%, #3b1d0e, #0c0a09 60%)",
          color: "#fff",
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 4, color: "#fcd34d" }}>
          BACKLINK ARENA · SERVICES
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 900, fontStyle: "italic", lineHeight: 1 }}>
            BUY HIGH DA
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 900,
              fontStyle: "italic",
              lineHeight: 1.05,
              backgroundImage: GRAD,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            BACKLINKS
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.75)" }}>
            Real outreach · Do-follow links in real content · No PBNs
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {tiers.map((t) => (
            <div
              key={t.title}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "18px 26px",
                borderRadius: 20,
                border: "2px solid rgba(252,211,77,0.35)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>{t.title}</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 900, fontStyle: "italic" }}>from {t.price}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await getFonts() },
  );
}
