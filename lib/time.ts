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

/** Match length in minutes; falls back to match_hours for rows from before migration 0010. */
export function matchMinutes(t: { match_minutes?: number | null; match_hours: number }): number {
  return t.match_minutes ?? t.match_hours * 60;
}

/** "1 min", "90 min", "2 h", "30 h", "2 d". */
export function formatMinutes(min: number): string {
  if (min < 60 || min % 60) return `${min} min`;
  const h = min / 60;
  if (h < 24 || h % 24) return `${h} h`;
  return `${h / 24} d`;
}
