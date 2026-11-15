"use client";

import { useState, useTransition } from "react";
import { joinWaitlist } from "@/app/actions/product";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await joinWaitlist({ email, website });
          setMsg(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
        });
      }}
    >
      <input
        className="field"
        type="email"
        placeholder="you@company.com"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="field"
        placeholder="yourproduct.com (optional)"
        aria-label="Website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <button className="btn bg-card" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </button>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-mint" : "text-red"}`}>{msg.text}</p>}
    </form>
  );
}
