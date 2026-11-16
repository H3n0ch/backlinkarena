import { ImageResponse } from "next/og";

// iOS home-screen icon. iOS rounds the corners itself, so this fills the whole square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 50%, rgb(251 191 36 / 0.45), transparent 45%), linear-gradient(135deg, #2a2320, #0c0a09)",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M7.5 22.5 L13.8 9.5 L16 15" stroke="#f97316" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24.5 9.5 L18.2 22.5 L16 17" stroke="#2dd4bf" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="2.7" fill="#fcd34d" />
        </svg>
      </div>
    ),
    size,
  );
}
