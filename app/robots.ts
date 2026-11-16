import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

/** /robots.txt: public pages are crawlable; account, admin and API routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/api/", "/auth/", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
