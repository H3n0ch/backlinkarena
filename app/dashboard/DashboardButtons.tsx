"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterTournament } from "@/app/actions/join";

/** `quiet` is the free-voting fallback: shown under Badge / $29, so it mustn't compete with them. */
export function EnterButton({ productId, quiet = false }: { productId: string; quiet?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        className={quiet ? "btn bg-card text-sm" : "btn bg-red text-white"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await enterTournament(productId);
            if (r.ok) router.refresh();
            else setErr(r.error);
          })
        }
      >
        {pending ? "Entering…" : quiet ? "Enter free" : "Enter this tournament"}
      </button>
      {err && <p className="mt-2 text-sm font-semibold text-red">{err}</p>}
    </div>
  );
}
