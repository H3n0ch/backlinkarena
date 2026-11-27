import Link from "next/link";
import { ProductLogo } from "@/components/ProductLogo";
import { GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import type { PublicSponsor } from "@/lib/sponsor-offer";

/**
 * "Official sponsor of <tournament>" banner, shown above the bracket on / and /arena and on
 * every match page. Without an approved sponsor it advertises the open slot, linking to /sponsor.
 */
export function SponsorCard({
  sponsor,
  tournamentName,
  className = "",
}: {
  sponsor: PublicSponsor | null;
  tournamentName?: string | null;
  className?: string;
}) {
  const of = tournamentName ? `of ${tournamentName}` : "of this tournament";

  if (!sponsor) {
    return (
      <aside className={`mx-auto max-w-5xl px-3 sm:px-4 ${className}`}>
        <Link
          href="/sponsor"
          className="flex flex-col items-start gap-3 rounded-[0.875rem] border border-dashed border-red/40 bg-card px-4 py-3 text-sm transition hover:border-red sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="text-xs font-bold uppercase tracking-widest text-red-dark">
              Official sponsor {of} · slot open
            </span>
            <span className="block font-semibold">
              Your product here, in front of every founder in the tournament.
            </span>
          </span>
          <span className="btn shrink-0 border-red bg-red text-white">Become the sponsor →</span>
        </Link>
      </aside>
    );
  }

  return (
    <aside aria-label="Tournament sponsor" className={`mx-auto max-w-5xl px-3 sm:px-4 ${className}`}>
      <div style={PREMIUM_FRAME} className="relative overflow-hidden rounded-[0.875rem] p-5 sm:p-6">
        <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
            <ProductLogo src={sponsor.logo_url} name={sponsor.brand_name} size={72} className="ring-2 ring-amber-300/60" />
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-200 ring-1 ring-amber-300/40">
                <span aria-hidden="true">★</span> Official sponsor {of}
              </p>
              <p className="headline mt-2 text-3xl leading-tight sm:text-4xl" style={GOLD_TEXT}>
                {sponsor.brand_name}
              </p>
              <p className="mt-1 text-sm text-white/80 sm:text-base">{sponsor.tagline}</p>
            </div>
          </div>
          <a
            href={`/api/sponsor/${sponsor.id}/click`}
            target="_blank"
            rel="sponsored noopener"
            className="btn shrink-0 border-mint bg-mint text-center text-white shadow-[0_8px_24px_-8px_rgb(22_163_74/0.7)] hover:brightness-110"
          >
            Visit {sponsor.brand_name} →
          </a>
        </div>
      </div>
      <p className="mt-2 text-right text-xs">
        <Link href="/sponsor" className="font-semibold text-muted underline hover:text-ink">
          Become the next sponsor →
        </Link>
      </p>
    </aside>
  );
}
