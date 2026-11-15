"use client";

import { createSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * Google One Tap ("Continue as …") sign-in without leaving the page.
 * Uses Google Identity Services to get an ID token, then signs in to Supabase with it.
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID and the same client ID allowed in Supabase's Google provider.
 */

type CredentialResponse = { credential: string };
type PromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason?: () => string;
};
type GoogleId = {
  initialize: (cfg: Record<string, unknown>) => void;
  prompt: (cb?: (n: PromptNotification) => void) => void;
  cancel: () => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Shows the One Tap prompt. Resolves true once signed in to Supabase,
 * false if the prompt couldn't be shown or was dismissed (caller then falls back to redirect sign-in).
 */
export async function oneTapSignIn(): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) return false;
  try {
    await loadScript();
  } catch {
    return false;
  }
  const g = window.google?.accounts?.id;
  if (!g) return false;

  // Nonce: Google gets the hash, Supabase gets the raw value and checks they match.
  const nonce = crypto.randomUUID();
  const hashedNonce = await sha256Hex(nonce);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    g.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashedNonce,
      auto_select: true, // returning users are signed in without another tap
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      context: "use",
      callback: async (resp: CredentialResponse) => {
        const supabase = createSupabaseBrowser();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: resp.credential,
          nonce,
        });
        done(!error);
      },
    });
    g.prompt((n) => {
      // "credential_returned" also counts as dismissed: that's success, the callback handles it.
      const credentialReturned = n.isDismissedMoment() && n.getDismissedReason?.() === "credential_returned";
      if (!credentialReturned && (n.isNotDisplayed() || n.isSkippedMoment() || n.isDismissedMoment())) {
        done(false);
      }
    });
    // Safety net: if nothing happens, let the caller fall back.
    setTimeout(() => done(false), 60_000);
  });
}
