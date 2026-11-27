import "server-only";
import type { PublicSponsor } from "@/lib/sponsor-offer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { safeHttpUrl } from "@/lib/url";

/** The approved sponsor of a tournament, or null. Only public columns; never throws. */
export async function getTournamentSponsor(tournamentId: string | null | undefined): Promise<PublicSponsor | null> {
  if (!tournamentId) return null;
  try {
    const { data } = await createSupabaseAdmin()
      .from("sponsorships")
      .select("id, brand_name, tagline, logo_url, website")
      .eq("tournament_id", tournamentId)
      .eq("status", "approved")
      .maybeSingle();
    if (!data || !safeHttpUrl(data.website as string)) return null;
    return { ...(data as PublicSponsor), logo_url: safeHttpUrl(data.logo_url as string | null) };
  } catch (err) {
    // Table missing (migration 0020 not run yet) or Supabase down: just show no sponsor.
    console.error("getTournamentSponsor failed", err);
    return null;
  }
}
