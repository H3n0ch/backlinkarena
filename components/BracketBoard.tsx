import Link from "next/link";
import { ProductLogo } from "@/components/ProductLogo";
import { PREMIUM_FRAME } from "@/components/premium";
import { matchPath } from "@/lib/share";
import type { Counts, Match, Product } from "@/lib/types";

type BoardMatch = Match & { counts: Counts };
type Side = "L" | "R";

type Pair = { match?: BoardMatch; a?: Product | null; b?: Product | null };

type Column =
  | { key: string; kind: "side"; r: number; side: Side }
  | { key: string; kind: "final"; side: Side }
  | { key: string; kind: "trophy" };

/*
  Geometry: every column body has the same height. A round-r column holds
  (matches/2) pairs, each pair is a 2-row grid, so tile centers sit exactly at
  the midpoints of the previous round's pairs. Connectors are dotted borders:
  tile → outer edge (horizontal), a vertical join on the column edge between
  the pair's two tiles, and an inner stub from the column edge to the next tile.
*/

const DOT = "border-dashed border-white/30";
const HOT = "border-solid border-amber-400 shadow-[0_0_10px_rgb(251_191_36/0.7)]";

const FRAME_STYLE = PREMIUM_FRAME;

export function BracketBoard({
  size,
  matches,
  products,
  projected,
  champion,
  header,
}: {
  size: number;
  matches: BoardMatch[];
  products: Map<string, Product>;
  projected?: Product[];
  champion?: Product | null;
  header?: React.ReactNode;
}) {
  const rounds = Math.log2(size);
  const byKey = new Map(matches.map((m) => [`${m.round}-${m.position}`, m]));
  const live = matches.filter((m) => m.status === "open").map((m) => m.round);
  const currentRound = live.length ? Math.max(...live) : 0;

  function pair(r: number, pos: number): Pair {
    const m = byKey.get(`${r}-${pos}`);
    if (m) {
      return {
        match: m,
        a: m.product_a ? products.get(m.product_a) ?? null : null,
        b: m.product_b ? products.get(m.product_b) ?? null : null,
      };
    }
    if (r === 1 && projected) return { a: projected[2 * pos - 2] ?? null, b: projected[2 * pos - 1] ?? null };
    return {};
  }

  function positions(r: number, side: Side) {
    const half = size / 2 ** r / 2;
    const start = side === "L" ? 1 : half + 1;
    return Array.from({ length: half }, (_, i) => start + i);
  }

  const sideRounds = Array.from({ length: rounds - 1 }, (_, i) => i + 1);
  const final = pair(rounds, 1);
  const invite = matches.length === 0;

  const columns: Column[] = [
    ...sideRounds.map((r) => ({ key: `L${r}`, kind: "side" as const, r, side: "L" as const })),
    { key: "FA", kind: "final", side: "L" },
    { key: "T", kind: "trophy" },
    { key: "FB", kind: "final", side: "R" },
    ...[...sideRounds].reverse().map((r) => ({ key: `R${r}`, kind: "side" as const, r, side: "R" as const })),
  ];

  const label = (c: Column) =>
    c.kind === "trophy" ? "Winner" : c.kind === "final" ? "Final" : roundLabel(c.r, size);

  const tint = (c: Column) =>
    c.kind === "trophy"
      ? ""
      : c.kind === "final"
        ? "bg-amber-300/[0.035]"
        : c.r === currentRound
          ? "bg-white/[0.03]"
          : "";

  return (
    <div className="relative overflow-hidden rounded-[1.25rem]" style={FRAME_STYLE}>
      {header && <div className="relative border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">{header}</div>}
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((c) => (
          <div key={c.key} className={`flex flex-col ${tint(c)}`}>
            <Label text={label(c)} live={c.kind === "side" && c.r === currentRound} />

            <div className="flex h-[26rem] flex-col py-4 sm:h-[38rem] lg:h-[44rem]">
              {c.kind === "trophy" ? (
                <Row inner outer side="L" hot={Boolean(champion)} hotBoth={Boolean(champion)}>
                  <Trophy champion={champion} />
                </Row>
              ) : c.kind === "final" ? (
                <FinalSlot side={c.side} pair={final} />
              ) : (
                positions(c.r, c.side).map((pos) => {
                  const p = pair(c.r, pos);
                  return (
                    <PairBox
                      key={pos}
                      side={c.side}
                      first={c.r === 1}
                      pair={p}
                      invite={invite && c.r === 1}
                    />
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function roundLabel(r: number, size: number) {
  const left = size / 2 ** (r - 1);
  return left === 4 ? "Semifinal" : left === 8 ? "Quarterfinal" : `Round ${r}`;
}

function Label({ text, live }: { text: string; live: boolean }) {
  const gold = text === "Final" || text === "Winner";
  return (
    <p
      className={`flex items-center justify-center gap-1.5 border-b border-white/10 py-3 text-center text-[8px] font-bold uppercase tracking-wider sm:text-[10px] sm:tracking-[0.2em] ${
        live ? "text-amber-300" : gold ? "text-amber-200/80" : "text-white/40"
      }`}
    >
      {live && (
        <span className="relative hidden h-1.5 w-1.5 sm:inline-flex">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/70" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-amber-400" />
        </span>
      )}
      <span className="truncate sm:hidden">
        {text === "Quarterfinal" ? "QF" : text === "Semifinal" ? "SF" : text}
      </span>
      <span className="hidden truncate sm:inline">{text}</span>
    </p>
  );
}

/** One horizontal lane: [inner line] [content] [outer line], mirrored for the right half. */
function Row({
  children,
  side,
  inner,
  outer,
  hot,
  hotBoth,
}: {
  children: React.ReactNode;
  side: Side;
  inner: boolean;
  outer: boolean;
  hot: boolean;
  hotBoth?: boolean;
}) {
  const line = (show: boolean, isHot: boolean) =>
    show ? <span className={`h-0 flex-1 border-t-2 ${isHot ? HOT : DOT}`} /> : <span className="flex-1" />;
  const innerLine = line(inner, Boolean(hotBoth));
  const outerLine = line(outer, hot);
  return (
    <div className="flex flex-1 items-center">
      {side === "L" ? innerLine : outerLine}
      <div className="relative shrink-0">{children}</div>
      {side === "L" ? outerLine : innerLine}
    </div>
  );
}

function PairBox({ side, first, pair, invite }: { side: Side; first: boolean; pair: Pair; invite: boolean }) {
  const decided = pair.match?.status === "closed" ? pair.match.winner_product_id : null;
  const aWon = Boolean(decided && pair.a && decided === pair.a.id);
  const bWon = Boolean(decided && pair.b && decided === pair.b.id);
  return (
    <div className="relative grid flex-1 grid-rows-2">
      {/* vertical join on the outer edge, between the two tile centers */}
      <span
        aria-hidden="true"
        className={`absolute top-1/4 bottom-1/4 ${side === "L" ? "right-0 border-r-2" : "left-0 border-l-2"} ${
          decided ? "border-solid border-amber-400/60" : DOT
        }`}
      />
      <Row side={side} inner={!first} outer hot={aWon}>
        <Slot product={pair.a} match={pair.match} href={hrefOf(pair)} invite={invite} won={aWon} lost={Boolean(decided) && !aWon} />
      </Row>
      <Row side={side} inner={!first} outer hot={bWon}>
        <Slot product={pair.b} match={pair.match} href={hrefOf(pair)} invite={invite} won={bWon} lost={Boolean(decided) && !bWon} />
      </Row>
    </div>
  );
}

function FinalSlot({ side, pair }: { side: Side; pair: Pair }) {
  const product = side === "L" ? pair.a : pair.b;
  const match = pair.match;
  const decided = match?.status === "closed" ? match.winner_product_id : null;
  const won = Boolean(decided && product && decided === product.id);
  return (
    <Row side={side} inner outer hot={won}>
      <Slot product={product} match={match} href={hrefOf(pair)} invite={false} won={won} lost={Boolean(decided) && !won} big />
    </Row>
  );
}

function Trophy({ champion }: { champion?: Product | null }) {
  if (champion) {
    return (
      <Link href={`/p/${champion.slug}`} title={champion.name} className="group flex flex-col items-center">
        <span className="mb-1 text-lg drop-shadow-[0_0_12px_rgb(251_191_36/0.8)] sm:text-3xl" aria-hidden="true">
          🏆
        </span>
        <span className="relative">
          <span aria-hidden="true" className="absolute -inset-3 rounded-2xl bg-amber-400/30 blur-xl" />
          <span className="relative block">
            <Tile product={champion} won big />
          </span>
        </span>
        <span className="text-gold mt-2 hidden max-w-24 truncate font-display text-xs font-extrabold uppercase lg:block">
          {champion.name}
        </span>
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <span className="relative flex h-11 w-11 items-center justify-center sm:h-20 sm:w-20 lg:h-24 lg:w-24">
        <span aria-hidden="true" className="absolute -inset-2 rounded-full bg-amber-400/25 blur-xl" />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#fde68a,#f59e0b,#fff7ed,#b45309,#fde68a)] p-[2px]"
        >
          <span className="block h-full w-full rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0c0a09)]" />
        </span>
        <span className="relative text-xl drop-shadow-[0_0_10px_rgb(251_191_36/0.6)] sm:text-4xl" aria-hidden="true">
          🏆
        </span>
      </span>
      <span className="mt-3 hidden text-[9px] font-semibold uppercase tracking-[0.25em] text-white/45 sm:block">
        Grand prize
      </span>
      <span className="text-gold mt-1 hidden font-display text-sm font-extrabold uppercase leading-tight sm:block lg:text-base">
        DA 50+
        <br />
        backlink
      </span>
    </div>
  );
}

const TILE = "h-8 w-8 sm:h-14 sm:w-14 lg:h-16 lg:w-16";
const TILE_BIG = "h-9 w-9 sm:h-16 sm:w-16 lg:h-20 lg:w-20";

function Tile({ product, won, lost, big }: { product: Product; won?: boolean; lost?: boolean; big?: boolean }) {
  return (
    <span
      className={`block rounded-xl bg-white ring-1 ring-white/15 shadow-[0_10px_24px_-10px_rgb(0_0_0/0.9)] ${big ? TILE_BIG : TILE} ${
        lost ? "opacity-30 grayscale" : ""
      } ${won ? "ring-2! ring-amber-400! ring-offset-2 ring-offset-stone-950 shadow-[0_0_22px_-2px_rgb(251_191_36/0.6)]" : ""}`}
    >
      <ProductLogo src={product.logo_url} name={product.name} size={80} className="h-full! w-full! rounded-xl! p-1!" />
    </span>
  );
}

function hrefOf(pair: Pair): string | undefined {
  return pair.match ? matchPath(pair.match, pair.a?.slug, pair.b?.slug) : undefined;
}

function Slot({
  product,
  match,
  href,
  invite,
  won,
  lost,
  big,
}: {
  product?: Product | null;
  match?: BoardMatch;
  href?: string;
  invite: boolean;
  won: boolean;
  lost: boolean;
  big?: boolean;
}) {
  const box = big ? TILE_BIG : TILE;
  if (!product) {
    return invite ? (
      <Link
        href="/join"
        title="Claim this spot"
        className={`flex items-center justify-center rounded-xl border border-dashed border-amber-300/50 bg-amber-300/[0.06] text-base font-light text-amber-200 transition-all hover:border-amber-300 hover:bg-amber-300/15 hover:shadow-[0_0_20px_-4px_rgb(251_191_36/0.6)] sm:text-2xl ${box}`}
      >
        +
      </Link>
    ) : (
      <span className={`block rounded-xl border border-dashed border-white/15 bg-white/[0.03] ${box}`} />
    );
  }
  return (
    <Link
      href={match && href ? href : `/p/${product.slug}`}
      title={product.name}
      className="group relative block transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105"
    >
      <Tile product={product} won={won} lost={lost} big={big} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden w-24 -translate-x-1/2 truncate text-center text-[11px] font-medium text-white/65 group-hover:text-white lg:block">
        {product.name}
      </span>
    </Link>
  );
}
