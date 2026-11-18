import Link from "next/link";
import { QualifyingVoteButton } from "@/app/arena/QualifyingVoteButton";
import { PREMIUM_FRAME } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import type { LeaderboardRow } from "@/lib/data";

/**
 * One side of the stadium around the bracket: a dark stand of qualifying brands.
 * On xl screens it fills the bracket's height and scrolls; below that it stacks under the bracket.
 */
export function StadiumStand({
  side,
  eyebrow,
  title,
  rows,
  startRank,
  cutAt,
  tournamentId,
  qualifying,
  userId,
  voted,
  empty,
}: {
  side: "L" | "R";
  eyebrow: string;
  title: string;
  rows: LeaderboardRow[];
  /** Rank of the first row (1-based). */
  startRank: number;
  /** Last rank inside the bracket; rows after it are dimmed. */
  cutAt: number;
  tournamentId: string;
  qualifying: boolean;
  userId: string | null;
  voted: Set<string>;
  empty: React.ReactNode;
}) {
  return (
    <aside
      style={PREMIUM_FRAME}
      className={`relative min-h-[18rem] overflow-hidden rounded-[1.25rem] xl:origin-center ${
        side === "L" ? "xl:[transform:perspective(1600px)_rotateY(7deg)]" : "xl:[transform:perspective(1600px)_rotateY(-7deg)]"
      }`}
    >
      {/* Floodlight from the pitch side */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 w-24 ${
          side === "L" ? "right-0 bg-linear-to-l" : "left-0 bg-linear-to-r"
        } from-amber-300/10 to-transparent`}
      />
      <div className="relative flex max-h-[34rem] flex-col xl:absolute xl:inset-0 xl:max-h-none">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">{eyebrow}</p>
          <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-tight text-white">{title}</p>
          <p className="text-[11px] text-white/45">
            {rows.length} {rows.length === 1 ? "brand" : "brands"}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-5 text-center text-sm text-white/60">{empty}</div>
        ) : (
          <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin]">
            {rows.map((r, i) => (
              <StandRow
                key={r.product.id}
                row={r}
                rank={startRank + i}
                cutAt={cutAt}
                tournamentId={tournamentId}
                qualifying={qualifying}
                userId={userId}
                voted={voted}
              />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

/** One brand in a dark stand. `wide` shows the description and the longer "voting opens" text. */
export function StandRow({
  row: r,
  rank,
  cutAt,
  tournamentId,
  qualifying,
  userId,
  voted,
  wide = false,
}: {
  row: LeaderboardRow;
  rank: number;
  cutAt: number;
  tournamentId: string;
  qualifying: boolean;
  userId: string | null;
  voted: Set<string>;
  wide?: boolean;
}) {
  const seeded = r.entry_path !== "free";
  const top3 = rank <= 3;
  return (
    <li
      className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${wide ? "sm:gap-3 sm:px-3.5 sm:py-2.5" : ""} ${
        top3 ? "border-amber-300/30 bg-amber-300/[0.07]" : "border-white/10 bg-white/[0.04]"
      } ${rank > cutAt ? "opacity-75" : ""}`}
    >
      <span
        className={`w-6 shrink-0 text-center font-display text-sm font-extrabold tabular-nums ${
          top3 ? "text-amber-300" : "text-white/40"
        }`}
      >
        {rank}
      </span>
      <ProductLogo src={r.product.logo_url} name={r.product.name} size={wide ? 40 : 32} className="bg-white" />
      <span className="min-w-0 flex-1">
        <Link
          href={`/p/${r.product.slug}`}
          className="block truncate text-sm font-semibold text-white hover:underline"
          title={r.product.name}
        >
          {r.product.name}
        </Link>
        {wide && <span className="block truncate text-xs text-white/45">{r.product.description ?? r.product.domain}</span>}
      </span>
      {seeded ? (
        <span className="shrink-0 rounded-full bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
          Seeded
        </span>
      ) : (
        <>
          <span className="shrink-0 font-display text-base font-extrabold tabular-nums text-white">{r.votes}</span>
          {qualifying ? (
            <QualifyingVoteButton
              tournamentId={tournamentId}
              productId={r.product.id}
              own={userId === r.product.owner_id}
              voted={voted.has(r.product.id)}
            />
          ) : (
            <span className="shrink-0 text-[10px] text-white/40">{wide ? "Voting opens soon" : "Soon"}</span>
          )}
        </>
      )}
    </li>
  );
}
