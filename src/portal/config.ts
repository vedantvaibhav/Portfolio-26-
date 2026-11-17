/**
 * Every timing, colour and intensity for the Portal entry lives in this file
 * and nowhere else. The debug panel (open the page with ?debug) is built from
 * this object, so a value added here shows up there.
 *
 * All numbers are starting points. Vedant tunes them by feel.
 */
export const portalConfig = {
  space: {
    // Pure black. There is nothing in the frame but the wormhole.
    deep: "#000000",
    lift: "#000000",
  },
  wormhole: {
    // Points in the cloud. Phones use about a third.
    points: 700000,
    pointSize: 0.055,
    // How far points sit off the sheet, as a share of their distance from the hole.
    thickness: 0.009,
    innerRadius: 15,
    outerRadius: 85,
    // Where the hole sits: share of the half width and half height from the centre, and how far away.
    x: 0.24,
    y: 0.16,
    depth: 54,
    // How far above the sheet the camera looks from, and how much the horizon leans. Degrees.
    elevation: 24,
    roll: -9,
    // How many radians the flow winds on its way in, and how deep the sheet dips at the lip.
    swirl: 6,
    well: 0.42,
    // Share of the journey from rim to hole covered per second. 0.004 takes about four minutes.
    flow: 0.004,
    gain: 1.0,
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
  dive: {
    // Two ways in. A scroll plays the whole thing. A press and hold plays the
    // first part for as long as it is held; let go early and it eases back.
    //
    // First part, the wrap: the camera rises over the hole until the tilted
    // disc is a full circle in the middle of the screen.
    wrapMs: 1500,
    // Second part, the fall: straight down the throat.
    fallMs: 1300,
    // How high over the hole the wrap ends, and how far down the throat the fall ends. In hole radii.
    height: 4.6,
    depth: 0.9,
    // The lens widens as it falls, which is most of the feeling of speed. Degrees.
    fovEnd: 76,
    // The flow of the grains runs this many times faster by the end of the fall.
    pullBoost: 16,
    // Strength of the streaks that rush past in the throat.
    streaks: 1,
    // Letting go early plays the wrap backwards this many times faster.
    returnSpeed: 1.7,
  },
  opening: {
    // The site opens from a point of light at the bottom of the throat.
    // It starts this far through the fall and takes this long.
    startAt: 0.55,
    ms: 1100,
    rim: 0.8,
    destinationScale: 1.35,
    destinationBlurPx: 10,
    // Share of the opening that passes before the page starts to settle.
    settleFrom: 0.3,
  },
  reduced: {
    crossfadeMs: 400,
  },
  film: {
    grain: 0.045,
    vignette: 0.5,
    bloom: 0.22,
    bloomThreshold: 0.75,
  },
  quality: {
    // If the average frame takes longer than stepDownMs, draw fewer points. If it is
    // shorter than stepUpMs, draw more again. cooldownMs keeps it from flip flopping.
    stepDownMs: 22,
    stepUpMs: 12,
    cooldownMs: 2000,
    dprDesktop: 2,
    dprMobile: 1.5,
  },
};

export type PortalConfig = typeof portalConfig;
