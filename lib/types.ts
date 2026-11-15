export type BadgeStatus = "none" | "pending" | "verified";
export type TournamentStatus = "draft" | "qualifying" | "bracket" | "finished";
export type EntryPath = "free" | "badge" | "pass";

export type Product = {
  id: string;
  owner_id: string;
  url: string;
  domain: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  badge_status: BadgeStatus;
  pass_paid: boolean;
  created_at: string;
};

export type Tournament = {
  id: string;
  name: string;
  status: TournamentStatus;
  bracket_size: number;
  qualifying_ends_at: string | null;
  match_hours: number;
  winner_product_id: string | null;
  prize_url: string | null;
  prize_delivered_at: string | null;
  created_at: string;
};

export type Entry = {
  id: string;
  tournament_id: string;
  product_id: string;
  entry_path: EntryPath;
  qualified: boolean;
  eliminated_round: number | null;
  created_at: string;
};

export type Match = {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  product_a: string | null;
  product_b: string | null;
  starts_at: string;
  ends_at: string;
  winner_product_id: string | null;
  status: "open" | "closed";
};

export type Counts = { a_votes: number; b_votes: number };

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
