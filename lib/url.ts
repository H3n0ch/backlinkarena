/**
 * Normalize a user-entered website into its https homepage.
 * Drops paths, query strings (incl. tracking params), hashes, "www." and ports.
 */
export function normalizeUrl(input: string): { url: string; domain: string } | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  const tld = host.split(".").pop()!;
  if (!/^[a-z][a-z0-9-]+$/.test(tld)) return null; // rejects bare IPs too
  const domain = host.replace(/^www\./, "");
  return { url: `https://${domain}`, domain };
}

export function slugify(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Keep only safe ref values (product slugs). */
export function cleanRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const r = ref.trim().toLowerCase().slice(0, 64);
  return /^[a-z0-9-]+$/.test(r) ? r : null;
}

/** Only http(s) URLs may be rendered as links or images. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
