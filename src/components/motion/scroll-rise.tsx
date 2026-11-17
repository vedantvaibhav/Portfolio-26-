"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP, MOTION_OK } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Direct children rise in as they scroll into view. For content below the
 * fold only: it uses gsap.from(), so the resting state in the HTML is the
 * finished state and nothing depends on this script to be readable.
 */
export function ScrollRise({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const items = Array.from(el.children);
        gsap.set(items, { y: 32, autoAlpha: 0 });

        ScrollTrigger.batch(items, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.8,
              ease: "expo.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });

        return () => gsap.set(items, { clearProps: "all" });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
