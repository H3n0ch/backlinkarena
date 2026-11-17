/*
  Posts people made about Backlink Arena, shown in the "From the stands" wall on the homepage.

  Only add real posts, and link each one to the original so visitors can check it.
  The section is hidden everywhere until there are MIN_TESTIMONIALS posts (preview: WALL_PREVIEW=1).
  Copy the text as written (trim if needed, but don't reword).
*/

export type TestimonialSource = "x" | "linkedin" | "facebook" | "telegram" | "whatsapp" | "email";

export type Testimonial = {
  source: TestimonialSource;
  name: string;
  /** @handle on X, job title on LinkedIn, etc. Optional. */
  handle?: string;
  /** Profile photo URL. Falls back to the first letter of the name. */
  avatar?: string;
  text: string;
  /** ISO date of the post, e.g. "2026-11-14". */
  date: string;
  /** Link to the original post. Leave out for private sources (WhatsApp, email). */
  url?: string;
  /** Marks dev-only placeholder cards. Never set this on real posts. */
  sample?: boolean;
};

export const MIN_TESTIMONIALS = 6;

export const TESTIMONIALS: Testimonial[] = [
  // {
  //   source: "x",
  //   name: "Jane Doe",
  //   handle: "@janedoe",
  //   avatar: "https://unavatar.io/x/janedoe",
  //   text: "Paste the post text here.",
  //   date: "2026-11-14",
  //   url: "https://x.com/janedoe/status/123",
  // },
];

/* Placeholder cards so the layout can be previewed in `next dev`. Never shown in production. */
const SOURCES: TestimonialSource[] = ["x", "linkedin", "x", "facebook", "telegram", "x", "email", "linkedin"];
const SAMPLES: Testimonial[] = SOURCES.map((source, i) => ({
  source,
  name: `Sample founder ${i + 1}`,
  handle: source === "x" ? `@sample${i + 1}` : undefined,
  text:
    i % 2
      ? "Sample post. Replace with a real one in lib/testimonials.ts."
      : "Sample post. Longer posts wrap over several lines and get cut off after six, so the cards in a row stay the same height. Replace with a real one in lib/testimonials.ts.",
  date: `2026-11-${String(2 + i).padStart(2, "0")}`,
  sample: true,
}));

/**
 * Real posts. To preview the layout with sample cards, run `next dev` with WALL_PREVIEW=1
 * in .env.local (ignored in production builds).
 */
export function getTestimonials(): Testimonial[] {
  const preview = process.env.NODE_ENV === "development" && process.env.WALL_PREVIEW === "1";
  if (!preview || TESTIMONIALS.length >= MIN_TESTIMONIALS) return TESTIMONIALS;
  return [...TESTIMONIALS, ...SAMPLES];
}
