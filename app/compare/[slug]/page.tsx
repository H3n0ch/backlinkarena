import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadButton } from "@/components/LeadButton";
import { ContentCta, FaqList, formatDate, Prose } from "@/components/content/Prose";
import { COMPARISONS, getComparison } from "@/content/compare";
import { articleSchema, breadcrumbSchema, faqSchema, JsonLd } from "@/lib/json-ld";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const c = getComparison((await params).slug);
  if (!c) return {};
  return {
    title: { absolute: `${c.seoTitle ?? c.title} | Backlink Arena` },
    description: c.description,
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: { type: "article", title: c.title, description: c.description },
  };
}

export default async function ComparisonPage({ params }: PageProps<"/compare/[slug]">) {
  const c = getComparison((await params).slug);
  if (!c) notFound();
  const path = `/compare/${c.slug}`;
  const others = COMPARISONS.filter((o) => o.slug !== c.slug);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <JsonLd data={articleSchema({ path, title: c.title, description: c.description, published: c.checked })} />
      <JsonLd data={breadcrumbSchema([["Compare", "/compare"], [c.title, path]])} />
      {c.faq && <JsonLd data={faqSchema(c.faq)} />}

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/compare" className="font-semibold hover:text-ink">
          ← All comparisons
        </Link>
      </nav>
      <p className="text-gradient mt-6 w-fit text-xs font-bold uppercase tracking-widest">
        {c.competitor} alternative
      </p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">
        Backlink Arena <span className="text-gradient">vs</span> {c.competitor}
      </h1>
      <p className="mt-5 text-lg leading-relaxed">{c.verdict}</p>

      <div className="card mt-10 overflow-x-auto p-0">
        <table className="w-full min-w-lg text-left text-sm">
          <caption className="sr-only">
            Backlink Arena compared with {c.competitor}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="p-4 font-semibold text-muted">
                <span className="sr-only">Feature</span>
              </th>
              <th scope="col" className="p-4 font-display text-base font-extrabold">
                <span className="text-gradient">Backlink Arena</span>
              </th>
              <th scope="col" className="p-4 font-display text-base font-extrabold">
                {c.competitor}
              </th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <th scope="row" className="p-4 font-semibold">
                  {r.label}
                </th>
                <td className="p-4">{r.us}</td>
                <td className="p-4 text-muted">{r.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Facts about {c.competitor} checked on their own website on {formatDate(c.checked)}. Things change: if something
        here is out of date,{" "}
        <LeadButton contact label="tell us" className="cursor-pointer underline" /> and we&apos;ll fix it.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold">Choose {c.competitor} if…</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-muted">
            {c.chooseThem.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="card border-gradient p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold">Choose Backlink Arena if…</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-red">
            {c.chooseUs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6">
        <Prose>{c.body()}</Prose>
      </div>

      {c.faq && (
        <section className="mt-14">
          <h2 className="headline text-3xl">Questions</h2>
          <FaqList items={c.faq} />
        </section>
      )}

      <ContentCta title={`Try it next to ${c.competitor}`} />

      {others.length > 0 && (
        <p className="mt-10 text-sm text-muted">
          More comparisons:{" "}
          {others.map((o, i) => (
            <span key={o.slug}>
              {i > 0 && " · "}
              <Link href={`/compare/${o.slug}`} className="font-semibold underline">
                {o.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
