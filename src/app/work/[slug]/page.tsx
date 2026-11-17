import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWork, work } from "@/lib/work";

export function generateStaticParams() {
  return work.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = getWork(slug);
  return entry ? { title: `${entry.name}: ${entry.title}` } : {};
}

export default async function WorkPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const entry = getWork(slug);
  if (!entry) notFound();

  const { default: Body } = await import(`@/content/work/${entry.slug}.mdx`);

  return (
    <main className="px-6 pb-40 pt-32 md:px-10">
      <p className="font-mono text-sm text-muted">{entry.name}</p>
      <h1 className="mt-4 max-w-5xl text-5xl font-medium tracking-tight md:text-8xl">
        {entry.title}
      </h1>
      <article className="mt-16 max-w-2xl text-lg leading-relaxed">
        <Body />
      </article>
    </main>
  );
}
