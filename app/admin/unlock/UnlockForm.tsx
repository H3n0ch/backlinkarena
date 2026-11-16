"use client";

import { useState, useTransition } from "react";
import { unlockAdmin } from "@/app/actions/admin-auth";

export function UnlockForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          // On success the action redirects to /admin.
          const r = await unlockAdmin(password);
          if (r && !r.ok) {
            setError(r.error);
            setPassword("");
          }
        });
      }}
    >
      <input
        type="password"
        className="field"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button className="btn bg-red text-white" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </button>
      {error && <p className="text-sm font-semibold text-red">{error}</p>}
    </form>
  );
}
