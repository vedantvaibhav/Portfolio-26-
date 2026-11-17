/**
 * Case studies, in the order they appear on the home page.
 * Bodies live in src/content/work/<slug>.mdx.
 */
export const work = [
  { slug: "mysa", name: "Mysa", title: "Bills that arrive pre-thought" },
  { slug: "agents", name: "ShopOS", title: "One voice, many agents" },
  { slug: "sloosh", name: "Sloosh", title: "The product and the funnel" },
  { slug: "stash", name: "Stash", title: "The app my team switched to" },
] as const;

export type Work = (typeof work)[number];

export function getWork(slug: string): Work | undefined {
  return work.find((entry) => entry.slug === slug);
}
