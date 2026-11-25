import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta } from "@/components/content/Prose";
import { COMPARISONS } from "@/content/compare";

export const metadata: Metadata = {
  title: "Backlink Arena vs Other Launch Platforms",
  description:
    "How Backlink Arena's free 1v1 tournaments compare to Product Hunt, BetaList and other places to launch a startup, and when to use each.",
  alternates: { canonical: "/compare" },
};

export default function CompareIndex() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">Compare</p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">
        Backlink Arena <span className="text-gradient">vs</span> the rest
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Honest comparisons with other places founders launch. Most of them work well together with a tournament.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <Link href={`/compare/${c.slug}`} className="card block h-full p-5 transition hover:-translate-y-0.5 sm:p-6">
              <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">{c.competitor} alternative</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">{c.title}</h2>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <ContentCta />
    </div>
  );
}
