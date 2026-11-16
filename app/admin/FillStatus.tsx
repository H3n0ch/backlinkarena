import type { Entry, Match, Product, Tournament } from "@/lib/types";

type Seat = { product: Product; kind: "pass" | "badge" | "free"; votes: number };

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const KIND_STYLE: Record<Seat["kind"], string> = {
  pass: "bg-ink text-white",
  badge: "bg-blue text-white",
  free: "bg-sun text-ink",
};
const KIND_LABEL: Record<Seat["kind"], string> = { pass: "Pass", badge: "Badge", free: "Free" };

/**
 * Visual fill status of the active tournament: one cell per bracket spot, who would get it
 * right now (guaranteed first, then free entries by votes), what's missing before the
 * bracket can start, and which paid / badge brands are waiting for the next tournament.
 */
export function FillStatus({
  tournament,
  entries,
  matches,
  products,
  qualifyingVotes,
}: {
  tournament: Tournament | null;
  entries: Entry[];
  matches: Match[];
  products: Product[];
  /** product id -> qualifying votes including admin adjustment */
  qualifyingVotes: Map<string, number>;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const open = tournament && (tournament.status === "draft" || tournament.status === "qualifying");
  const entered = new Set(open ? entries.map((e) => e.product_id) : []);
  const waiting = products.filter((p) => (p.pass_paid || p.badge_status === "verified") && !entered.has(p.id));

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold">Bracket fill</h2>
        <Legend />
      </div>
      {tournament && tournament.status !== "finished" ? (
        tournament.status === "bracket" ? (
          <BracketFill tournament={tournament} matches={matches} byId={byId} />
        ) : (
          <QualifyingFill tournament={tournament} entries={entries} byId={byId} qualifyingVotes={qualifyingVotes} />
        )
      ) : (
        <p className="mt-3 text-sm text-muted">No tournament is open. Create one: everyone in the queue below is entered automatically.</p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="font-bold">
          Waiting for the next tournament <span className="text-muted">({waiting.length})</span>
        </h3>
        <p className="text-xs text-muted">
          Paid passes and verified badges not in an open tournament. They are entered automatically when you create
          the next one.
        </p>
        {waiting.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {waiting.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm">
                <Chip kind={p.pass_paid ? "pass" : "badge"} />
                <span className="font-semibold">{p.name}</span>
                <span className="text-muted">{p.domain}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nobody is waiting.</p>
        )}
      </div>
    </section>
  );
}

function QualifyingFill({
  tournament,
  entries,
  byId,
  qualifyingVotes,
}: {
  tournament: Tournament;
  entries: Entry[];
  byId: Map<string, Product>;
  qualifyingVotes: Map<string, number>;
}) {
  const size = tournament.bracket_size;
  // Same order the engine seeds in: guaranteed by signup, then free by votes, then signup.
  const seats: Seat[] = entries
    .filter((e) => byId.has(e.product_id))
    .map((e) => ({
      product: byId.get(e.product_id)!,
      kind: e.entry_path,
      votes: qualifyingVotes.get(e.product_id) ?? 0,
      at: e.created_at,
    }))
    .sort((a, b) => {
      const ga = a.kind === "free" ? 1 : 0;
      const gb = b.kind === "free" ? 1 : 0;
      if (ga !== gb) return ga - gb;
      if (ga === 1 && a.votes !== b.votes) return b.votes - a.votes;
      return Date.parse(a.at) - Date.parse(b.at);
    });
  const guaranteed = seats.filter((s) => s.kind !== "free").length;
  const filled = Math.min(seats.length, size);
  const missing = size - filled;
  const full = missing === 0;
  const ends = tournament.qualifying_ends_at ? dateFmt.format(new Date(tournament.qualifying_ends_at)) : null;

  let status: { text: string; tone: string };
  if (tournament.status === "draft") {
    status = full
      ? { text: "Draft · full. Start qualifying to open voting.", tone: "bg-mint-soft" }
      : { text: `Draft · ${missing} more ${missing === 1 ? "brand" : "brands"} needed.`, tone: "bg-sun/40" };
  } else if (full) {
    status = tournament.qualifying_overtime
      ? { text: "Full ✓ The bracket starts on the next scheduled run (within 5 minutes).", tone: "bg-mint-soft" }
      : { text: `Full ✓ The bracket starts when qualifying ends${ends ? ` (${ends})` : ""}.`, tone: "bg-mint-soft" };
  } else {
    status = tournament.qualifying_overtime
      ? {
          text: `Overtime: qualifying time is up but ${missing} ${missing === 1 ? "spot is" : "spots are"} still empty. Voting stays open and the bracket starts as soon as it's full.`,
          tone: "bg-red-soft",
        }
      : {
          text: `${missing} more ${missing === 1 ? "brand" : "brands"} needed. If it isn't full by ${ends ?? "the end of qualifying"}, qualifying keeps running until it is.`,
          tone: "bg-sun/40",
        };
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-display text-4xl font-extrabold tabular-nums">
          {filled}
          <span className="text-xl text-muted">/{size}</span>
        </p>
        <p className="text-sm text-muted">
          {guaranteed} guaranteed · {seats.length - guaranteed} free
          {seats.length > size && <> · {seats.length - size} would miss out</>}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-[image:var(--grad-brand)] transition-all"
          style={{ width: `${(filled / size) * 100}%` }}
        />
      </div>
      <p className={`mt-3 rounded-xl border border-line p-3 text-sm font-semibold ${status.tone}`}>{status.text}</p>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: size }, (_, i) => {
          const s = seats[i];
          return s ? (
            <li key={s.product.id} className="flex items-center gap-2 rounded-xl border border-line bg-paper p-2 text-sm">
              <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.product.name}</span>
                <span className="block truncate text-xs text-muted">
                  {s.kind === "free" ? `${s.votes} votes` : s.product.domain}
                </span>
              </span>
              <Chip kind={s.kind} />
            </li>
          ) : (
            <li
              key={`empty-${i}`}
              className="flex items-center gap-2 rounded-xl border border-dashed border-stone-300 p-2 text-sm text-muted"
            >
              <span className="w-5 text-center text-xs font-bold">{i + 1}</span>
              Empty spot
            </li>
          );
        })}
      </ol>

      {seats.length > size && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Below the cut ({seats.length - size})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted">
            {seats.slice(size).map((s) => (
              <li key={s.product.id}>
                {s.product.name} · {s.kind === "free" ? `${s.votes} votes` : KIND_LABEL[s.kind]}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BracketFill({
  tournament,
  matches,
  byId,
}: {
  tournament: Tournament;
  matches: Match[];
  byId: Map<string, Product>;
}) {
  const size = tournament.bracket_size;
  const r1 = matches.filter((m) => m.round === 1);
  const slots = Array.from({ length: size / 2 }, (_, i) => r1.find((m) => m.position === i + 1));
  const filled = slots.reduce((n, m) => n + (m?.product_a ? 1 : 0) + (m?.product_b ? 1 : 0), 0);
  return (
    <div className="mt-3">
      <p className="font-display text-4xl font-extrabold tabular-nums">
        {filled}
        <span className="text-xl text-muted">/{size}</span>
      </p>
      <p
        className={`mt-3 rounded-xl border border-line p-3 text-sm font-semibold ${
          filled === size ? "bg-mint-soft" : "bg-red-soft"
        }`}
      >
        {filled === size
          ? "Bracket running with every spot filled."
          : `Bracket running with ${size - filled} empty ${size - filled === 1 ? "spot" : "spots"} in round 1 (started before full). Empty sides give the opponent a bye.`}
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {slots.map((m, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl border border-line bg-paper p-2 text-sm">
            <span className="w-8 text-xs font-bold text-muted">M{i + 1}</span>
            <Side product={m?.product_a ? byId.get(m.product_a) : undefined} />
            <span className="text-xs text-muted">vs</span>
            <Side product={m?.product_b ? byId.get(m.product_b) : undefined} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Side({ product }: { product?: Product }) {
  return product ? (
    <span className="min-w-0 flex-1 truncate font-semibold">{product.name}</span>
  ) : (
    <span className="flex-1 rounded border border-dashed border-stone-300 px-2 text-center text-xs text-muted">empty</span>
  );
}

function Chip({ kind }: { kind: Seat["kind"] }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${KIND_STYLE[kind]}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

function Legend() {
  return (
    <span className="flex gap-2 text-xs text-muted">
      <Chip kind="pass" /> paid $79
      <Chip kind="badge" /> badge
      <Chip kind="free" /> voted in
    </span>
  );
}
