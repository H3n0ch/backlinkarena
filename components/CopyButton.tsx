"use client";

import { type ReactNode, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className = "btn bg-card text-sm",
  icon,
}: {
  text: string;
  label?: string;
  className?: string;
  icon?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
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
