import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { isGoogleLoginEnabled } from "@/lib/auth-settings";
import { safeNext } from "@/lib/url";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <Suspense fallback={<h1 className="font-display text-3xl font-extrabold">Step into the arena</h1>}>
          <Intro searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<div className="h-48" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

/** Heading that says why we're asking, based on where the visitor is headed. */
async function Intro({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = String((await searchParams).next ?? "");
  const text = next.includes("plan=pass")
    ? "Last step before payment: log in so your $79 guaranteed spot is linked to your website."
    : next.includes("plan=badge")
      ? "Last step: log in so we can link your badge to your website."
      : next.startsWith("/join")
        ? "Last step: log in to save your website. Voting needs no account."
        : "Log in to enter your website. Voting needs no account.";
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Step into the arena</h1>
      <p className="mt-1 text-muted">{text}</p>
    </>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Already logged in (other tab, link clicked twice…): skip the form and continue where they were going.
  if (await getUser()) {
    const next = (await searchParams).next;
    redirect(safeNext(typeof next === "string" ? next : null));
  }
  return <LoginForm googleEnabled={await isGoogleLoginEnabled()} />;
}
