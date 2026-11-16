"use client";

import { useState, useTransition } from "react";
import {
  createTournament,
  markPrizeDelivered,
  removeAllVotesByVoter,
  removeVote,
  updateTournamentTimes,
} from "@/app/actions/admin";
import type { ActionResult } from "@/lib/types";

export function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
      } catch {
        setMsg({ ok: false, text: "Failed." });
      }
    });
  const note = msg && (
    <p className={`text-sm font-semibold break-all ${msg.ok ? "text-mint" : "text-red"}`}>{msg.text}</p>
  );
  return { pending, run, note };
}

/** One-click admin action. `action` is a server action already bound to its arguments. */
export function ActionButton({
  action,
  label,
  confirm,
  className = "btn bg-card text-xs py-1! px-3!",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  confirm?: string;
  className?: string;
}) {
  const { pending, run, note } = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          run(action);
        }}
      >
        {pending ? "…" : label}
      </button>
      {note}
    </span>
  );
}

export function toLocalInput(iso: string | null, fallbackHours = 72) {
  const d = iso ? new Date(iso) : new Date(Date.now() + fallbackHours * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateTournamentForm() {
  const { pending, run, note } = useAction();
  const [name, setName] = useState("");
  const [ends, setEnds] = useState(() => toLocalInput(null));
  const [hours, setHours] = useState(48);
  const [size, setSize] = useState(16);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          createTournament({
            name,
            qualifyingEndsAt: new Date(ends).toISOString(),
            matchHours: hours,
            bracketSize: size,
          }),
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        Name
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Season 1" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Qualifying ends (your local time)
        <input type="datetime-local" className="field" value={ends} onChange={(e) => setEnds(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Match hours
        <input type="number" min={1} max={720} className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Bracket size
        <select className="field" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          <option value={16}>16 (bigger tournament)</option>
          <option value={8}>8</option>
        </select>
      </label>
      <div className="flex items-end">
        <button className="btn bg-red text-white" disabled={pending}>
          Create draft
        </button>
      </div>
      <div className="sm:col-span-2">{note}</div>
    </form>
  );
}

export function TimesForm({
  id,
  qualifyingEndsAt,
  matchHours,
}: {
  id: string;
  qualifyingEndsAt: string | null;
  matchHours: number;
}) {
  const { pending, run, note } = useAction();
  const [ends, setEnds] = useState(() => toLocalInput(qualifyingEndsAt));
  const [hours, setHours] = useState(matchHours);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateTournamentTimes(id, new Date(ends).toISOString(), hours));
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Qualifying ends
        <input type="datetime-local" className="field" value={ends} onChange={(e) => setEnds(e.target.value)} />
      </label>
      <label className="flex w-28 flex-col gap-1 text-sm font-semibold">
        Match hours
        <input type="number" min={1} max={720} className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      </label>
      <button className="btn bg-card text-sm" disabled={pending}>
        Save times
      </button>
      {note}
    </form>
  );
}

export function VoteRemovalForms() {
  const one = useAction();
  const all = useAction();
  const [matchId, setMatchId] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          one.run(() => removeVote(matchId, email));
        }}
      >
        <p className="font-bold">Remove one vote</p>
        <input className="field" placeholder="Match ID" value={matchId} onChange={(e) => setMatchId(e.target.value)} required />
        <input className="field" placeholder="Voter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn bg-card text-sm" disabled={one.pending}>
          Remove vote
        </button>
        {one.note}
      </form>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!window.confirm(`Remove ALL votes cast by ${email2}?`)) return;
          all.run(() => removeAllVotesByVoter(email2));
        }}
      >
        <p className="font-bold">Remove all votes from one voter</p>
        <input className="field" placeholder="Voter email" value={email2} onChange={(e) => setEmail2(e.target.value)} required />
        <button className="btn bg-red text-sm text-white" disabled={all.pending}>
          Remove all their votes
        </button>
        {all.note}
      </form>
    </div>
  );
}

export function PrizeForm({ tournamentId, current }: { tournamentId: string; current: string | null }) {
  const { pending, run, note } = useAction();
  const [url, setUrl] = useState(current ?? "");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => markPrizeDelivered(tournamentId, url));
      }}
    >
      <input
        className="field max-w-sm"
        placeholder="https://site.com/article-with-the-link"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <button className="btn bg-mint-soft text-sm" disabled={pending}>
        Mark prize delivered
      </button>
      {note}
    </form>
  );
}
