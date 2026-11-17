import { gsap } from "@/lib/gsap";
import type { PortalConfig } from "./config";

/** Every animated value of the ritual. The timeline moves these; the scene reads them each frame. */
export type Fx = {
  /** Brightness of the drawn stroke. */
  trail: number;
  /** 0 the stroke as drawn, 1 pulled onto the perfect circle. */
  morph: number;
  /** The thin white circle the stroke snaps into. */
  thin: number;
  ringI: number;
  /** 0 the ring at its ignition size, 1 past the edges of the screen. */
  open: number;
  ringW: number;
  ringSplit: number;
  lens: number;
  pull: number;
  warp: number;
  /** Extra colour fringing across the whole frame. */
  fringe: number;
  /** 1 once the hole is cut and the page shows through the ring. */
  hole: number;
  swell: number;
  stars: number;
  /** Camera push toward the ring. */
  push: number;
  /** 0 the page scaled up and blurred, 1 settled. */
  settle: number;
  /** Opacity of the whole cover. Only the reduced motion path fades it. */
  cover: number;
  guide: number;
};

export function restFx(): Fx {
  return {
    trail: 1, morph: 0, thin: 0, ringI: 0, open: 0, ringW: 0.16, ringSplit: 0, lens: 0, pull: 0, warp: 0,
    fringe: 0, hole: 0, swell: 0, stars: 1, push: 0, settle: 0, cover: 1, guide: 0,
  };
}

type Hooks = { onIgnite: () => void; onOpen: () => void; onDone: () => void };

/**
 * The master timeline, from the loop closing to the site. One timeline, so
 * the debug panel can pause and scrub it.
 */
export function buildOpening(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const snap = config.snap.ms / 1000;
  const ignition = config.ignition.ms / 1000;
  const opening = config.opening.ms / 1000;
  const tl = gsap.timeline({ onComplete: hooks.onDone });

  // Snap: the stroke pulls onto a perfect circle. Magnetic.
  tl.to(fx, { morph: 1, duration: snap, ease: "power3.out" }, 0)
    .to(fx, { thin: 1, duration: snap * 0.8, ease: "power2.out" }, snap * 0.2)
    .to(fx, { trail: 0, duration: snap * 0.6, ease: "power1.in" }, snap * 0.5)
    .to(fx, { guide: 0, duration: snap }, 0);

  // Ignition: the held breath.
  tl.addLabel("ignition", snap)
    .call(hooks.onIgnite, undefined, "ignition")
    .set(fx, { ringW: config.ring.width }, "ignition")
    .to(fx, { ringI: config.ring.intensity, duration: ignition * 0.55, ease: "power2.out" }, "ignition")
    .to(fx, { thin: 0, duration: ignition * 0.45, ease: "power1.out" }, "ignition")
    // The colours pull apart as it lights, then ease back to a trace.
    .to(fx, { ringSplit: config.ignition.chromaticSplit * 3, fringe: 0.0012, duration: ignition * 0.18, ease: "power2.out" }, "ignition")
    .to(fx, { ringSplit: config.ignition.chromaticSplit, fringe: 0.0003, duration: ignition * 0.6, ease: "power2.out" }, `ignition+=${ignition * 0.18}`)
    .to(fx, { lens: config.ignition.lens, duration: ignition, ease: "power2.inOut" }, "ignition")
    .to(fx, { pull: 1, duration: ignition * 0.7, ease: "power1.in" }, "ignition")
    .to(fx, { push: 1, duration: ignition, ease: "power1.inOut" }, "ignition");

  // Opening: slow, then very fast.
  const start = snap + ignition;
  tl.addLabel("opening", start)
    .call(hooks.onOpen, undefined, "opening")
    .set(fx, { hole: 1 }, "opening")
    .to(fx, { open: 1, duration: opening, ease: "power3.in" }, "opening")
    .to(fx, { ringW: config.opening.ringWidthEnd, duration: opening, ease: "power2.in" }, "opening")
    .to(fx, { warp: 1, duration: opening, ease: "power2.in" }, "opening")
    .to(fx, { push: config.opening.push, duration: opening, ease: "power3.in" }, "opening")
    .to(fx, { stars: config.opening.starFade, pull: 0, duration: opening * 0.6, ease: "power1.in" }, "opening")
    .to(fx, { lens: 0.3, duration: opening, ease: "power1.in" }, "opening")
    .to(fx, { fringe: config.opening.maxChromatic, ringSplit: config.ignition.chromaticSplit * 0.5, duration: opening * 0.8, ease: "power2.in" }, "opening")
    .to(fx, { fringe: 0, duration: opening * 0.2, ease: "power1.out" }, `opening+=${opening * 0.8}`)
    .to(fx, { settle: 1, duration: opening * (1 - config.opening.settleFrom), ease: "power2.out" }, `opening+=${opening * config.opening.settleFrom}`);

  // One soft swell as the ring crosses the edge. Short, never white, never twice.
  const swell = config.opening.swellMs / 1000;
  tl.to(fx, { swell: config.opening.swellStrength, duration: swell * 0.45, ease: "power1.out" }, start + opening * 0.86 - swell * 0.45)
    .to(fx, { swell: 0, duration: swell * 0.55, ease: "power1.in" }, start + opening * 0.86);

  return tl;
}

/** Reduced motion: no warp and no push. The ring fades in, then the site crossfades. */
export function buildReducedOpening(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const fade = config.reduced.crossfadeMs / 1000;
  const tl = gsap.timeline({ onComplete: hooks.onDone });
  tl.set(fx, { morph: 1, trail: 0, guide: 0, ringW: config.ring.width }, 0)
    .call(hooks.onIgnite, undefined, 0)
    .to(fx, { ringI: config.ring.intensity, duration: 0.3, ease: "none" }, 0)
    .call(hooks.onOpen, undefined, 0.3)
    .to(fx, { cover: 0, duration: fade, ease: "none" }, 0.3);
  return tl;
}
