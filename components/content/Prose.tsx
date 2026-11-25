import Link from "next/link";
import type { ReactNode } from "react";
import { JoinField } from "@/components/JoinField";

/** Long-form article styling, shared by blog posts, comparisons and landing pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "text-[17px] leading-relaxed",
        "[&>*+*]:mt-4",
        "[&_h2]:headline [&_h2]:mt-12! [&_h2]:text-3xl",
        "[&_h3]:mt-8! [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-extrabold",
        "[&_a]:font-semibold [&_a]:underline [&_a]:decoration-red/40 [&_a]:underline-offset-2 hover:[&_a]:decoration-red",
        "[&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:flex [&_ul,&_ol]:flex-col [&_ul,&_ol]:gap-2 [&_ul,&_ol]:pl-5 [&_li]:marker:text-red",
        "[&_code]:rounded [&_code]:bg-cream [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-red/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** A highlighted aside inside an article. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="card my-8! p-5 sm:p-6">
      <p className="font-display text-lg font-extrabold">{title}</p>
      <div className="mt-2 text-base [&>*+*]:mt-3">{children}</div>
    </aside>
  );
}

/** The closing call to action on every content page. */
export function ContentCta({
  title = "Get your first backlink by playing",
  text = "Enter your website for free. You get a brand page with a link to your site right away, and the champion wins a backlink on a real DA 50+ site in their niche.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="relative mt-16 overflow-hidden rounded-[0.875rem] bg-dark-gradient p-6 text-white ring-1 ring-white/10 sm:p-10">
      <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />
      <p className="headline text-3xl sm:text-4xl">{title}</p>
      <p className="mt-3 max-w-xl text-white/75">{text}</p>
      <div className="mt-6 max-w-lg">
        <JoinField cta="Enter free" />
      </div>
      <p className="mt-4 text-sm text-white/60">
        Want links without playing?{" "}
        <Link href="/services" className="font-semibold text-white underline">
          See our backlink services
        </Link>
        .
      </p>
    </section>
  );
}

/** Question/answer list. Pair it with faqSchema() for structured data. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {items.map((f) => (
        <details key={f.q} className="card group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {f.q}
            <span className="text-red transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
