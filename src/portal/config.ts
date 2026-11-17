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
    // Darker than the handoff palette, per Vedant's storyboard review.
    deep: "#020204",
    lift: "#04060c",
    nebulaIndigo: "#33416b",
    nebulaMarigold: "#e9a321",
    nebulaCoral: "#f1a98c",
    nebulaStrength: 0.32,
  },
  stars: {
    // Stars in a 16:9 view. 20% fewer than the storyboard, per Vedant.
    count: 3000,
    twinkle: 0.35,
  },
  planet: {
    // Dusk: clay and coral, with a slate blue cast in the bands and the rim.
    a: "#26181a",
    b: "#583c34",
    tint: "#2b3552",
    tintAmount: 0.5,
    rim: "#a98a9c",
    turnsPerMinute: 0.05,
  },
  moon: {
    a: "#262625",
    b: "#54524d",
    rim: "#8c8a85",
  },
  dust: {
    strength: 1,
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
    // A stroke smaller than this is noise, not a circle.
    minRadiusPx: 14,
    // Small circles are accepted and grown to at least this share of the short side.
    minRingRadiusViewport: 0.09,
    guideAfterFails: 2,
  },
  snap: {
    ms: 240,
    // The snapped circle is always this much bigger than the drawn stroke.
    grow: 1.15,
  },
  ignition: {
    ms: 660,
    chromaticSplit: 0.016,
    cameraPush: 0.03,
    lens: 0.75,
  },
  ring: {
    width: 0.16,
    intensity: 1.12,
  },
  opening: {
    ms: 1200,
    maxChromatic: 0.016,
    swellMs: 150,
    swellStrength: 0.55,
    destinationScale: 1.35,
    destinationBlurPx: 10,
  },
  film: {
    grain: 0.045,
    vignette: 0.5,
    bloom: 0.35,
    bloomThreshold: 0.75,
    edgeFringe: 0.00025,
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
