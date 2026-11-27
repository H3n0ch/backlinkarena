"use client";

import { useActionState, useState } from "react";
import { startSponsorCheckout, type SponsorFormState } from "@/app/actions/sponsor";
import { SPONSOR_LIMITS, SPONSOR_PRICE } from "@/lib/sponsor-offer";

const initial: SponsorFormState = { error: null };

export function SponsorForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(startSponsorCheckout, initial);
  const [tagline, setTagline] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Brand name
        <input name="brandName" required maxLength={SPONSOR_LIMITS.brandName} className="field" placeholder="Acme" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Website or landing page
        <input
          name="website"
          required
          maxLength={SPONSOR_LIMITS.website}
          className="field"
          placeholder="acme.com/founders"
          inputMode="url"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        One-line pitch to founders
        <input
          name="tagline"
          required
          maxLength={SPONSOR_LIMITS.tagline}
          className="field"
          placeholder="Analytics for indie SaaS. 50% off for arena founders."
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
        <span className="text-xs font-normal text-muted">
          {tagline.length}/{SPONSOR_LIMITS.tagline}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Logo URL <span className="font-normal text-muted">(optional: leave empty and we use your site&apos;s icon)</span>
        <input name="logoUrl" maxLength={SPONSOR_LIMITS.logoUrl} className="field" placeholder="https://acme.com/logo.png" inputMode="url" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your email
        <input name="email" type="email" required maxLength={200} className="field" placeholder="you@acme.com" />
      </label>
      {/* Honeypot */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {state.error && <p className="rounded-xl bg-red-soft p-3 text-sm font-semibold">{state.error}</p>}

      {enabled ? (
        <button type="submit" disabled={pending} className="btn border-red bg-red text-white">
          {pending ? "Opening checkout…" : `Pay ${SPONSOR_PRICE} and sponsor →`}
        </button>
      ) : (
        <p className="text-center text-sm font-semibold text-muted">Checkout coming soon</p>
      )}
      <p className="text-center text-xs text-muted">
        We review every sponsor before it goes live. Not approved? Full refund.
      </p>
    </form>
  );
}
