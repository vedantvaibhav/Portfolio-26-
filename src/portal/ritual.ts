import { gsap } from "@/lib/gsap";
import type { PortalConfig } from "./config";

/** Every animated value of the entry. The timeline moves these; the scene reads them each frame. */
export type Fx = {
  /** 0 the wormhole at rest, 1 every grain drawn into the point and gone. */
  drain: number;
  /** 0 the page's text hidden, 1 fully there. It comes up once the grains have gone. */
  reveal: number;
  /** Opacity of the cover. Only the reduced motion path fades it. */
  cover: number;
};

export function restFx(): Fx {
  return { drain: 0, reveal: 0, cover: 1 };
}

type Hooks = { onGone: () => void; onDone: () => void; onReturned: () => void };

/**
 * The master timeline: the grains drain to a point and the frame is left
 * black, then the text of the page comes up on it. It is built paused.
 * Playing it forward is the way in; reversing it before the "gone" label is
 * letting go of a hold.
 */
export function buildDrain(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const drain = config.drain.ms / 1000;
  const from = drain * config.reveal.from;
  const appear = config.reveal.ms / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });

  // Each grain eases on its own in the shader, so the clock itself runs evenly.
  tl.to(fx, { drain: 1, duration: drain, ease: "none" }, 0)
    .to(fx, { reveal: 1, duration: appear, ease: "sine.inOut" }, from)
    .addLabel("gone", drain)
    .call(hooks.onGone, undefined, "gone")
    // A short beat with everything in place before the entry steps aside.
    .to({}, { duration: config.reveal.tailMs / 1000 }, Math.max(drain, from + appear));

  return tl;
}

/** Reduced motion: nothing moves. The wormhole fades and the text fades in. */
export function buildReducedDrain(fx: Fx, config: PortalConfig, hooks: Hooks) {
  const fade = config.reduced.crossfadeMs / 1000;
  const tl = gsap.timeline({ paused: true, onComplete: hooks.onDone, onReverseComplete: hooks.onReturned });
  tl.addLabel("gone", 0)
    .call(hooks.onGone, undefined, 0)
    .to(fx, { cover: 0, reveal: 1, duration: fade, ease: "none" }, 0);
  return tl;
}
