import type { PostgrestError } from "@supabase/supabase-js";

const MESSAGES: Record<string, string> = {
  RATE_LIMIT: "Slow down: you can cast up to 30 votes per hour.",
  MATCH_CLOSED: "This matchup is closed.",
  NOT_IN_MATCH: "That product isn't in this matchup.",
  OWN_MATCH: "You can't vote in your own matchup.",
  OWN_PRODUCT: "You can't vote for your own product.",
  QUALIFYING_CLOSED: "Qualifying is closed.",
  NOT_IN_QUALIFYING: "That product isn't in qualifying.",
  NOT_LOGGED_IN: "Please log in first.",
  TOURNAMENT_CLOSED: "This tournament isn't accepting entries.",
  FORBIDDEN_FIELD: "You can't change that.",
};

export function friendlyDbError(error: PostgrestError | null, duplicate: string): string {
  if (!error) return "Something went wrong.";
  if (error.code === "23505") return duplicate;
  if (error.code === "42501") return "You're not allowed to do that.";
  return MESSAGES[error.message] ?? "Something went wrong. Please try again.";
}
