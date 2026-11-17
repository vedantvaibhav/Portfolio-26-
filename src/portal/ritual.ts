import { gsap } from "@/lib/gsap";
import type { PortalConfig } from "./config";

/** Every animated value of the entry. The timeline moves these; the scene reads them each frame. */
export type Fx = {
  /** 0 the wormhole at rest, 1 every grain drawn into the point and gone. */
  drain: number;
  /** Opacity of the cover. It fades to show the site, which sits on the same black. */
  cover: number;
  /** 0 the page slightly enlarged, 1 settled. */
  settle: number;
};

export function restFx(): Fx {
  return { drain: 0, cover: 1, settle: 0 };
}

type Hooks = { onGone: () => void; onDone: () => void; onReturned: () => void };

/**
 * The master timeline: the grains drain to a point, then the site appears on
 * the black they leave. It is built paused. Playing it forward is the way in;
 * reversing it before the "gone" label is letting go of a hold.
 */
export function buildDrain(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const drain = config.drain.ms / 1000;
  const appear = config.appear.ms / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });

  // Each grain eases on its own in the shader, so the clock itself runs evenly.
  tl.to(fx, { drain: 1, duration: drain, ease: "none" }, 0);

  const pause = config.appear.pauseMs / 1000;
  tl.addLabel("gone", drain)
    .call(hooks.onGone, undefined, "gone")
    .to(fx, { cover: 0, duration: appear, ease: "sine.inOut" }, `gone+=${pause}`)
    .to(fx, { settle: 1, duration: appear, ease: "power2.out" }, `gone+=${pause}`);

  return tl;
}

/** Reduced motion: nothing moves. The site crossfades in. */
export function buildReducedDrain(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const fade = config.reduced.crossfadeMs / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });
  tl.addLabel("gone", 0)
    .call(hooks.onGone, undefined, 0)
    .to(fx, { cover: 0, settle: 1, duration: fade, ease: "none" }, 0);
  return tl;
}
