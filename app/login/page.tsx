import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleLoginEnabled } from "@/lib/auth-settings";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <h1 className="font-display text-3xl font-extrabold">Step into the arena</h1>
        <p className="mt-1 text-muted">Log in to vote and to enter your website.</p>
        <Suspense fallback={<div className="h-48" />}>
          <Form />
        </Suspense>
      </div>
    </div>
  );
}

async function Form() {
  return <LoginForm googleEnabled={await isGoogleLoginEnabled()} />;
}
