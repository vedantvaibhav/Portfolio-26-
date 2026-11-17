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
    nebulaStrength: 0.24,
  },
  camera: {
    fov: 40,
    leanDegrees: 3,
    leanLerp: 0.05,
  },
  prompt: {
    delayMs: 1200,
  },
  recognition: {
    resamplePx: 6,
    maxRoundness: 0.38,
    minSweepRad: 5.0,
    closeGapFactor: 0.9,
    fullSweepRad: 6.0,
    minRadiusPx: 40,
    minRadiusViewport: 0.06,
    guideAfterFails: 2,
    skipLinkAfterFails: 3,
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
