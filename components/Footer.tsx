import Link from "next/link";
import { CookieSettingsLink } from "@/components/Analytics";
import { LeadButton } from "@/components/LeadButton";
import { SUPABASE_CONFIGURED } from "@/lib/env";

// Launch badges shown in the footer. To remove one, delete its line (or comment it out).
const LAUNCH_BADGES = [
  {
    href: "https://followx.today/b/backlinkarena.com",
    src: "https://followx.today/api/badge/backlinkarena.com.svg?theme=dark",
    alt: "Featured on FollowX.today",
    width: 250,
    height: 54,
  },
];

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
          <Link href="/founders">Our story</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/privacy">Privacy</Link>
          <LeadButton contact label="Contact" className="cursor-pointer font-semibold hover:underline" />
          <CookieSettingsLink />
        </nav>
      </div>
      {LAUNCH_BADGES.length > 0 && (
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 pb-6">
          {LAUNCH_BADGES.map((b) => (
            <a key={b.href} href={b.href} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.alt} width={b.width} height={b.height} loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </footer>
  );
}
