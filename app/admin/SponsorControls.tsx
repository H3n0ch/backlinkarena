"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveSponsorship, markSponsorshipWired, rejectSponsorship, toggleSponsorship } from "@/app/actions/sponsor";
import type { ActionResult } from "@/lib/types";
import type { SponsorStatus } from "@/lib/sponsor-offer";
import { Switch } from "./Switch";

export function SponsorControls({
  id,
  status,
  tournaments,
}: {
  id: string;
  status: SponsorStatus;
  /** Non-finished tournaments that don't have a sponsor yet. */
  tournaments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? null) : r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-start gap-2">
      {status === "pending_payment" && (
        <button
          className="btn bg-card text-xs"
          disabled={pending}
          onClick={() => {
            const amount = prompt("Bank transfer received. Amount in USD:", "499");
            if (amount !== null) run(() => markSponsorshipWired(id, Number(amount)));
          }}
        >
          Mark as paid (wire)
        </button>
      )}
      {status === "paid" &&
        (tournaments.length ? (
          <div className="flex flex-wrap gap-2">
            <select className="field py-1! text-xs" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} disabled={pending}>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn bg-ink text-xs text-white" disabled={pending || !tournamentId} onClick={() => run(() => approveSponsorship(id, tournamentId))}>
              Approve
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">No open tournament without a sponsor. Create one to approve.</p>
        ))}
      {(status === "approved" || status === "paused") && (
        <label className="flex items-center gap-2 text-xs font-bold">
          <Switch on={status === "approved"} disabled={pending} onChange={() => run(() => toggleSponsorship(id))} label="Sponsor live on the site" />
          {status === "approved" ? "Live" : "Paused"}
        </label>
      )}
      {(status === "paid" || status === "approved" || status === "paused") && (
        <button
          className="text-xs font-semibold text-red-dark underline"
          disabled={pending}
          onClick={() => {
            if (confirm("Reject this sponsor? Refund the payment in the payment dashboard afterwards.")) run(() => rejectSponsorship(id));
          }}
        >
          Reject
        </button>
      )}
      {msg && <p className="text-xs font-semibold">{msg}</p>}
    </div>
  );
}
