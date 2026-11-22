"use client";

import { useState, useTransition } from "react";
import { checkBadge } from "@/app/actions/badge";
import { CopyButton } from "@/components/CopyButton";
import { badgeFormats } from "@/lib/badge";
import { shareLinks } from "@/lib/share";

type Theme = "light" | "dark";
type Format = "html" | "text" | "markdown" | "image";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "html", label: "Badge (HTML)", hint: "Best option. Paste into your site's footer or an HTML / Embed block." },
  { id: "text", label: "Text link", hint: "A simple text link, e.g. in your footer, partners or press page." },
  { id: "markdown", label: "Markdown", hint: "For GitHub READMEs, docs and Notion-style pages." },
  { id: "image", label: "Image file", hint: "Download the badge and link it to your Backlink Arena page yourself." },
];

const PLATFORMS: [string, string][] = [
  ["WordPress", "Add a “Custom HTML” block (or footer widget) and paste the HTML."],
  ["Webflow", "Drag in an “Embed” element and paste the HTML."],
  ["Framer", "Insert → Embed → HTML, then paste."],
  ["Shopify", "Online Store → Themes → Customize → footer → “Custom Liquid”."],
  ["Wix", "Add → Embed Code → Embed HTML."],
  ["Next.js / React", "Paste the HTML into your footer component (use className instead of class if needed)."],
];

/** A ready-made post: points to their own Backlink Arena page, so the post helps them too. */
function postText(name: string, page: string) {
  return `${name} is competing on Backlink Arena 🥊 1v1 product battles where visitors vote for the winner. Come and back us: ${page}`;
}

export function BadgeCard({
  siteUrl,
  slug,
  productId,
  domain,
  badgeStatus,
  name,
  posts = [],
  compact = false,
}: {
  siteUrl: string;
  slug: string;
  productId: string;
  domain: string;
  badgeStatus: "none" | "pending" | "verified";
  /** Product name, for the ready-made social post. */
  name: string;
  /** The two social post links saved with the last check. */
  posts?: string[];
  /** Inside the dashboard's "get your seat" choice: no box, no heading of its own. */
  compact?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [format, setFormat] = useState<Format>("html");
  const [page, setPage] = useState("");
  const [post1, setPost1] = useState(posts[0] ?? "");
  const [post2, setPost2] = useState(posts[1] ?? "");
  const [showRules, setShowRules] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const f = badgeFormats(siteUrl, slug, theme);
  const code = format === "html" ? f.html : format === "text" ? f.text : format === "markdown" ? f.markdown : f.page;
  const badgePath = `/badge/${theme === "dark" ? "featured-dark.svg" : "featured.svg"}`;
  const share = shareLinks(f.page, postText(name, f.page));

  return (
    <div className={compact ? "mt-4" : "mt-6 rounded-2xl border border-line bg-blue-soft/40 p-4 sm:p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className={`flex items-center gap-2 ${compact ? "text-sm font-semibold text-muted" : "font-display text-lg font-extrabold"}`}
          >
            {compact ? "Badge rules" : "Link to us, skip qualifying"}
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
              aria-label="Badge rules"
              title="Badge rules"
              className={`inline-flex size-5 items-center justify-center rounded-full border text-[11px] font-bold italic transition ${
                showRules ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink hover:text-ink"
              }`}
            >
              i
            </button>
          </p>
          <p className={compact ? "hidden" : "mt-1 text-sm"}>
            Put a link to Backlink Arena on your website and share two posts about us on your social accounts. As soon
            as we find the link, you go <strong>straight into the bracket</strong>, no qualifying votes needed.
          </p>
          {showRules && (
            <div className="mt-3 rounded-xl border border-line bg-white p-3 text-sm">
              <p className="font-bold">Badge rules</p>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
                <li>Put the badge on a page of your own site (or a subdomain), ideally the footer.</li>
                <li>Use a normal link: no nofollow, sponsored or ugc.</li>
                <li>Share two public posts about Backlink Arena on social accounts of your choice (X, LinkedIn, Facebook, Reddit…).</li>
                <li>Keep the badge and the posts live. We may check them again at any time.</li>
                <li>If it&apos;s removed, you can lose your guaranteed spot and go back to free qualifying.</li>
                <li>Your spot never adds votes inside a match.</li>
              </ul>
            </div>
          )}
        </div>
        {badgeStatus === "verified" && (
          <span className="rounded-full bg-mint-soft px-3 py-1 text-sm font-bold text-mint">✅ Verified</span>
        )}
        {badgeStatus === "pending" && (
          <span className="rounded-full bg-sun/40 px-3 py-1 text-sm font-bold">⏳ Manual check pending</span>
        )}
      </div>

      {/* Step 1: pick a format */}
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">1 · Pick a format</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FORMATS.map((x) => (
          <button
            key={x.id}
            onClick={() => setFormat(x.id)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${
              format === x.id ? "border-ink bg-ink text-white" : "border-line bg-white"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{FORMATS.find((x) => x.id === format)?.hint}</p>

      {format !== "text" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm font-semibold">
            {(["light", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-3 py-1 capitalize ${theme === t ? "bg-ink text-white" : "text-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={`rounded-lg p-3 ${theme === "dark" ? "bg-ink" : "bg-white"}`}>
            <img src={badgePath} alt="Featured on Backlink Arena" width={200} height={54} />
          </div>
        </div>
      )}

      {/* Step 2: copy */}
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">2 · Add it to your site</p>
      {format === "image" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={badgePath} download className="btn border-red bg-red text-sm text-white">
            Download badge (SVG)
          </a>
          <CopyButton text={f.page} label="Copy link to use" className="btn bg-white text-sm" />
          <span className="text-xs text-muted break-all">Link the image to: {f.page}</span>
        </div>
      ) : (
        <>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-white p-3 text-xs">{code}</pre>
          <div className="mt-2">
            <CopyButton text={code} label="Copy code" className="btn border-red bg-red text-sm text-white" />
          </div>
        </>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">Where do I paste it? (WordPress, Webflow, Shopify…)</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {PLATFORMS.map(([name, how]) => (
            <li key={name}>
              <strong>{name}:</strong> <span className="text-muted">{how}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Keep it a normal link: no <code>rel=&quot;nofollow&quot;</code>, <code>sponsored</code> or <code>ugc</code>.
        </p>
      </details>

      {/* Step 3: two social posts */}
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">3 · Share two posts about us</p>
      <p className="mt-2 text-sm text-muted">
        Post about Backlink Arena twice, on any social accounts you like (two platforms, or two posts on one). Use our
        text or write your own, then paste the links to both posts below so we can check them.
      </p>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-white p-3 text-xs">{share.text}</pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={share.text} label="Copy post" className="btn bg-white text-sm" />
        <a href={share.x} target="_blank" rel="noopener noreferrer" className="btn bg-white text-sm">
          Post on X ↗
        </a>
        <a href={share.linkedin} target="_blank" rel="noopener noreferrer" className="btn bg-white text-sm">
          Share on LinkedIn ↗
        </a>
      </div>
      {badgeStatus === "verified" && posts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {posts.map((x, i) => (
            <li key={x} className="truncate">
              <span className="font-semibold">Post {i + 1}:</span>{" "}
              <a href={x} target="_blank" rel="noopener noreferrer" className="underline">
                {x}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Step 4: verify */}
      {badgeStatus !== "verified" && (
        <>
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">4 · Check it</p>
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setResult(null);
              start(async () => {
                const r = await checkBadge(productId, page, [post1, post2]);
                setResult(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
              });
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field"
                inputMode="url"
                required
                placeholder="Link to social post 1"
                aria-label="Link to social post 1"
                value={post1}
                onChange={(e) => setPost1(e.target.value)}
              />
              <input
                className="field"
                inputMode="url"
                required
                placeholder="Link to social post 2"
                aria-label="Link to social post 2"
                value={post2}
                onChange={(e) => setPost2(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field"
                placeholder={`Page with the badge (optional, default: ${domain})`}
                value={page}
                onChange={(e) => setPage(e.target.value)}
              />
              <button className="btn shrink-0 border-ink bg-ink text-white" disabled={pending}>
                {pending ? "Checking your site…" : "Check my badge & posts"}
              </button>
            </div>
          </form>
          {result && (
            <p className={`mt-2 text-sm font-semibold ${result.ok ? "text-mint" : "text-red-dark"}`}>{result.text}</p>
          )}
        </>
      )}
    </div>
  );
}
