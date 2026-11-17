import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

const PRIVATE = ["/admin", "/dashboard", "/api/", "/auth/", "/login"];

/** AI search and answer engines, named explicitly so it's clear they're welcome (GEO). */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

/** /robots.txt: public pages are crawlable; account, admin and API routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
