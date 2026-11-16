import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "Admin password", robots: { index: false } };

export default function UnlockPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Suspense fallback={<div className="card h-48" />}>
        <Unlock />
      </Suspense>
    </div>
  );
}

async function Unlock() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin/unlock");
  if (!user.isAdminAccount) notFound();
  if (user.isAdmin) redirect("/admin");
  return (
    <div className="card p-6">
      <h1 className="font-display text-3xl font-extrabold">Admin password</h1>
      <p className="mt-2 text-sm text-muted">Enter the admin password to open the admin panel.</p>
      <div className="mt-5">
        <UnlockForm />
      </div>
    </div>
  );
}
