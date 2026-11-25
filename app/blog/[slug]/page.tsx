import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCta, FaqList, formatDate, Prose } from "@/components/content/Prose";
import { getPost, POSTS } from "@/content/blog";
import { articleSchema, breadcrumbSchema, faqSchema, JsonLd } from "@/lib/json-ld";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: { absolute: `${post.seoTitle ?? post.title} | Backlink Arena` },
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
    },
  };
}

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const path = `/blog/${post.slug}`;
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <JsonLd data={articleSchema({ path, ...post })} />
      <JsonLd data={breadcrumbSchema([["Blog", "/blog"], [post.title, path]])} />
      {post.faq && <JsonLd data={faqSchema(post.faq)} />}

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/blog" className="font-semibold hover:text-ink">
          ← Blog
        </Link>
      </nav>
      <h1 className="headline mt-4 text-4xl sm:text-5xl">{post.title}</h1>
      <p className="mt-4 text-sm text-muted">
        <time dateTime={post.published}>{formatDate(post.published)}</time>
        {post.updated && (
          <>
            {" "}
            · Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time>
          </>
        )}{" "}
        · {post.readMinutes} min read
      </p>

      <div className="mt-8">
        <Prose>{post.body()}</Prose>
      </div>

      {post.faq && (
        <section className="mt-14">
          <h2 className="headline text-3xl">Questions</h2>
          <FaqList items={post.faq} />
        </section>
      )}

      <ContentCta />

      {others.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-extrabold">Keep reading</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="card block h-full p-5 transition hover:-translate-y-0.5">
                  <p className="font-display text-lg font-extrabold">{p.title}</p>
                  <p className="mt-2 text-sm text-muted">{p.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
