import { gsap } from "@/lib/gsap";
import type { PortalConfig } from "./config";

/** Every animated value of the entry. The timeline moves these; the scene reads them each frame. */
export type Fx = {
  /** 0 the camera at rest beside the disc, 1 directly over the hole looking down it. */
  wrap: number;
  /** 0 over the hole, 1 deep in the throat. */
  fall: number;
  /** How hard the grains are being pulled in. Speeds the flow. */
  pull: number;
  /** Streaks rushing past the lens. */
  streaks: number;
  /** Brightness of the wormhole. It goes dark once the camera is inside. */
  glow: number;
  /** 1 once the hole is cut and the page shows through. */
  hole: number;
  /** 0 the opening is a point, 1 it is past the edges of the screen. */
  open: number;
  /** The white edge of the opening. */
  rim: number;
  /** 0 the page scaled up and blurred, 1 settled. */
  settle: number;
  /** Opacity of the whole cover. Only the reduced motion path fades it. */
  cover: number;
};

export function restFx(): Fx {
  return { wrap: 0, fall: 0, pull: 0, streaks: 0, glow: 1, hole: 0, open: 0, rim: 0, settle: 0, cover: 1 };
}

type Hooks = { onFall: () => void; onOpen: () => void; onDone: () => void; onReturned: () => void };

/**
 * The master timeline: the wrap, the fall, and the site opening at the bottom.
 * It is built paused. Playing it forward is the way in; reversing it before
 * the "fall" label is letting go of a hold.
 */
export function buildDive(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const wrap = config.dive.wrapMs / 1000;
  const fall = config.dive.fallMs / 1000;
  const opening = config.opening.ms / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });

  // The wrap: up and over, until the disc is a circle.
  tl.to(fx, { wrap: 1, duration: wrap, ease: "power2.inOut" }, 0)
    .to(fx, { pull: 0.35, duration: wrap, ease: "power1.in" }, 0);

  // The fall. Slow to leave, then it runs away.
  tl.addLabel("fall", wrap)
    .call(hooks.onFall, undefined, "fall")
    .to(fx, { fall: 1, duration: fall, ease: "power2.in" }, "fall")
    .to(fx, { pull: 1, duration: fall * 0.6, ease: "power1.in" }, "fall")
    .to(fx, { streaks: config.dive.streaks, duration: fall * 0.5, ease: "power2.in" }, `fall+=${fall * 0.15}`)
    .to(fx, { glow: 0, duration: fall * 0.35, ease: "power1.in" }, `fall+=${fall * 0.5}`);

  // The way out: a point of light at the bottom that grows until it is the page.
  tl.addLabel("opening", wrap + fall * config.opening.startAt)
    .call(hooks.onOpen, undefined, "opening")
    .set(fx, { hole: 1 }, "opening")
    .to(fx, { open: 1, duration: opening, ease: "power1.in" }, "opening")
    .to(fx, { rim: config.opening.rim, duration: opening * 0.3, ease: "power1.out" }, "opening")
    .to(fx, { rim: 0, streaks: 0, duration: opening * 0.35, ease: "power1.in" }, `opening+=${opening * 0.65}`)
    .to(
      fx,
      { settle: 1, duration: opening * (1 - config.opening.settleFrom), ease: "power2.out" },
      `opening+=${opening * config.opening.settleFrom}`,
    );

  return tl;
}

/** Reduced motion: no camera move. The site crossfades in. */
export function buildReducedDive(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const fade = config.reduced.crossfadeMs / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });
  tl.addLabel("fall", 0)
    .call(hooks.onOpen, undefined, 0)
    .to(fx, { cover: 0, duration: fade, ease: "none" }, 0);
  return tl;
}
