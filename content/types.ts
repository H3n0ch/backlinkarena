import type { ReactNode } from "react";

export type Faq = { q: string; a: string };

/** A blog post. The body is plain JSX, rendered inside <Prose>. */
export type Post = {
  slug: string;
  /** H1 on the page. */
  title: string;
  /** <title> tag, if it should differ from the H1 (keyword-first, under ~60 chars). */
  seoTitle?: string;
  /** Meta description and card text (~150 chars). */
  description: string;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated?: string;
  readMinutes: number;
  body: () => ReactNode;
  faq?: Faq[];
};

/** A "Backlink Arena vs X" page. */
export type Comparison = {
  slug: string;
  competitor: string;
  title: string;
  seoTitle?: string;
  description: string;
  /** When the facts about the competitor were last checked against their own site. */
  checked: string;
  /** One-paragraph answer at the top: who should use which. */
  verdict: string;
  rows: { label: string; us: string; them: string }[];
  chooseThem: string[];
  chooseUs: string[];
  body: () => ReactNode;
  faq?: Faq[];
};
