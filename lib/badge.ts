/** Hostnames that count as "a link to Backlink Arena". */
export function arenaHosts(siteUrl: string): string[] {
  const hosts = new Set(["backlinkarena.com", "www.backlinkarena.com"]);
  try {
    hosts.add(new URL(siteUrl).hostname.toLowerCase());
  } catch {}
  return [...hosts];
}

export type BacklinkCheck = { found: boolean; dofollow: boolean; href?: string };

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/**
 * Looks through a page's HTML for an <a href> pointing to one of `hosts`.
 * A link counts as dofollow unless rel contains nofollow, sponsored or ugc.
 * Prefers a dofollow link if there are several.
 */
export function findBacklink(html: string, pageUrl: string, hosts: string[]): BacklinkCheck {
  const tags = html.match(/<a\b[^>]*>/gi) ?? [];
  let nofollowHit: BacklinkCheck | null = null;
  for (const tag of tags) {
    const href = attr(tag, "href");
    if (!href) continue;
    let host: string;
    try {
      host = new URL(href, pageUrl).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!hosts.includes(host)) continue;
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const dofollow = !/\b(nofollow|sponsored|ugc)\b/.test(rel);
    if (dofollow) return { found: true, dofollow: true, href };
    nofollowHit ??= { found: true, dofollow: false, href };
  }
  return nofollowHit ?? { found: false, dofollow: false };
}

/** Copy-paste formats for the badge. */
export function badgeFormats(siteUrl: string, slug: string, theme: "light" | "dark") {
  const page = `${siteUrl}/p/${slug}`;
  const img = `${siteUrl}/badge/${theme === "dark" ? "featured-dark.svg" : "featured.svg"}`;
  return {
    html: `<a href="${page}" target="_blank">\n  <img src="${img}" alt="Featured on Backlink Arena" width="200" height="54">\n</a>`,
    text: `<a href="${page}" target="_blank">Featured on Backlink Arena</a>`,
    markdown: `[![Featured on Backlink Arena](${img})](${page})`,
    page,
    img,
  };
}
