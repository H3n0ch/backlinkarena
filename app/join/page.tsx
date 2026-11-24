import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Join with your website",
  description: "Enter your website and play for a DA 50+ backlink in your niche.",
};

const INTRO = {
  free: {
    title: "Enter the arena",
    text: "Add your website, then pick how you get your seat: our badge and two posts (free), or $29.",
  },
  badge: {
    title: "Get your free seat",
    text: "Add your website first. Then put our badge on your site, share two posts, and your seat is secured.",
  },
  pass: {
    title: "Get your guaranteed spot",
    text: "Add your website first. Then pay $29 once and your seat in one tournament is secured.",
  },
} as const;

export default function JoinPage({ searchParams }: PageProps<"/join">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Suspense fallback={<div className="card mt-6 h-40" />}>
        <Join searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Join({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const plan = params.plan === "badge" || params.plan === "pass" ? params.plan : null;

  // Logged-in owners who already have a site skip the form and go to their next step.
  if (plan && !params.resume) {
    const user = await getUser();
    if (user) {
      const supabase = await createSupabaseServer();
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (count) redirect(`/dashboard?plan=${plan}`);
    }
  }

  const intro = INTRO[plan ?? "free"];
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold leading-tight">{intro.title}</h1>
      <p className="mt-2 text-muted">{intro.text}</p>
      <JoinFlow />
    </>
  );
}
