import Link from "next/link";
import { ScrollRise } from "@/components/motion/scroll-rise";
import { SplitReveal } from "@/components/motion/split-reveal";
import { work } from "@/lib/work";

/*
  Scaffold only. This page exists to prove the stack end to end (SplitText
  entrance, Lenis, ScrollTrigger, reduced motion). The story folds replace it.
*/
export default function Home() {
  return (
    <main>
      <section className="flex min-h-svh flex-col justify-end px-6 pb-10 md:px-10">
        <h1 className="text-[clamp(3.5rem,13vw,13rem)] font-medium leading-[0.9] tracking-tighter">
          <SplitReveal>Vedant Vaibhav</SplitReveal>
        </h1>
        <p className="mt-6 max-w-md text-lg">
          Senior Product Designer at ShopOS, Bangalore.
        </p>
        <p className="mt-2 font-mono text-sm text-muted">
          Scaffold. The story goes here.
        </p>
      </section>

      <section className="px-6 pb-40 pt-[40svh] md:px-10" aria-labelledby="work">
        <h2 id="work" className="font-mono text-sm text-muted">
          Work
        </h2>
        <ScrollRise className="mt-6 border-t border-foreground/15">
          {work.map((entry) => (
            <Link
              key={entry.slug}
              href={`/work/${entry.slug}`}
              className="flex items-baseline justify-between gap-6 border-b border-foreground/15 py-8"
            >
              <span className="text-3xl font-medium tracking-tight md:text-5xl">
                {entry.title}
              </span>
              <span className="font-mono text-sm text-muted">{entry.name}</span>
            </Link>
          ))}
        </ScrollRise>
      </section>
    </main>
  );
}
