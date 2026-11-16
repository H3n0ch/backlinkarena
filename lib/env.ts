export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Public address used in badge codes (server only). Lets you test badges against the live
 * site while developing on localhost. Order: PUBLIC_SITE_URL, Netlify's own URL, SITE_URL.
 */
export const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || process.env.URL || SITE_URL).replace(/\/$/, "");

// Supabase's new "publishable" key replaces the legacy "anon" key; accept either.
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** False until the Supabase URL and publishable key are set (see .env.local.example). */
export const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && PUBLIC_KEY);

// Unreachable placeholder so the app still renders (empty, logged out) before Supabase is set up.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:1";
export const SUPABASE_ANON_KEY = PUBLIC_KEY || "not-configured";
/** Where "Request a quote" buttons send email. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
