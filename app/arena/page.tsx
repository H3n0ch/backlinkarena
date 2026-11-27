import type { Metadata } from "next";
import { Suspense } from "react";
import { SponsorCard } from "@/components/SponsorCard";
import { TournamentSection } from "@/components/TournamentSection";
import { getCurrentOrLastTournament } from "@/lib/data";
import { getTournamentSponsor } from "@/lib/sponsors";

export const metadata: Metadata = {
  title: "Arena",
  description: "The current Backlink Arena tournament: every brand, the full bracket and live matchups.",
};

export default function ArenaPage() {
  return (
    <div className="py-10">
      <Suspense fallback={<div className="mx-auto h-[28rem] max-w-5xl animate-pulse rounded-xl bg-cream" />}>
        <Arena />
      </Suspense>
    </div>
  );
}

async function Arena() {
  const tournament = await getCurrentOrLastTournament();
  const sponsor = await getTournamentSponsor(tournament?.id);
  // An open slot is only advertised while the tournament still runs.
  const showSponsor = sponsor || (tournament && tournament.status !== "finished");
  return (
    <>
      {showSponsor && <SponsorCard sponsor={sponsor} tournamentName={tournament?.name} className="mb-8" />}
      <TournamentSection tournament={tournament} stadium />
    </>
  );
}
