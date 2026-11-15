"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinField({ cta = "Join with your website" }: { cta?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/join?url=${encodeURIComponent(url.trim())}`);
      }}
    >
      <label htmlFor="join-url" className="sr-only">
        Your website
      </label>
      <input
        id="join-url"
        className="field"
        placeholder="yourproduct.com"
        inputMode="url"
        autoComplete="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <button className="btn shrink-0 border-red bg-red text-white" type="submit">
        {cta}
      </button>
    </form>
  );
}
