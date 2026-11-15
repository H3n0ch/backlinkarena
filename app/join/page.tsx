import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Join with your website",
  description: "Enter your website and play for a DA 50+ backlink in your niche.",
};

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold leading-tight">Enter the arena</h1>
      <p className="mt-2 text-muted">
        Free entries play the qualifying round. The top of the leaderboard makes the 16-site bracket.
      </p>
      <Suspense fallback={<div className="card mt-6 h-40" />}>
        <JoinFlow />
      </Suspense>
    </div>
  );
}
