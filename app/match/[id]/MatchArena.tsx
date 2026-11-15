"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { castVote } from "@/app/actions/vote";
import { Countdown } from "@/components/Countdown";
import { JoinField } from "@/components/JoinField";
import { ProductLogo } from "@/components/ProductLogo";
import { ShareButtons } from "@/components/ShareButtons";
import { SiteSkeleton } from "@/components/SiteSkeleton";
import { oneTapSignIn } from "@/lib/google-one-tap";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import type { Counts } from "@/lib/types";

export type ArenaProduct = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  description: string | null;
  logo: string | null;
  url: string | null;
};

type Viewer = {
  loggedIn: boolean;
  owns: boolean;
  votedFor: string | null;
  nextMatchId: string | null;
  allDone: boolean;
};

type Key = "a" | "b";

const GATE_SECONDS = 5;
const POLL_MS = 10_000;
const SPLITS = [25, 50, 75];

const SIDE = {
  a: { solid: "bg-red", text: "text-red", soft: "bg-red-soft" },
  b: { solid: "bg-blue", text: "text-blue", soft: "bg-blue-soft" },
} as const;

function ThumbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M7 10v11H3V10h4Zm0 0 4-8c1.7 0 3 1.3 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The real website in a big window. Shows a website-shaped skeleton until it has loaded.
 *  - Sites that allow framing load directly from their own address.
 *  - Sites that block framing load through /api/site/[id]: their real server-rendered homepage,
 *    without scripts, sandboxed in an opaque origin (it can't touch our cookies or session).
 * Which of the two is decided in the background by /api/site/[id]/mode, so the page never waits on it.
 */
function SitePane({ p }: { p: ArenaProduct | null }) {
  const [direct, setDirect] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!p?.url) return;
    let cancelled = false;
    fetch(`/api/site/${p.id}/mode`)
      .then((r) => (r.ok ? r.json() : { direct: false }))
      .then((j: { direct: boolean }) => !cancelled && setDirect(Boolean(j.direct)))
      .catch(() => !cancelled && setDirect(false));
    return () => {
      cancelled = true;
    };
  }, [p?.id, p?.url]);

  if (!p) {
    return <div className="flex h-full items-center justify-center text-muted">Waiting for opponent</div>;
  }
  if (!p.url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <ProductLogo src={p.logo} name={p.name} size={96} />
        <p className="font-display text-2xl font-extrabold">{p.name}</p>
        {p.description && <p className="max-w-md">{p.description}</p>}
      </div>
    );
  }
  return (
    <div className="relative h-full">
      {direct !== null && (
        <iframe
          src={direct ? p.url : `/api/site/${p.id}`}
          title={`${p.name} website`}
          onLoad={() => setLoaded(true)}
          className={`h-full w-full border-0 bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          // Direct: the site keeps its own origin. Proxied: no scripts, no same-origin, fully isolated.
          sandbox={
            direct
              ? "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              : "allow-popups allow-popups-to-escape-sandbox"
          }
          referrerPolicy="no-referrer"
        />
      )}
      {!loaded && <SiteSkeleton label={`Loading ${p.domain}…`} />}
    </div>
  );
}

export function MatchArena(props: {
  matchId: string;
  tournamentName: string;
  roundLabel: string;
  a: ArenaProduct | null;
  b: ArenaProduct | null;
  initialCounts: Counts;
  startsAt: string;
  endsAt: string;
  initialStatus: "open" | "closed";
  initialWinner: string | null;
  viewer: Viewer;
  refSlug: string | null;
  googleEnabled: boolean;
  shareLink: string;
}) {
  const { matchId, viewer } = props;
  const products = { a: props.a, b: props.b };
  const [counts, setCounts] = useState(props.initialCounts);
  const [status, setStatus] = useState(props.initialStatus);
  const [winner, setWinner] = useState(props.initialWinner);
  const [votedFor, setVotedFor] = useState(viewer.votedFor);
  const [nextMatchId, setNextMatchId] = useState(viewer.nextMatchId);
  const [allDone, setAllDone] = useState(viewer.allDone);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState(GATE_SECONDS);
  const [ended, setEnded] = useState(false);
  const [pending, start] = useTransition();
  const [split, setSplit] = useState(1); // index into SPLITS = width of side A on desktop
  const [mobileSide, setMobileSide] = useState<Key>("a");
  const [sheet, setSheet] = useState<"share" | "voted" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const autoVoted = useRef(false);
  const [loggedIn, setLoggedIn] = useState(viewer.loggedIn);

  const live = status === "open" && !ended;
  // Eligible to vote (logged-out visitors too: their click starts sign-in, then the vote is cast).
  const canVote = live && !viewer.owns && !votedFor && Boolean(props.a && props.b);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setEnded(now >= Date.parse(props.endsAt) || now < Date.parse(props.startsAt));
    };
    const first = setTimeout(check, 0);
    const id = setInterval(check, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [props.endsAt, props.startsAt]);

  // 5-second look-before-you-vote countdown.
  useEffect(() => {
    if (!canVote || gate <= 0) return;
    const id = setTimeout(() => setGate((g) => g - 1), 1000);
    return () => clearTimeout(id);
  }, [canVote, gate]);

  // Live counts.
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/match/${matchId}/counts`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const j = (await res.json()) as Counts & { status: "open" | "closed" | null; winner: string | null };
        setCounts({ a_votes: j.a_votes, b_votes: j.b_votes });
        if (j.status) setStatus(j.status);
        setWinner(j.winner);
      } catch {}
    }
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [matchId]);

  // Messages disappear on their own.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // Lock page scroll behind the full-screen arena.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function vote(productId: string) {
    setError(null);
    start(async () => {
      const r = await castVote(matchId, productId, props.refSlug);
      if (r.ok && r.data) {
        setCounts(r.data.counts);
        setVotedFor(productId);
        setNextMatchId(r.data.nextMatchId);
        setAllDone(!r.data.nextMatchId);
        const next = r.data.nextMatchId;
        if (next) {
          // Like a feed: thank them briefly, then straight on to the next matchup.
          setNotice("✓ Vote counted! On to the next matchup…");
          setTimeout(() => router.push(`/match/${next}`), 1400);
        } else {
          setSheet("voted");
        }
      } else if (!r.ok) {
        setError(r.error);
        if (r.error.includes("already voted")) setVotedFor("unknown");
      }
    });
  }

  /**
   * Logged-out click:
   *  1. Google One Tap ("Continue as …") right on this page, then the vote is cast immediately;
   *  2. otherwise sign in via redirect (Google if enabled, else email) and the vote is cast on return.
   */
  async function signInThenVote(productId: string) {
    setNotice("Confirm with Google to count your vote…");
    const signedIn = await oneTapSignIn();
    setNotice(null);
    if (signedIn) {
      setLoggedIn(true);
      vote(productId);
      router.refresh();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("vote", productId);
    const next = `${url.pathname}${url.search}`;
    if (props.googleEnabled) {
      const supabase = createSupabaseBrowser();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (!err) return;
    }
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  // Back from sign-in with ?vote=<product>: cast that vote right away, once.
  useEffect(() => {
    if (autoVoted.current) return;
    autoVoted.current = true;
    const url = new URL(window.location.href);
    const intended = url.searchParams.get("vote");
    if (!intended) return;
    url.searchParams.delete("vote");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (!viewer.loggedIn || ![props.a?.id, props.b?.id].includes(intended)) return;
    const t = setTimeout(() => {
      if (viewer.owns) setError("This is your matchup, so you can't vote here. Share it so others vote for you!");
      else if (!votedFor && status === "open") vote(intended);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function voteButton(k: Key, compact = false) {
    const p = products[k];
    const base = `btn shrink-0 ${compact ? "py-1.5! px-3! text-sm" : "py-2! px-4!"}`;
    if (!p) return null;
    if (!live) {
      return winner === p.id ? (
        <span className={`${base} border-sun bg-sun`}>🏆 Winner</span>
      ) : (
        <span className={`${base} bg-cream text-muted`}>Closed</span>
      );
    }
    if (!loggedIn) {
      return (
        <button
          className={`${base} border-transparent bg-red text-white`}
          disabled={gate > 0}
          onClick={() => signInThenVote(p.id)}
        >
          <ThumbIcon /> {gate > 0 ? `vote in ${gate}` : "vote"}
        </button>
      );
    }
    if (votedFor === p.id) return <span className={`${base} bg-red-soft text-red-dark`}>✓ Voted</span>;
    if (viewer.owns || votedFor) {
      return (
        <button
          className={`${base} bg-cream text-muted`}
          onClick={() => {
            setError(
              viewer.owns
                ? "This is your matchup, so you can't vote here. Share it so others vote for you!"
                : "You already voted in this matchup.",
            );
            if (viewer.owns) setSheet("share");
          }}
        >
          <ThumbIcon /> vote
        </button>
      );
    }
    return (
      <button
        className={`${base} border-transparent bg-red text-white`}
        disabled={gate > 0 || pending}
        onClick={() => vote(p.id)}
      >
        <ThumbIcon /> {gate > 0 ? `vote in ${gate}` : pending ? "…" : "vote"}
      </button>
    );
  }

  function paneHeader(k: Key) {
    const p = products[k];
    return (
      <div className={`flex h-16 min-w-0 items-center gap-3 bg-white px-3 sm:px-4 ${k === "b" ? "border-l border-line" : ""}`}>
        {k === "a" && (
          <Link
            href="/arena"
            aria-label="Back to the arena"
            className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-ink hover:bg-cream"
          >
            ←
          </Link>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-extrabold">{p?.name ?? "TBD"}</p>
            {p?.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener"
                title="Open the live site in a new tab"
                className="block truncate text-xs text-muted hover:text-red-dark hover:underline"
              >
                {p.domain} ↗
              </a>
            ) : (
              <p className="truncate text-xs text-muted">{p?.domain ?? ""}</p>
            )}
          </div>
          <ProductLogo src={p?.logo ?? null} name={p?.name ?? "?"} size={36} className="rounded-lg!" />
        </div>
        {voteButton(k)}
      </div>
    );
  }

  const widthA = SPLITS[split];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Desktop: two headers + two big site panes side by side */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="flex shrink-0 border-b border-line">
          <div style={{ width: `${widthA}%` }} className="min-w-0 transition-[width] duration-300">
            {paneHeader("a")}
          </div>
          <div style={{ width: `${100 - widthA}%` }} className="min-w-0 transition-[width] duration-300">
            {paneHeader("b")}
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1">
          <div style={{ width: `${widthA}%` }} className="min-w-0 transition-[width] duration-300">
            <SitePane key={products.a?.id ?? "a"} p={products.a} />
          </div>
          <div style={{ width: `${100 - widthA}%` }} className="min-w-0 border-l border-line transition-[width] duration-300">
            <SitePane key={products.b?.id ?? "b"} p={products.b} />
          </div>
          <div
            className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-line bg-white shadow-md transition-[left] duration-300"
            style={{ left: `${widthA}%` }}
          >
            <button
              aria-label="Show more of the right site"
              className="px-2.5 py-2 text-lg leading-none hover:bg-cream disabled:opacity-30"
              disabled={split === 0}
              onClick={() => setSplit((s) => Math.max(0, s - 1))}
            >
              ‹
            </button>
            <button
              aria-label="Show more of the left site"
              className="border-t border-line px-2.5 py-2 text-lg leading-none hover:bg-cream disabled:opacity-30"
              disabled={split === SPLITS.length - 1}
              onClick={() => setSplit((s) => Math.min(SPLITS.length - 1, s + 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: tabs, one site at a time, vote bar at the bottom */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="grid shrink-0 grid-cols-2 border-b border-line">
          {(["a", "b"] as Key[]).map((k) => {
            const p = products[k];
            const active = mobileSide === k;
            return (
              <button
                key={k}
                onClick={() => setMobileSide(k)}
                className={`flex min-w-0 items-center gap-2 border-b-2 px-3 py-2 text-left ${
                  active ? `${SIDE[k].soft} border-current ${SIDE[k].text}` : "border-transparent"
                }`}
              >
                <ProductLogo src={p?.logo ?? null} name={p?.name ?? "?"} size={28} className="rounded-md!" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{p?.name ?? "TBD"}</span>
              </button>
            );
          })}
        </div>
        <div className="relative min-h-0 flex-1">
          <div className={`absolute inset-0 ${mobileSide === "a" ? "" : "invisible"}`}>
            <SitePane key={products.a?.id ?? "a"} p={products.a} />
          </div>
          <div className={`absolute inset-0 ${mobileSide === "b" ? "" : "invisible"}`}>
            <SitePane key={products.b?.id ?? "b"} p={products.b} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-bold">{products[mobileSide]?.name}</span>
            <span className="text-muted"> · tap the other tab to compare</span>
          </p>
          {voteButton(mobileSide, true)}
        </div>
      </div>

      {/* Small floating pill: time left + share. Vote counts stay hidden while voting is open. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center md:bottom-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-white/95 py-1 pr-1 pl-3 text-xs font-semibold shadow-md backdrop-blur">
          <span className="text-muted">
            {props.roundLabel} ·{" "}
            {live ? (
              <span className="text-ink">
                ends in <Countdown to={props.endsAt} />
              </span>
            ) : status === "closed" ? (
              <span className="text-ink">
                {counts.a_votes} : {counts.b_votes}
              </span>
            ) : (
              "voting closed"
            )}
          </span>
          <button onClick={() => setSheet("share")} className="rounded-full bg-red px-3 py-1 font-bold text-white">
            Share
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="absolute left-1/2 top-16 z-40 w-[min(92vw,32rem)] -translate-x-1/2 rounded-2xl bg-mint px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="absolute left-1/2 top-16 z-40 w-[min(92vw,32rem)] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
        >
          {error}
        </div>
      )}

      {/* Bottom sheet: share / after voting */}
      {sheet && (
        <div
          className="absolute inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center"
          onClick={() => setSheet(null)}
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {sheet === "voted" && (
              <div className="mb-5 text-center">
                {allDone ? (
                  <>
                    <p className="font-display text-2xl font-extrabold">
                      You voted on every matchup. Now it&apos;s your turn.
                    </p>
                    <div className="mt-4">
                      <JoinField cta="Join" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-display text-2xl font-extrabold">Thanks for voting! 🎉</p>
                    {nextMatchId && (
                      <Link href={`/match/${nextMatchId}`} className="btn mt-3 border-red bg-red text-white">
                        Next matchup →
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
            <ShareButtons
              link={props.shareLink}
              title={sheet === "voted" ? "Help them win: share this matchup" : "Share this matchup"}
            />
            <button className="mt-4 w-full text-sm font-semibold text-muted" onClick={() => setSheet(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
