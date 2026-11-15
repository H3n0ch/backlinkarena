"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle",
  );

  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback() },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-mint-soft p-4">
        <p className="font-bold">Check your inbox ✉️</p>
        <p className="text-sm">We sent a login link to {email}. Open it on this device.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {googleEnabled && (
        <>
      <button type="button" onClick={google} className="btn w-full bg-card">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs font-semibold text-muted">
        <span className="h-0.5 flex-1 bg-ink/15" /> or <span className="h-0.5 flex-1 bg-ink/15" />
      </div>
        </>
      )}
      <form onSubmit={magic} className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-semibold">
          Email me a magic link
        </label>
        <input
          id="email"
          type="email"
          className="field"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <button className="btn bg-card" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {state === "error" && (
        <p className="text-sm font-semibold text-red">Login failed. Please try again.</p>
      )}
    </div>
  );
}
