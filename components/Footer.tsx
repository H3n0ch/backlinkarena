import Link from "next/link";
import { CookieSettingsLink } from "@/components/Analytics";
import { CONTACT_EMAIL, SUPABASE_CONFIGURED } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-16 bg-[linear-gradient(180deg,transparent,#fff7ed_60%,#ffe4e6)]">
      <div aria-hidden="true" className="line-gradient opacity-60" />
      {!SUPABASE_CONFIGURED && (
        <p className="bg-red px-4 py-2 text-center text-sm font-bold text-white">
          Supabase is not configured: copy .env.local.example to .env.local, fill in the keys and
          restart the dev server.
        </p>
      )}
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Backlink Arena · Strong backlinks for everyone.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-ink">
          <Link href="/services">Services</Link>
          <Link href="/winners">Winners</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/privacy">Privacy</Link>
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>}
          <CookieSettingsLink />
        </nav>
      </div>
    </footer>
  );
}
