"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addEntry,
  createMatch,
  createProductAdmin,
  deleteEntry,
  deleteMatch,
  deleteProductAdmin,
  deleteTournament,
  deleteUserVotes,
  reopenMatch,
  saveEntry,
  saveHomepageStats,
  saveMatch,
  saveProduct,
  saveTournament,
  saveUser,
  setMatchVotes,
  setMatchWinner,
  setQualifyingVotes,
  swapMatchSides,
  uploadLogo,
} from "@/app/actions/crm";
import { ProductLogo } from "@/components/ProductLogo";
import type { Entry, Match, Product, Tournament } from "@/lib/types";
import { toLocalInput, useAction } from "./AdminForms";

export type Option = { id: string; label: string };

const label = "flex flex-col gap-1 text-sm font-semibold";
const small = "btn bg-card text-xs py-1! px-3!";

function fromLocal(v: string): string {
  return v ? new Date(v).toISOString() : "";
}

function Num({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <input
      type="number"
      min={min}
      className="field"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.trunc(Number(e.target.value)))}
    />
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function ProductEditForm({ product, ownerEmail }: { product: Product; ownerEmail: string }) {
  const { pending, run, note } = useAction();
  const [f, setF] = useState({
    name: product.name,
    description: product.description ?? "",
    logoUrl: product.logo_url ?? "",
    category: product.category ?? "",
    url: product.url,
    slug: product.slug,
    badgeStatus: product.badge_status,
    passPaid: product.pass_paid,
    ownerEmail,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveProduct(product.id, f));
      }}
    >
      <label className={label}>
        Name
        <input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} />
      </label>
      <label className={label}>
        Category
        <input className="field" value={f.category} onChange={(e) => set("category", e.target.value)} maxLength={60} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Description
        <textarea
          className="field min-h-20"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={300}
        />
      </label>
      <label className={label}>
        Website URL (domain is taken from this)
        <input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} required />
      </label>
      <label className={label}>
        Slug (/p/…)
        <input className="field" value={f.slug} onChange={(e) => set("slug", e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Logo URL
        <input className="field" value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" />
      </label>
      <label className={label}>
        Owner email (move this site to another account)
        <input className="field" value={f.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} />
      </label>
      <label className={label}>
        Badge
        <select className="field" value={f.badgeStatus} onChange={(e) => set("badgeStatus", e.target.value as Product["badge_status"])}>
          <option value="none">none</option>
          <option value="pending">pending</option>
          <option value="verified">verified</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={f.passPaid} onChange={(e) => set("passPaid", e.target.checked)} />
        Contender Pass paid
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn bg-red text-white" disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </button>
        {note}
      </div>
    </form>
  );
}

export function LogoUploadForm({ productId, current, name }: { productId: string; current: string | null; name: string }) {
  const { pending, run, note } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        const fd = new FormData();
        fd.set("file", file);
        run(() => uploadLogo(productId, fd));
      }}
    >
      <ProductLogo src={preview ?? current} name={name} size={72} />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
        className="text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
      <button className="btn bg-card text-sm" disabled={pending || !file}>
        {pending ? "Uploading…" : "Upload logo"}
      </button>
      {note}
    </form>
  );
}

export function DeleteProductForm({ productId, domain }: { productId: string; domain: string }) {
  const { pending, run, note } = useAction();
  const router = useRouter();
  const [force, setForce] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        also clear it from bracket matches
      </label>
      <button
        className="btn bg-red-soft text-sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete ${domain} permanently? Its entries and votes go too.`)) return;
          run(async () => {
            const r = await deleteProductAdmin(productId, force);
            if (r.ok) router.push("/admin/products");
            return r;
          });
        }}
      >
        Delete product
      </button>
      {note}
    </div>
  );
}

export function CreateProductForm() {
  const { pending, run, note } = useAction();
  const router = useRouter();
  const [f, setF] = useState({ ownerEmail: "", url: "", name: "", logoUrl: "", category: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await createProductAdmin(f);
          if (!r.ok) return r;
          if (r.data) router.push(`/admin/products/${r.data}`);
          return { ok: true, message: r.message };
        });
      }}
    >
      <input className="field" placeholder="Owner email (must have logged in)" value={f.ownerEmail} onChange={set("ownerEmail")} required />
      <input className="field" placeholder="Website, e.g. example.com" value={f.url} onChange={set("url")} required />
      <input className="field" placeholder="Name" value={f.name} onChange={set("name")} required />
      <input className="field" placeholder="Logo URL (optional)" value={f.logoUrl} onChange={set("logoUrl")} />
      <input className="field" placeholder="Category (optional)" value={f.category} onChange={set("category")} />
      <button className="btn bg-red text-white" disabled={pending}>
        Add product
      </button>
      <div className="sm:col-span-3">{note}</div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export function EntryRow({
  entry,
  realVotes,
  tournaments,
  heading,
}: {
  entry: Entry;
  realVotes: number;
  tournaments: Option[];
  heading: React.ReactNode;
}) {
  const save = useAction();
  const del = useAction();
  const [f, setF] = useState({
    tournamentId: entry.tournament_id,
    entryPath: entry.entry_path,
    qualified: entry.qualified,
    eliminatedRound: entry.eliminated_round,
    qualifyingVotes: Math.max(0, realVotes + (entry.vote_adjust ?? 0)),
  });
  return (
    <tr className="border-b border-line/10 align-top">
      <td className="py-2 pr-3">{heading}</td>
      <td className="py-2 pr-3">
        <select className="field" value={f.tournamentId} onChange={(e) => setF({ ...f, tournamentId: e.target.value })}>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <select
          className="field"
          value={f.entryPath}
          onChange={(e) => setF({ ...f, entryPath: e.target.value as Entry["entry_path"] })}
        >
          <option value="free">free (qualifying)</option>
          <option value="badge">badge (seeded)</option>
          <option value="pass">pass (seeded)</option>
        </select>
      </td>
      <td className="py-2 pr-3 text-center">
        <input type="checkbox" checked={f.qualified} onChange={(e) => setF({ ...f, qualified: e.target.checked })} />
      </td>
      <td className="py-2 pr-3 w-24">
        <input
          type="number"
          min={0}
          className="field"
          placeholder="still in"
          value={f.eliminatedRound ?? ""}
          onChange={(e) => setF({ ...f, eliminatedRound: e.target.value === "" ? null : Math.trunc(Number(e.target.value)) })}
        />
      </td>
      <td className="py-2 pr-3 w-28">
        <Num value={f.qualifyingVotes} onChange={(n) => setF({ ...f, qualifyingVotes: n })} />
        <div className="mt-1 text-xs text-muted">real: {realVotes}</div>
      </td>
      <td className="py-2">
        <div className="flex flex-wrap gap-1">
          <button className={small} disabled={save.pending} onClick={() => save.run(() => saveEntry(entry.id, f))}>
            Save
          </button>
          <button
            className="btn bg-red-soft text-xs py-1! px-3!"
            disabled={del.pending}
            onClick={() => {
              if (window.confirm("Remove this site from the tournament? Its qualifying votes go too.")) {
                del.run(() => deleteEntry(entry.id));
              }
            }}
          >
            Remove
          </button>
        </div>
        {save.note}
        {del.note}
      </td>
    </tr>
  );
}

export function AddEntryForm({ productId, productOptions, tournaments }: {
  productId?: string;
  productOptions?: Option[];
  tournaments: Option[];
}) {
  const { pending, run, note } = useAction();
  const [pid, setPid] = useState(productId ?? productOptions?.[0]?.id ?? "");
  const [tid, setTid] = useState(tournaments[0]?.id ?? "");
  const [path, setPath] = useState<"free" | "badge" | "pass">("free");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addEntry(pid, tid, path));
      }}
    >
      {productOptions && (
        <label className={label}>
          Site
          <select className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {tournaments.length > 1 && (
        <label className={label}>
          Tournament
          <select className="field" value={tid} onChange={(e) => setTid(e.target.value)}>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={label}>
        Entry
        <select className="field" value={path} onChange={(e) => setPath(e.target.value as typeof path)}>
          <option value="free">free</option>
          <option value="badge">badge</option>
          <option value="pass">pass</option>
        </select>
      </label>
      <button className="btn bg-card text-sm" disabled={pending || !pid || !tid}>
        Add to tournament
      </button>
      {note}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export function TournamentEditForm({ t, productOptions }: { t: Tournament; productOptions: Option[] }) {
  const { pending, run, note } = useAction();
  const del = useAction();
  const router = useRouter();
  const [f, setF] = useState({
    name: t.name,
    status: t.status,
    bracketSize: t.bracket_size as 8 | 16,
    qualifyingEndsAt: t.qualifying_ends_at ? toLocalInput(t.qualifying_ends_at) : "",
    matchHours: t.match_hours,
    winnerProductId: t.winner_product_id ?? "",
    prizeUrl: t.prize_url ?? "",
    prizeDelivered: Boolean(t.prize_delivered_at),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveTournament(t.id, { ...f, qualifyingEndsAt: fromLocal(f.qualifyingEndsAt) }));
      }}
    >
      <label className={label}>
        Name
        <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </label>
      <label className={label}>
        Status
        <select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Tournament["status"] })}>
          <option value="draft">draft</option>
          <option value="qualifying">qualifying</option>
          <option value="bracket">bracket</option>
          <option value="finished">finished</option>
        </select>
      </label>
      <label className={label}>
        Bracket size
        <select className="field" value={f.bracketSize} onChange={(e) => setF({ ...f, bracketSize: Number(e.target.value) as 8 | 16 })}>
          <option value={16}>16</option>
          <option value={8}>8</option>
        </select>
      </label>
      <label className={label}>
        Qualifying ends (local time)
        <input
          type="datetime-local"
          className="field"
          value={f.qualifyingEndsAt}
          onChange={(e) => setF({ ...f, qualifyingEndsAt: e.target.value })}
        />
      </label>
      <label className={label}>
        Match hours
        <Num value={f.matchHours} min={1} onChange={(n) => setF({ ...f, matchHours: n })} />
      </label>
      <label className={label}>
        Champion
        <select className="field" value={f.winnerProductId} onChange={(e) => setF({ ...f, winnerProductId: e.target.value })}>
          <option value="">— none —</option>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Prize backlink URL
        <input className="field" value={f.prizeUrl} onChange={(e) => setF({ ...f, prizeUrl: e.target.value })} placeholder="https://…" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={f.prizeDelivered} onChange={(e) => setF({ ...f, prizeDelivered: e.target.checked })} />
        Prize delivered
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button className="btn bg-red text-white" disabled={pending}>
          {pending ? "Saving…" : "Save tournament"}
        </button>
        {note}
        <button
          type="button"
          className="btn bg-red-soft text-sm ml-auto"
          disabled={del.pending}
          onClick={() => {
            if (!window.confirm(`Delete "${t.name}" with ALL its entries, matches and votes? This can't be undone.`)) return;
            del.run(async () => {
              const r = await deleteTournament(t.id);
              if (r.ok) router.push("/admin/tournaments");
              return r;
            });
          }}
        >
          Delete tournament
        </button>
        {del.note}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export function MatchEditor({
  match,
  real,
  productOptions,
  names,
}: {
  match: Match;
  real: { a: number; b: number };
  productOptions: Option[];
  names: Record<string, string>;
}) {
  const save = useAction();
  const quick = useAction();
  const [hours, setHours] = useState(24);
  const [f, setF] = useState({
    productA: match.product_a ?? "",
    productB: match.product_b ?? "",
    startsAt: toLocalInput(match.starts_at),
    endsAt: toLocalInput(match.ends_at),
    status: match.status,
    winner: match.winner_product_id ?? "",
    aVotes: Math.max(0, real.a + (match.a_adjust ?? 0)),
    bVotes: Math.max(0, real.b + (match.b_adjust ?? 0)),
  });
  const sideSelect = (key: "productA" | "productB") => (
    <select className="field" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">— empty (bye) —</option>
      {productOptions.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
  const nameOf = (id: string) => names[id] ?? "?";
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          Match {match.position}{" "}
          <span className={`ml-1 rounded-full px-2 text-xs ${match.status === "open" ? "bg-mint-soft" : "bg-line"}`}>
            {match.status}
          </span>
        </p>
        <a href={`/match/${match.id}`} className="text-xs font-semibold underline" target="_blank">
          View ↗
        </a>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
        <label className={label}>
          Side A
          {sideSelect("productA")}
        </label>
        <label className={label}>
          A votes
          <Num value={f.aVotes} onChange={(n) => setF({ ...f, aVotes: n })} />
          <span className="text-xs font-normal text-muted">real: {real.a}</span>
        </label>
        <label className={label}>
          Side B
          {sideSelect("productB")}
        </label>
        <label className={label}>
          B votes
          <Num value={f.bVotes} onChange={(n) => setF({ ...f, bVotes: n })} />
          <span className="text-xs font-normal text-muted">real: {real.b}</span>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className={label}>
          Starts
          <input type="datetime-local" className="field" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        </label>
        <label className={label}>
          Ends
          <input type="datetime-local" className="field" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
        </label>
        <label className={label}>
          Status
          <select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Match["status"] })}>
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
        </label>
        <label className={label}>
          Winner
          <select className="field" value={f.winner} onChange={(e) => setF({ ...f, winner: e.target.value })}>
            <option value="">— none —</option>
            {f.productA && <option value={f.productA}>A: {nameOf(f.productA)}</option>}
            {f.productB && <option value={f.productB}>B: {nameOf(f.productB)}</option>}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn bg-red text-white text-sm"
          disabled={save.pending}
          onClick={() =>
            save.run(() => saveMatch(match.id, { ...f, startsAt: fromLocal(f.startsAt), endsAt: fromLocal(f.endsAt) }))
          }
        >
          {save.pending ? "Saving…" : "Save match"}
        </button>
        {match.product_a && match.product_b && (
          <>
            <button className={small} disabled={quick.pending} onClick={() => quick.run(() => setMatchWinner(match.id, match.product_a!))}>
              A wins now
            </button>
            <button className={small} disabled={quick.pending} onClick={() => quick.run(() => setMatchWinner(match.id, match.product_b!))}>
              B wins now
            </button>
          </>
        )}
        <button className={small} disabled={quick.pending} onClick={() => quick.run(() => swapMatchSides(match.id))}>
          Swap sides
        </button>
        <span className="inline-flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={720}
            className="field w-20! py-1!"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
          <button className={small} disabled={quick.pending} onClick={() => quick.run(() => reopenMatch(match.id, hours))}>
            Reopen for h
          </button>
        </span>
        <button
          className="btn bg-red-soft text-xs py-1! px-3!"
          disabled={quick.pending}
          onClick={() => {
            if (window.confirm("Delete this match and all its votes?")) quick.run(() => deleteMatch(match.id));
          }}
        >
          Delete
        </button>
      </div>
      <div className="mt-2">
        {save.note}
        {quick.note}
      </div>
      <p className="mt-2 text-xs text-muted break-all">ID: {match.id}</p>
    </div>
  );
}

export function CreateMatchForm({ tournamentId, matchHours }: { tournamentId: string; matchHours: number }) {
  const { pending, run, note } = useAction();
  const [round, setRound] = useState(1);
  const [pos, setPos] = useState(1);
  const [hours, setHours] = useState(matchHours);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createMatch(tournamentId, round, pos, hours));
      }}
    >
      <label className={`${label} w-24`}>
        Round
        <Num value={round} min={1} onChange={setRound} />
      </label>
      <label className={`${label} w-24`}>
        Position
        <Num value={pos} min={1} onChange={setPos} />
      </label>
      <label className={`${label} w-24`}>
        Hours
        <Num value={hours} min={1} onChange={setHours} />
      </label>
      <button className="btn bg-card text-sm" disabled={pending}>
        Add match
      </button>
      {note}
    </form>
  );
}

/** Small inline "votes: [ 12 ] Save" editor for the overview table. */
export function InlineVotes({
  label: caption,
  value,
  real,
  target,
}: {
  label: string;
  value: number;
  real: number;
  target: { kind: "entry"; id: string } | { kind: "match"; id: string; side: "a" | "b" };
}) {
  const { pending, run, note } = useAction();
  const [n, setN] = useState(value);
  const changed = n !== value;
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => (target.kind === "entry" ? setQualifyingVotes(target.id, n) : setMatchVotes(target.id, target.side, n)));
      }}
    >
      <span className="text-xs text-muted">{caption}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          className="field w-20! py-1!"
          value={n}
          onChange={(e) => setN(Math.max(0, Math.trunc(Number(e.target.value))))}
        />
        <button className={`${small} ${changed ? "bg-ink! text-white" : ""}`} disabled={pending || !changed}>
          {pending ? "…" : "Save"}
        </button>
      </span>
      <span className="text-xs text-muted">real: {real}</span>
      {note}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function UserRow({
  id,
  email,
  fullName,
  isAdmin,
  votes,
  products,
}: {
  id: string;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
  votes: number;
  products: React.ReactNode;
}) {
  const save = useAction();
  const wipe = useAction();
  const [name, setName] = useState(fullName ?? "");
  const [admin, setAdmin] = useState(isAdmin);
  return (
    <tr className="border-b border-line/10 align-top">
      <td className="py-2 pr-3 break-all">{email ?? "—"}</td>
      <td className="py-2 pr-3">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="py-2 pr-3 text-center">
        <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
      </td>
      <td className="py-2 pr-3">{products}</td>
      <td className="py-2 pr-3 text-right">{votes}</td>
      <td className="py-2">
        <div className="flex flex-wrap gap-1">
          <button className={small} disabled={save.pending} onClick={() => save.run(() => saveUser(id, name, admin))}>
            Save
          </button>
          {votes > 0 && (
            <button
              className="btn bg-red-soft text-xs py-1! px-3!"
              disabled={wipe.pending}
              onClick={() => {
                if (window.confirm(`Remove all ${votes} votes cast by ${email}?`)) wipe.run(() => deleteUserVotes(id));
              }}
            >
              Remove votes
            </button>
          )}
        </div>
        {save.note}
        {wipe.note}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Homepage numbers
// ---------------------------------------------------------------------------

export function HomepageStatsForm({ shown }: { shown: { sites: number; votes: number; backlinks: number } }) {
  const { pending, run, note } = useAction();
  const [f, setF] = useState(shown);
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHomepageStats(f));
      }}
    >
      <label className={label}>
        Sites
        <Num value={f.sites} onChange={(n) => setF({ ...f, sites: n })} />
      </label>
      <label className={label}>
        Votes
        <Num value={f.votes} onChange={(n) => setF({ ...f, votes: n })} />
      </label>
      <label className={label}>
        Backlinks won
        <Num value={f.backlinks} onChange={(n) => setF({ ...f, backlinks: n })} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button className="btn bg-red text-white" disabled={pending}>
          Save numbers
        </button>
        {note}
      </div>
    </form>
  );
}
