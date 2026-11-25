import type { Comparison } from "@/content/types";
import { comparison as betalist } from "./betalist";
import { comparison as productHunt } from "./product-hunt";

/*
 * Every "Backlink Arena vs X" page. To add one: create a file next to this one exporting `comparison`, add it here.
 * Only state facts about the competitor you checked on their own site, and update `checked` when you re-check.
 */
export const COMPARISONS: Comparison[] = [productHunt, betalist];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
