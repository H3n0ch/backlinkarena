import type { Post } from "@/content/types";
import { post as areLaunchDirectoriesWorthIt } from "./are-launch-directories-worth-it";
import { post as firstBacklinksNewStartup } from "./first-backlinks-new-startup";
import { post as whatIsADa50Backlink } from "./what-is-a-da-50-backlink";

/*
 * Every blog post. To add one: create a file next to this one exporting `post`, then add it here.
 * The page, sitemap, llms.txt and structured data pick it up automatically.
 */
export const POSTS: Post[] = [firstBacklinksNewStartup, areLaunchDirectoriesWorthIt, whatIsADa50Backlink].sort(
  (a, b) => b.published.localeCompare(a.published),
);

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}
