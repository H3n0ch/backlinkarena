import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { Countdown } from "@/components/Countdown";
import { ProductLogo } from "@/components/ProductLogo";
import { matchPath, matchShareUrl } from "@/lib/share";
import type { Counts, Match, Product } from "@/lib/types";

function Side({ p, align, won, lost }: { p?: Product; align: "left" | "right"; won: boolean; lost: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-cream p-3 ${
        won ? "border-red" : "border-line"
      } ${lost ? "opacity-50" : ""} ${align === "right" ? "flex-row-reverse text-right sm:flex-row sm:text-left" : ""}`}
    >
      <ProductLogo src={p?.logo_url ?? null} name={p?.name ?? "?"} size={44} />
      <div className="min-w-0">
        <p className="truncate font-bold">{p?.name ?? "TBD"}</p>
        <p className="truncate text-xs text-muted">{p?.domain ?? ""}</p>
        {p?.category && (
          <span className="mt-1 inline-block rounded bg-white px-1.5 text-[10px] font-semibold text-muted">
            {p.category}
          </span>
        )}
      </div>
    </div>
  );
}

export function MatchupCard({
  match,
  a,
  b,
}: {
  match: Match & { counts: Counts };
  a?: Product;
  b?: Product;
}) {
  const { a_votes, b_votes } = match.counts;
  const total = a_votes + b_votes;
  const pctA = total ? (a_votes / total) * 100 : 50;
  const closed = match.status === "closed";
  const winA = closed && match.winner_product_id === a?.id;
  const winB = closed && match.winner_product_id === b?.id;
  const path = matchPath(match, a?.slug, b?.slug);

  return (
    <article className="card p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Side p={a} align="left" won={winA} lost={closed && !winA} />
        <Side p={b} align="right" won={winB} lost={closed && !winB} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="w-8 text-sm font-extrabold text-red tabular-nums">{a_votes}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[linear-gradient(90deg,#14b8a6,#0d9488)]">
          <div className="h-full bg-[image:var(--grad-brand)] transition-[width] duration-700" style={{ width: `${pctA}%` }} />
        </div>
        <span className="w-8 text-right text-sm font-extrabold text-blue tabular-nums">{b_votes}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 items-center gap-2">
        <span className="text-xs text-muted">
          {closed ? "Ended" : (
            <>
              Ends in <Countdown to={match.ends_at} endedText="now" />
            </>
          )}
        </span>
        <Link
          href={path}
          className="btn justify-self-center border-red bg-red py-1.5! px-6! text-sm text-white"
        >
          {closed ? "Result" : "Vote"}
        </Link>
        <span className="justify-self-end">
          <CopyButton
            text={matchShareUrl(path)}
            label="Share"
            className="btn border-red/40 bg-red-soft py-1.5! px-3! text-sm text-red-dark"
          />
        </span>
      </div>
    </article>
  );
}
