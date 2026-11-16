"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

/*
  Google Analytics 4, loaded ONLY after the visitor accepts (GDPR / TTDSG §25).
  - NEXT_PUBLIC_GA_ID (e.g. G-XXXXXXX): without it nothing renders, no banner, no script.
  - The choice is stored in localStorage; "Cookie settings" in the footer reopens the banner.
  - Page views on client-side navigation are tracked by GA4's enhanced measurement
    ("page changes based on browser history events", on by default).
*/

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
const KEY = "ba-analytics-consent";
export const OPEN_COOKIE_SETTINGS = "ba:cookie-settings";

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function Analytics() {
  // undefined = not read yet (server render / first paint): show nothing to avoid a flash.
  const [consent, setConsent] = useState<Consent | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = readConsent();
    const t = setTimeout(() => {
      setConsent(c);
      setOpen(c === null);
    }, 0);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => {
      clearTimeout(t);
      window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
    };
  }, []);

  function choose(c: "granted" | "denied") {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // private mode: the choice holds for this visit only
    }
    // Withdrawing consent after GA already loaded: a reload drops the script.
    if (c === "denied" && consent === "granted") window.location.reload();
    setConsent(c);
    setOpen(false);
  }

  if (!GA_ID) return null;

  return (
    <>
      {consent === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}

      {open && consent !== undefined && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie settings"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl bg-stone-950/95 p-4 text-white shadow-2xl ring-1 ring-amber-300/30 backdrop-blur sm:inset-x-6 sm:bottom-6 sm:flex sm:items-center sm:gap-4 sm:p-5"
        >
          <p className="text-sm leading-relaxed text-white/80">
            <span className="font-bold text-amber-200">Cookies? Only with your OK.</span> We&apos;d like to use Google
            Analytics to see which pages help brands most. Voting and logging in work either way.{" "}
            <Link href="/privacy" className="underline hover:text-white">
              Privacy policy
            </Link>
          </p>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <button
              type="button"
              onClick={() => choose("denied")}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => choose("granted")}
              className="rounded-full bg-linear-to-b from-amber-200 via-amber-400 to-amber-600 px-5 py-2 text-sm font-bold text-stone-950 transition hover:brightness-110"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that reopens the banner (consent must be as easy to withdraw as to give). */
export function CookieSettingsLink() {
  if (!GA_ID) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))} className="hover:underline">
      Cookie settings
    </button>
  );
}
