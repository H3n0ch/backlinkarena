/** Normalised category, used to spot two sites from the same niche in one matchup. Safe on server and client. */
export function nicheKey(c: string | null | undefined) {
  return (c ?? "").trim().toLowerCase();
}
