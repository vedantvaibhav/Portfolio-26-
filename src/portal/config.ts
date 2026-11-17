/**
 * Every timing, colour and intensity for the Portal entry lives in this file
 * and nowhere else. The debug panel (open the page with ?debug) is built from
 * this object, so a value added here shows up there.
 *
 * All numbers are starting points. Vedant tunes them by feel.
 */
export const portalConfig = {
  wormhole: {
    // Points in the cloud. Phones use about a third.
    points: 700000,
    pointSize: 0.055,
    // How far points sit off the sheet, as a share of their distance from the hole.
    thickness: 0.009,
    innerRadius: 15,
    outerRadius: 85,
    // Where the black of the hole sits: share of the half width and half height from the
    // centre of the screen. 0 and 0 is dead centre. It sits a touch right and up, because the
    // disc leans and is heavier at the lower left, which leaves the top right empty otherwise.
    // Then how far away it is.
    x: 0.09,
    y: 0.03,
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
  drain: {
    // The way in. The grains leave the wormhole one by one and fly to a point,
    // where they vanish, leaving black. The wormhole itself does not move or
    // bend: it holds its shape and thins out. A scroll does it at the centre of
    // the hole. A press and hold inside the hole does it wherever the hold is,
    // for as long as it is held; let go early and the grains come back.
    ms: 3300,
    // How much of that time one grain's own trip takes. The rest is the spread
    // of when they leave. Smaller means a longer, thinner stream.
    flight: 0.3,
    // A grain's own trip: 1 is an even pace, higher starts slow and ends fast.
    rush: 2.4,
    // How much each grain's path bows on the way. 0 is a straight line.
    curve: 0.45,
    // How much of the way to the point they travel before they are gone. 1 is all the way.
    travel: 1,
    // The flow of the wormhole runs this many times faster by the end.
    pullBoost: 6,
    // Letting go early plays it backwards this many times faster.
    returnSpeed: 1.6,
    // A hold counts if it lands within this many hole radii of the centre.
    reach: 1.05,
  },
  appear: {
    // Once the frame is black it stays black for a moment, then the site comes up on it.
    pauseMs: 300,
    ms: 1500,
    // The page starts this much larger and settles to its true size.
    scale: 1.03,
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
