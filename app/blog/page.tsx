import type { Metadata } from "next";
import Link from "next/link";
import { ContentCta, formatDate } from "@/components/content/Prose";
import { POSTS } from "@/content/blog";
import { COMPARISONS } from "@/content/compare";

export const metadata: Metadata = {
  title: "Blog: Backlinks and Launch Advice for Founders",
  description:
    "Practical guides for founders: how to get your first backlinks, which launch directories are worth it, and how to judge a link before you pay for it.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-gradient w-fit text-xs font-bold uppercase tracking-widest">Blog</p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">
        Backlinks for <span className="text-gradient">founders</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        How to get found when nobody knows you yet: links, launches and what&apos;s worth your time.
      </p>

      <ul className="mt-10 flex flex-col gap-4">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="card block p-5 transition hover:-translate-y-0.5 sm:p-6">
              <p className="text-sm text-muted">
                <time dateTime={p.published}>{formatDate(p.published)}</time> · {p.readMinutes} min read
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">{p.title}</h2>
              <p className="mt-2 text-muted">{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="headline mt-16 text-3xl">Compare</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/compare/${c.slug}`}
              className="inline-block rounded-full border border-line bg-white/70 px-4 py-1.5 text-sm font-semibold hover:bg-cream"
            >
              {c.title}
            </Link>
          </li>
        ))}
      </ul>

      <ContentCta />
    </div>
  );
}
