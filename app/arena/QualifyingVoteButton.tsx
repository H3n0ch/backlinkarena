"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { castQualifyingVote } from "@/app/actions/vote";
import { useVoteBurst } from "@/components/VoteBurst";

export function QualifyingVoteButton(props: {
  tournamentId: string;
  productId: string;
  own: boolean;
  voted: boolean;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(props.voted);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [justVoted, setJustVoted] = useState(false);
  const { fire, bursts } = useVoteBurst();
  const cls = "btn shrink-0 text-sm py-1.5! px-3!";

  if (props.own) return <span className="shrink-0 text-xs font-semibold text-muted">Yours</span>;
  // No sign-in needed: logged-out visitors vote as a guest (one vote per browser).
  if (voted) {
    return (
      <>
        <span className={`${cls} bg-mint-soft ${justVoted ? "animate-pop" : ""}`}>✓ Voted</span>
        {bursts}
      </>
    );
  }

  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        className={`${cls} bg-red text-white`}
        disabled={pending}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          start(async () => {
            const r = await castQualifyingVote(props.tournamentId, props.productId);
            if (r.ok) {
              fire(rect, "#f97316");
              setJustVoted(true);
              setVoted(true);
              router.refresh();
            } else {
              setError(r.error);
              if (r.error.includes("already")) setVoted(true);
            }
          });
        }}
      >
        {pending ? "…" : "Vote"}
      </button>
      {error && <span className="mt-1 max-w-40 text-right text-xs text-red">{error}</span>}
    </span>
  );
}
