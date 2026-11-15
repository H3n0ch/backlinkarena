export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function roundName(round: number, bracketSize: number): string {
  const remaining = bracketSize / 2 ** (round - 1);
  if (remaining === 2) return "Final";
  if (remaining === 4) return "Semifinals";
  if (remaining === 8) return "Quarterfinals";
  return `Round of ${remaining}`;
}

export function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize);
}
