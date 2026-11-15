import type { Metadata } from "next";
import { Suspense } from "react";
import { TournamentSection } from "@/components/TournamentSection";
import { getCurrentOrLastTournament } from "@/lib/data";

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
  return <TournamentSection tournament={await getCurrentOrLastTournament()} />;
}
