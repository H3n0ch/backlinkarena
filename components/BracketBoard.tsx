import Link from "next/link";
import { ProductLogo } from "@/components/ProductLogo";
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

const DOT = "border-dotted border-stone-400";
const HOT = "border-solid border-red";

export function BracketBoard({
  size,
  matches,
  products,
  projected,
  champion,
}: {
  size: number;
  matches: BoardMatch[];
  products: Map<string, Product>;
  projected?: Product[];
  champion?: Product | null;
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
    c.kind === "trophy" ? "bg-red-soft" : c.kind === "final" ? "bg-red-soft/60" : c.r === currentRound ? "bg-cream" : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
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

            <Label text={label(c)} live={false} bottom />
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

function Label({ text, live, bottom }: { text: string; live: boolean; bottom?: boolean }) {
  return (
    <p
      className={`flex items-center justify-center gap-1 py-2.5 text-center text-[8px] font-extrabold uppercase tracking-wider sm:text-[11px] ${
        bottom ? "border-t border-line" : "border-b border-line"
      } ${live ? "text-red-dark" : "text-muted"}`}
    >
      {live && <span className="hidden h-1.5 w-1.5 animate-pulse rounded-full bg-red sm:inline-block" />}
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
          decided ? "border-solid border-red/60" : DOT
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
      <Link href={`/p/${champion.slug}`} title={champion.name} className="flex flex-col items-center">
        <span className="text-xl sm:text-3xl" aria-hidden="true">
          🏆
        </span>
        <Tile product={champion} won big />
        <span className="mt-1 hidden max-w-24 truncate text-xs font-extrabold text-red-dark lg:block">
          {champion.name}
        </span>
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-red bg-white text-xl sm:h-20 sm:w-20 sm:text-4xl">
        🏆
      </span>
      <span className="mt-2 hidden text-[11px] font-extrabold uppercase leading-tight text-red-dark sm:block">
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
      className={`block rounded-xl bg-white ${big ? TILE_BIG : TILE} ${lost ? "opacity-35 grayscale" : ""} ${
        won ? "ring-2 ring-red ring-offset-2" : ""
      }`}
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
        className={`flex items-center justify-center rounded-xl border-2 border-dashed border-red/60 bg-white text-base font-extrabold text-red transition-colors hover:bg-red-soft sm:text-2xl ${box}`}
      >
        +
      </Link>
    ) : (
      <span className={`block rounded-xl border-2 border-dashed border-stone-300 bg-white ${box}`} />
    );
  }
  return (
    <Link
      href={match && href ? href : `/p/${product.slug}`}
      title={product.name}
      className="group relative block transition-transform hover:-translate-y-0.5"
    >
      <Tile product={product} won={won} lost={lost} big={big} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden w-24 -translate-x-1/2 truncate text-center text-[11px] font-semibold text-ink lg:block">
        {product.name}
      </span>
    </Link>
  );
}
