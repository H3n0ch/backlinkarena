"use client";

import { useState, useTransition } from "react";
import {
  createTournament,
  markPrizeDelivered,
  removeAllVotesByVoter,
  removeVote,
  setMatchLength,
  shiftTimers,
  updateTournamentTimes,
} from "@/app/actions/admin";
import { Countdown } from "@/components/Countdown";
import { formatMinutes } from "@/lib/time";
import type { ActionResult, TournamentStatus } from "@/lib/types";

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
  const [minutes, setMinutes] = useState(48 * 60);
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
            matchMinutes: minutes,
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
        <input type="datetime-local" step={60} className="field" value={ends} onChange={(e) => setEnds(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Match length
        <DurationInput minutes={minutes} onChange={setMinutes} />
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

/** Number + minutes/hours picker. Value is always in minutes. */
export function DurationInput({ minutes, onChange }: { minutes: number; onChange: (min: number) => void }) {
  const [unit, setUnit] = useState<"min" | "h">(minutes % 60 === 0 && minutes >= 60 ? "h" : "min");
  const factor = unit === "h" ? 60 : 1;
  const [n, setN] = useState(String(minutes / factor));
  return (
    <span className="flex gap-1">
      <input
        type="number"
        min={1}
        className="field w-24!"
        value={n}
        onChange={(e) => {
          setN(e.target.value);
          const v = Math.round(Number(e.target.value));
          if (v >= 1) onChange(v * factor);
        }}
      />
      <select
        className="field w-auto!"
        value={unit}
        onChange={(e) => {
          const u = e.target.value as "min" | "h";
          setUnit(u);
          const v = Math.max(1, Math.round(Number(n) || 1));
          onChange(v * (u === "h" ? 60 : 1));
        }}
      >
        <option value="min">minutes</option>
        <option value="h">hours</option>
      </select>
    </span>
  );
}

const STEPS = [-5, -1, 1, 5];

/**
 * Admin clock: shows the running timer (qualifying end, or the open matches) with
 * -5 / -1 / +1 / +5 min and "End now", plus exact qualifying end and match length.
 * Every change runs the engine at once; open public pages refresh themselves within seconds.
 */
export function TimerPanel({
  id,
  status,
  qualifyingEndsAt,
  matchMinutes,
  nextMatchEnd,
  openMatches,
  paused,
}: {
  id: string;
  status: TournamentStatus;
  qualifyingEndsAt: string | null;
  matchMinutes: number;
  nextMatchEnd: string | null;
  openMatches: number;
  paused: boolean;
}) {
  const shift = useAction();
  const save = useAction();
  const preBracket = status === "draft" || status === "qualifying";
  const [ends, setEnds] = useState(() => toLocalInput(qualifyingEndsAt));
  const [minutes, setMinutes] = useState(matchMinutes);
  const [restart, setRestart] = useState(false);
  const target = preBracket ? qualifyingEndsAt : nextMatchEnd;
  const what = preBracket ? "Qualifying ends" : openMatches === 1 ? "Open match ends" : `${openMatches} open matches end`;
  const canShift = preBracket || openMatches > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-paper/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm font-semibold">
          ⏱ {canShift ? what : "No open matches"}
          {canShift && target && (
            <>
              {" "}
              in{" "}
              <strong className="font-mono">
                <Countdown to={target} endedText="now" />
              </strong>
            </>
          )}
          {paused && <span className="ml-2 text-red">(paused, timers frozen)</span>}
        </p>
        {canShift && (
          <>
            {STEPS.map((m) => (
              <button
                key={m}
                className="btn bg-card px-3! py-1! font-mono text-xs"
                disabled={shift.pending}
                onClick={() => shift.run(() => shiftTimers(id, m))}
              >
                {m > 0 ? `+${m}` : `−${-m}`} min
              </button>
            ))}
            <button
              className="btn bg-red-soft px-3! py-1! text-xs"
              disabled={shift.pending}
              onClick={() => {
                const q = preBracket
                  ? "End qualifying now? The bracket starts if it's full."
                  : `End ${openMatches === 1 ? "the open match" : `all ${openMatches} open matches`} now? Winners go through.`;
                if (window.confirm(q)) shift.run(() => shiftTimers(id, null));
              }}
            >
              End now
            </button>
          </>
        )}
        {shift.note}
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() =>
            preBracket
              ? updateTournamentTimes(id, new Date(ends).toISOString(), minutes)
              : setMatchLength(id, minutes, restart),
          );
        }}
      >
        {preBracket && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Qualifying ends
            <input type="datetime-local" step={60} className="field" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span>
            Match length <span className="text-xs font-normal text-muted">now {formatMinutes(matchMinutes)}</span>
          </span>
          <DurationInput minutes={minutes} onChange={setMinutes} />
        </label>
        {!preBracket && openMatches > 0 && (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} />
            Restart open matches with this length
          </label>
        )}
        <button className="btn bg-card text-sm" disabled={save.pending}>
          Save
        </button>
        {save.note}
      </form>
    </div>
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
