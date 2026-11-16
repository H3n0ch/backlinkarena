"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer text-sm font-semibold underline hover:text-red disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={signOut}>
      <Submit />
    </form>
  );
}
