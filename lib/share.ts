import { SITE_URL } from "@/lib/env";

/** Readable matchup path: /vs/brand-a-vs-brand-b (falls back to /match/<id> if a side is missing). */
export function matchPath(m: { id: string }, aSlug?: string | null, bSlug?: string | null) {
  return aSlug && bSlug ? `/vs/${aSlug}-vs-${bSlug}` : `/match/${m.id}`;
}

/** Full share URL, with ?ref= for the participant who shares it. */
export function matchShareUrl(path: string, refSlug?: string | null) {
  const u = `${SITE_URL}${path}`;
  return refSlug ? `${u}?ref=${encodeURIComponent(refSlug)}` : u;
}

export function defaultPostText(link: string) {
  return `I'm in a 1v1 battle on Backlink Arena. One click helps me win: ${link} #contest`;
}

export function shareLinks(link: string) {
  const text = defaultPostText(link);
  // X adds the url itself, so keep it out of the text to avoid a duplicate.
  const xText = text.replace(` ${link}`, "");
  return {
    x: `https://x.com/intent/post?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(link)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    text,
  };
}
