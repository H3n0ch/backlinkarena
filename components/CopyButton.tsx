"use client";

import { type CSSProperties, type ReactNode, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "btn bg-card text-sm",
  icon,
  style,
}: {
  text: string;
  label?: string;
  className?: string;
  icon?: ReactNode;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copy this:", text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {icon}
      {copied ? "Copied!" : label}
    </button>
  );
}
