"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLeadStatus } from "@/app/actions/lead";

const STATUSES = ["new", "contacted", "won", "lost"] as const;
type Status = (typeof STATUSES)[number];

export function LeadStatus({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      className="field py-1! text-xs"
      value={status}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setLeadStatus(id, e.target.value as Status);
          router.refresh();
        })
      }
    >
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
