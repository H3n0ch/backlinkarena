import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { GOLD_TEXT, PREMIUM_FRAME } from "@/components/premium";
import { ProductLogo } from "@/components/ProductLogo";
import { getActiveTournament, getProductsByIds, PRODUCT_PUBLIC_COLUMNS } from "@/lib/data";
import { createSupabasePublic } from "@/lib/supabase/server";
import type { Match, Product, Tournament } from "@/lib/types";
import { slugify } from "@/lib/url";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page didn't show up for its match.",
};

/*
  Smart 404. The proxy forwards the requested path as "x-pathname", and the page reacts to it:
  - /p/<slug>          → that site isn't in the arena: similar sites + "enter it free"
  - /match/…, /vs/…    → that match doesn't exist: live matches instead
  - /admin, /dashboard → generic (never hint at what exists behind a login)
  - anything else      → "did you mean" (route typos, aliases, or a domain typed as a path)
  Every DB read is best-effort: a 404 page must never crash.
*/

export default function NotFound() {
  return (
    <section className="relative isolate mx-auto max-w-3xl px-4 pt-10 pb-16 text-center sm:pt-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-80 max-w-2xl rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.28),rgb(225_29_72/0.12)_55%,transparent)] blur-2xl"
      />
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-red/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-dark shadow-sm backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad-brand)]" /> Error 404 · Walkover
      </span>

      <Suspense fallback={<Fallback />}>
        <Smart />
      </Suspense>

      <nav aria-label="Popular pages" className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card group p-4 transition hover:-translate-y-0.5 hover:border-red/40"
          >
            <span className="font-display text-lg font-extrabold group-hover:text-red-dark">{l.label} →</span>
            <span className="mt-1 block text-xs leading-snug text-muted">{l.hint}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

const QUICK_LINKS = [
  { href: "/arena", label: "Arena", hint: "Live matches, vote now" },
  { href: "/join", label: "Enter", hint: "Add your site, free" },
  { href: "/winners", label: "Winners", hint: "Past champions" },
  { href: "/", label: "Home", hint: "How it all works" },
];

/* ------------------------------------------------------------------ scoreboard */

function Scoreboard({ path }: { path: string | null }) {
  const shown = path && path.length > 26 ? `${path.slice(0, 25)}…` : path;
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-[1.25rem] p-5 sm:p-6" style={PREMIUM_FRAME}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-orange-300/80">Side A</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-white">You</p>
          <p className="text-xs text-white/50">showed up ✓</p>
        </div>
        <p className="headline text-6xl sm:text-7xl" style={GOLD_TEXT} aria-label="404">
          4<span className="mx-1 align-middle text-4xl opacity-60">:</span>04
        </p>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-teal-300/80">Side B</p>
          <p className="mt-1 truncate font-display text-2xl font-extrabold text-white" title={path ?? undefined}>
            {shown ?? "This page"}
          </p>
          <p className="text-xs text-white/50">no-show ✗</p>
        </div>
      </div>
      <div aria-hidden="true" className="line-gradient mt-5 opacity-70" />
    </div>
  );
}

function Fallback() {
  return (
    <>
      <Scoreboard path={null} />
      <Heading title="This page didn't show up." text="It never entered the arena, or it was knocked out and removed." />
    </>
  );
}

function Heading({ title, text }: { title: ReactNode; text: ReactNode }) {
  return (
    <>
      <h1 className="headline mt-8 text-4xl sm:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">{text}</p>
    </>
  );
}

/* ------------------------------------------------------------------ smart part */

async function Smart() {
  const raw = (await headers()).get("x-pathname") ?? "";
  const path = safeDecode(raw).replace(/\/+$/, "") || "/";
  const segs = path.split("/").filter(Boolean);
  const first = (segs[0] ?? "").toLowerCase();

  // Behind a login: stay generic.
  if (first === "admin" || first === "dashboard") {
    return (
      <>
        <Scoreboard path={null} />
        <Heading title="Nothing here." text="This page doesn't exist, or you don't have access to it." />
      </>
    );
  }

  // A site page that doesn't exist.
  if (first === "p" && segs[1]) {
    const slug = slugify(segs[1]);
    const guess = domainFromSlug(slug);
    const similar = await similarProducts(slug);
    return (
      <>
        <Scoreboard path={path} />
        <Heading
          title={
            <>
              <span className="text-gradient">{guess}</span> isn&apos;t in the arena.
            </>
          }
          text="No site with that address has entered yet. If it's yours, you can change that in a minute."
        />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/join?url=${encodeURIComponent(guess)}`} className="btn border-red bg-red text-white">
            Enter {guess} free
          </Link>
          <Link href="/arena" className="btn bg-card">
            Browse the arena
          </Link>
        </div>
        {similar.length > 0 && (
          <Panel title="Were you looking for">
            <ul className="flex flex-col gap-2">
              {similar.map((p) => (
                <li key={p.id}>
                  <SiteRow product={p} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </>
    );
  }

  // A match that doesn't exist.
  if ((first === "match" || first === "vs") && segs[1]) {
    const live = await liveMatches();
    return (
      <>
        <Scoreboard path={path} />
        <Heading
          title="This match never happened."
          text="The link may be old, or the matchup changed when the bracket was drawn."
        />
        <Arena live={live} />
      </>
    );
  }

  // Anything else: try to guess what they meant.
  const [route, product, live] = await Promise.all([
    Promise.resolve(guessRoute(first)),
    segs.length === 1 ? productBySlug(slugify(first)) : Promise.resolve(null),
    liveMatches(),
  ]);

  return (
    <>
      <Scoreboard path={path} />
      <Heading
        title="This page didn't show up."
        text="It never entered the arena, or it was knocked out and removed."
      />
      {product ? (
        <Panel title="Did you mean">
          <SiteRow product={product} />
        </Panel>
      ) : route ? (
        <div className="mt-6">
          <Link href={route.href} className="btn border-red bg-red text-white">
            Did you mean {route.label}? →
          </Link>
        </div>
      ) : null}
      <Arena live={live} />
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-xl text-left">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  );
}

function SiteRow({ product }: { product: Product }) {
  return (
    <Link href={`/p/${product.slug}`} className="card flex items-center gap-3 p-3 transition hover:border-red/40">
      <ProductLogo src={product.logo_url} name={product.name} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{product.name}</span>
        <span className="block truncate text-sm text-muted">{product.domain}</span>
      </span>
      <span className="text-red-dark">→</span>
    </Link>
  );
}

type LiveMatch = { id: string; a: Product | null; b: Product | null };
type Live = { tournament: Tournament | null; matches: LiveMatch[] };

function Arena({ live }: { live: Live }) {
  const { tournament, matches } = live;
  if (matches.length > 0) {
    return (
      <Panel title="Live right now">
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <li key={m.id}>
              <Link
                href={`/match/${m.id}`}
                className="card flex items-center gap-3 p-3 transition hover:border-red/40"
              >
                <Side product={m.a} />
                <span className="headline shrink-0 text-sm text-muted">vs</span>
                <Side product={m.b} right />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-sm text-muted">
          Your vote decides who wins a DA 50+ backlink.{" "}
          <Link href="/arena" className="font-semibold text-red-dark underline">
            See all matches
          </Link>
        </p>
      </Panel>
    );
  }
  if (tournament && (tournament.status === "draft" || tournament.status === "qualifying")) {
    return (
      <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-line bg-mint-soft p-3 text-sm font-semibold">
        {tournament.name} is open for entries.{" "}
        <Link href="/join" className="underline">
          Enter your site free →
        </Link>
      </p>
    );
  }
  return null;
}

function Side({ product, right = false }: { product: Product | null; right?: boolean }) {
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <ProductLogo src={product?.logo_url ?? null} name={product?.name ?? "?"} size={32} />
      <span className="truncate text-sm font-bold">{product?.name ?? "TBD"}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ data (best-effort) */

async function liveMatches(): Promise<Live> {
  try {
    const tournament = await getActiveTournament();
    if (!tournament || tournament.status !== "bracket") return { tournament, matches: [] };
    const { data } = await createSupabasePublic()
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .eq("status", "open")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at")
      .limit(3);
    const ms = (data ?? []) as Match[];
    const products = await getProductsByIds(ms.flatMap((m) => [m.product_a, m.product_b]));
    return {
      tournament,
      matches: ms.map((m) => ({
        id: m.id,
        a: m.product_a ? products.get(m.product_a) ?? null : null,
        b: m.product_b ? products.get(m.product_b) ?? null : null,
      })),
    };
  } catch {
    return { tournament: null, matches: [] };
  }
}

async function productBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;
  try {
    const { data } = await createSupabasePublic()
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    return (data as Product) ?? null;
  } catch {
    return null;
  }
}

/** Sites whose slug or name shares the main word of the missing slug ("acme-io" → "acme"). */
async function similarProducts(slug: string): Promise<Product[]> {
  const core = slug.split("-").sort((x, y) => y.length - x.length)[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  if (core.length < 3) return [];
  try {
    const { data } = await createSupabasePublic()
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .or(`slug.ilike.%${core}%,name.ilike.%${core}%`)
      .limit(3);
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ guessing */

const ROUTES: Record<string, { href: string; label: string }> = {
  arena: { href: "/arena", label: "the Arena" },
  winners: { href: "/winners", label: "Winners" },
  join: { href: "/join", label: "Enter your site" },
  rules: { href: "/rules", label: "the Rules" },
  privacy: { href: "/privacy", label: "Privacy" },
  login: { href: "/login", label: "Log in" },
  pricing: { href: "/#pricing", label: "Pricing" },
  services: { href: "/#services", label: "Services" },
  faq: { href: "/#faq", label: "the FAQ" },
};

/** Common words people type for a page that lives elsewhere. */
const ALIASES: Record<string, string> = {
  enter: "join",
  signup: "join",
  register: "join",
  submit: "join",
  apply: "join",
  vote: "arena",
  votes: "arena",
  matches: "arena",
  bracket: "arena",
  tournament: "arena",
  leaderboard: "arena",
  champions: "winners",
  winner: "winners",
  "hall-of-fame": "winners",
  terms: "rules",
  tos: "rules",
  signin: "login",
  "sign-in": "login",
  account: "login",
  price: "pricing",
  prices: "pricing",
  pass: "pricing",
  help: "faq",
  about: "faq",
};

function guessRoute(word: string): { href: string; label: string } | null {
  if (!word) return null;
  const w = word.replace(/\.(html?|php|aspx?)$/, "");
  if (ROUTES[w]) return ROUTES[w];
  if (ALIASES[w]) return ROUTES[ALIASES[w]];
  let best: string | null = null;
  let bestD = Infinity;
  for (const key of [...Object.keys(ROUTES), ...Object.keys(ALIASES)]) {
    const d = distance(w, key);
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  if (!best || bestD > Math.max(1, Math.floor(best.length / 3))) return null;
  return ROUTES[best] ?? ROUTES[ALIASES[best]];
}

/** Levenshtein distance (short strings only). */
function distance(a: string, b: string): number {
  if (a.length > 40) return Infinity;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** "acme-io" → "acme.io" (slugs are domains with dots turned into dashes). */
function domainFromSlug(slug: string): string {
  const i = slug.lastIndexOf("-");
  return i > 0 ? `${slug.slice(0, i)}.${slug.slice(i + 1)}` : slug;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
