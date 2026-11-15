"use client";

import { useState } from "react";

export function ProductLogo({
  src,
  name,
  size = 56,
  className = "",
}: {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        style={{ ...style, fontSize: size * 0.45 }}
        className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-red-soft text-red-dark font-display font-extrabold ${className}`}
        aria-hidden="true"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={style}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-2xl border border-line bg-white object-contain p-1 ${className}`}
    />
  );
}
