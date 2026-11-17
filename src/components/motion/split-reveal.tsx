"use client";

import { useRef, type ReactNode } from "react";
import { gsap, SplitText, useGSAP, MOTION_OK } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  className?: string;
  /** Seconds before the first word moves. */
  delay?: number;
};

/**
 * Entrance for type that is on screen at load. Words rise out of a line mask.
 *
 * The `data-reveal` attribute pairs with a rule in globals.css that hides the
 * element only when scripting is on and motion is allowed, with a CSS failsafe
 * that shows it anyway if this component never runs. See CLAUDE.md, "Motion".
 */
export function SplitReveal({ children, className, delay = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(el, {
          type: "lines,words",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, {
              yPercent: 110,
              duration: 0.9,
              ease: "expo.out",
              stagger: 0.05,
              delay,
            }),
        });
        el.setAttribute("data-revealed", "");

        return () => split.revert();
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} data-reveal className={className} style={{ display: "block" }}>
      {children}
    </span>
  );
}
