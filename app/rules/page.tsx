import type { Metadata } from "next";

export const metadata: Metadata = { title: "Official rules" };

/* Admin: replace the placeholder below with the official rules text. */
const RULES = `Official rules will be published here.`;

export default function RulesPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">Official rules</h1>
      <div className="mt-6 whitespace-pre-line leading-relaxed">{RULES}</div>
    </article>
  );
}
