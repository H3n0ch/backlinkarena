/** The square app icon (v6): chain links with a spark. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <img src="/badge/backlink-arena-icon-v6.svg" alt="" width={size} height={size} aria-hidden="true" />
  );
}

/** Full logo (icon + wordmark, v6). The parent link carries the accessible name. */
export function Wordmark({ height = 32 }: { height?: number }) {
  return (
    <img
      src="/badge/backlink-arena-logo-v6.svg"
      alt="Backlink Arena"
      width={Math.round((height * 398) / 64)}
      height={height}
      className="block h-6 w-auto sm:h-8"
    />
  );
}
