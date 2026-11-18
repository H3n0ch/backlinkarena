import "server-only";
import { arenaHosts, findBacklink, type BacklinkCheck } from "@/lib/badge";
import { PUBLIC_SITE_URL, SITE_URL } from "@/lib/env";
import { fetchHtml } from "@/lib/metadata";

/** Fetches a page and looks for a link to Backlink Arena. Unreachable page = not found. */
export async function checkPageForBadge(page: string): Promise<BacklinkCheck & { reachable: boolean }> {
  try {
    const { html, finalUrl } = await fetchHtml(page, 3_000_000);
    if (!html) return { found: false, dofollow: false, reachable: false };
    const hosts = [...new Set([...arenaHosts(SITE_URL), ...arenaHosts(PUBLIC_SITE_URL)])];
    return { ...findBacklink(html, finalUrl, hosts), reachable: true };
  } catch {
    return { found: false, dofollow: false, reachable: false };
  }
}
