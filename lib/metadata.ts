import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { safeHttpUrl } from "@/lib/url";

export type SiteMetadata = {
  name: string;
  description: string;
  logoUrl: string | null;
};

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") ||
    v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")
  );
}

/** Rejects anything that resolves to a private / loopback address. */
async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("bad port");
  const addrs = await lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("private address");
  }
}

async function readCapped(res: Response, maxBytes = MAX_BYTES): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

export async function fetchHtml(
  startUrl: string,
  maxBytes = MAX_BYTES,
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = new URL(startUrl);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublicHost(current);
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "BacklinkArenaBot/1.0 (+https://backlinkarena.com)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current);
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("html")) return { html: "", finalUrl: current.toString() };
      return { html: await readCapped(res, maxBytes), finalUrl: current.toString() };
    }
    throw new Error("too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a remote logo as a data URL for OG image rendering (PNG/JPEG/GIF/SVG only).
 * Same SSRF guard as the metadata fetch; returns null on any problem.
 */
export async function fetchImageDataUrl(src: string | null, timeoutMs = 2500): Promise<string | null> {
  const url = safeHttpUrl(src);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = new URL(url);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublicHost(current);
      const res = await fetch(current, { redirect: "manual", signal: controller.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current);
        continue;
      }
      if (!res.ok || !res.body) return null;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(type)) return null;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 2_000_000) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      return `data:${type};base64,${Buffer.concat(chunks).toString("base64")}`;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a site allows being shown in an iframe on our domain.
 * Checks X-Frame-Options and CSP frame-ancestors on the homepage response.
 */
export async function checkEmbeddable(src: string | null, timeoutMs = 3500): Promise<boolean> {
  const url = safeHttpUrl(src);
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = new URL(url);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublicHost(current);
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "BacklinkArenaBot/1.0 (+https://backlinkarena.com)" },
      });
      await res.body?.cancel();
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current);
        // Only https can be embedded on an https page.
        if (current.protocol !== "https:") return false;
        continue;
      }
      if (!res.ok) return false;
      const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
      if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
      const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
      const fa = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-ancestors"));
      if (fa) {
        const sources = fa.split(/\s+/).slice(1);
        if (!sources.includes("*") && !sources.some((s) => s.includes("backlinkarena.com"))) return false;
      }
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

function meta(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const tag of tags) {
      const k = attr(tag, "property") ?? attr(tag, "name");
      if (k?.toLowerCase() === key) {
        const c = attr(tag, "content");
        if (c) return decodeEntities(c);
      }
    }
  }
  return null;
}

function icon(html: string): string | null {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  let best: { href: string; score: number } | null = null;
  for (const tag of links) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !rel.includes("icon")) continue;
    const score = rel.includes("apple-touch") ? 3 : (attr(tag, "sizes") ?? "").includes("192") ? 2 : 1;
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href ?? null;
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Best-effort homepage metadata. Never throws: returns fallbacks on failure. */
export async function fetchSiteMetadata(url: string, domain: string): Promise<SiteMetadata> {
  const fallbackLogo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  const fallbackName = domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const name =
      meta(html, ["og:site_name"]) ??
      meta(html, ["og:title"]) ??
      (title ? decodeEntities(title) : null) ??
      fallbackName;
    const description =
      meta(html, ["og:description", "description", "twitter:description"]) ?? "";
    const iconHref = icon(html);
    const ogImage = meta(html, ["og:image", "og:image:url", "twitter:image"]);
    // Prefer the site icon (square) as a logo; fall back to og:image, then favicon service.
    const candidate = iconHref ?? ogImage;
    const logoUrl = candidate ? safeHttpUrl(new URL(candidate, finalUrl).toString()) : null;
    return {
      name: clip(name.split(/\s[|–—-]\s/)[0] || name, 80),
      description: clip(description, 300),
      logoUrl: logoUrl ?? fallbackLogo,
    };
  } catch {
    return { name: fallbackName, description: "", logoUrl: fallbackLogo };
  }
}
