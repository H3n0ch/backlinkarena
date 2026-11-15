export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#1c1917" />
      <path d="M8 22 L14 10 L16 15" stroke="#f97316" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 10 L18 22 L16 17" stroke="#2dd4bf" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.2" fill="#fbbf24" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
      <LogoMark />
      <span>
        Backlink<span className="text-gradient">Arena</span>
      </span>
    </span>
  );
}
