"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterTournament } from "@/app/actions/join";

export function EnterButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn bg-red text-white"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await enterTournament(productId);
            if (r.ok) router.refresh();
            else setErr(r.error);
          })
        }
      >
        {pending ? "Entering…" : "Enter this tournament"}
      </button>
      {err && <p className="mt-2 text-sm font-semibold text-red">{err}</p>}
    </div>
  );
}
