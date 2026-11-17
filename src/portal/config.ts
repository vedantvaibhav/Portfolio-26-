/**
 * Every timing, colour and intensity for the Portal entry lives in this file
 * and nowhere else. The debug panel (open the page with ?debug) is built from
 * this object, so a value added here shows up there.
 *
 * All numbers are starting points from docs/portal/handoff.md and the approved
 * storyboard. Vedant tunes them by feel.
 */
export const portalConfig = {
  space: {
    // Black and white. Colour only arrives with the ring.
    deep: "#010101",
    lift: "#050505",
    nebulaIndigo: "#3a3a3a",
    nebulaMarigold: "#2a2a2a",
    nebulaCoral: "#2a2a2a",
    nebulaStrength: 0.08,
  },
  stars: {
    // Stars in a 16:9 view.
    count: 2600,
    twinkle: 0.35,
  },
  wormhole: {
    // Phones draw half as many.
    grains: 260000,
    grainSize: 0.095,
    innerRadius: 15,
    outerRadius: 130,
    // Where the hole sits: share of the half width and half height from the centre, and how far away.
    x: 0.26,
    y: 0.14,
    depth: 56,
    // How far above the disc the camera looks from, and how much the horizon leans. Degrees.
    elevation: 20,
    roll: -11,
    // How many radians a grain winds on its way in, and how deep the sheet dips into the hole.
    swirl: 6,
    well: 0.28,
    // Share of the journey from rim to hole covered per second. 0.006 takes about three minutes.
    flow: 0.006,
    // During ignition and the opening the flow runs this many times faster.
    pullBoost: 10,
    gain: 2.6,
    brightAngle: 120,
  },
  camera: {
    fov: 40,
    // How far the camera turns and slides toward the pointer.
    leanDegrees: 1.5,
    leanShift: 0.25,
    // Higher is snappier. 3 settles in about a second.
    leanSpeed: 3,
    drift: 0.12,
    breathe: 0.35,
  },
  prompt: {
    delayMs: 1200,
  },
  recognition: {
    // Generous on purpose: anything remotely like a circle passes.
    resamplePx: 6,
    maxRoundness: 0.5,
    minSweepRad: 4.4,
    closeGapFactor: 1.3,
    fullSweepRad: 5.6,
    // While the hand is still down, wait for a loop this complete before igniting.
    liveSweepRad: 5.9,
    // More than about a turn and a half is a spiral.
    maxSweepRad: 9.5,
    // A stroke smaller than this is noise, not a circle.
    minRadiusPx: 14,
    // Small circles are accepted and grown to at least this share of the short side.
    minRingRadiusViewport: 0.09,
    maxRingRadiusViewport: 0.46,
    guideAfterFails: 2,
  },
  trail: {
    // Width of the bright core. Slow strokes are soft and wide, fast ones thin.
    coreSlowPx: 3.2,
    coreFastPx: 1.5,
    // Pointer speed, in px per ms, that counts as fast.
    fastSpeed: 1.6,
    failFadeMs: 500,
  },
  snap: {
    ms: 240,
    // The snapped circle is always this much bigger than the drawn stroke.
    grow: 1.15,
  },
  ignition: {
    ms: 1200,
    chromaticSplit: 0.016,
    cameraPush: 0.03,
    lens: 0.75,
  },
  ring: {
    width: 0.16,
    intensity: 1.12,
  },
  opening: {
    ms: 2100,
    maxChromatic: 0.016,
    swellMs: 150,
    swellStrength: 0.55,
    destinationScale: 1.35,
    destinationBlurPx: 10,
    // Share of the opening that passes before the page starts to settle.
    settleFrom: 0.3,
    ringWidthEnd: 0.05,
    starFade: 0.3,
    push: 3,
  },
  reduced: {
    crossfadeMs: 400,
  },
  film: {
    grain: 0.045,
    vignette: 0.5,
    bloom: 0.22,
    bloomThreshold: 0.75,
    // No colour fringing at rest: the space is black and white until the ring.
    edgeFringe: 0,
  },
  quality: {
    stepDownMs: 22,
    stepUpMs: 12,
    cooldownMs: 2000,
    dprDesktop: 2,
    dprMobile: 1.5,
  },
};

export type PortalConfig = typeof portalConfig;
