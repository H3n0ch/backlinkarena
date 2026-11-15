import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

/* Admin: replace the placeholder below with the privacy policy text. */
const PRIVACY = `Our privacy policy will be published here.`;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">Privacy policy</h1>
      <div className="mt-6 whitespace-pre-line leading-relaxed">{PRIVACY}</div>
    </article>
  );
}
