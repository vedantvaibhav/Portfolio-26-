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
    x: 0.05,
    y: 0.02,
    depth: 54,
    // How far above the sheet the camera looks from, and how much the horizon leans. Degrees.
    elevation: 24,
    // Leaning this way puts the bright near rim at the lower right and leaves the top left empty for the text.
    roll: 9,
    // How many radians the flow winds on its way in, and how deep the sheet dips at the lip.
    swirl: 6,
    well: 0.42,
    // Share of the journey from rim to hole covered per second. 0.004 takes about four minutes.
    flow: 0.004,
    gain: 1.0,
    brightAngle: 60,
  },
  camera: {
    fov: 40,
    // The parallax. The camera slides toward the pointer far more than it turns,
    // so near grains shift more than far ones and the cloud moves within itself.
    leanDegrees: 0.35,
    leanShift: 1.3,
    // Higher is snappier. 3 settles in about a second.
    leanSpeed: 3,
    drift: 0.12,
    breathe: 0.35,
  },
  hover: {
    // The pointer stirs the grains near it. radius is how wide, in screen heights.
    // The effect fades out softly from the middle, so there is no edge.
    radius: 0.24,
    // How far each grain wanders on its own while the pointer is near. Screen heights.
    push: 0.016,
    // How far grains are carried along with the pointer's movement. Higher trails more.
    drag: 0.06,
    // How quickly the effect follows the pointer, and how long it lingers once it stops.
    follow: 7,
    fadeAfterMs: 1800,
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
    // A hold runs this many times faster than a scroll.
    holdSpeed: 1.45,
    // Letting go early plays it backwards this many times faster.
    returnSpeed: 1.6,
    // A hold counts if it lands within this many hole radii of the centre.
    reach: 1.05,
  },
  reveal: {
    // Everything drains away first, and the frame is left black. Then the text of the
    // page comes up on it. from is the share of the drain at which it starts: by 0.92
    // only the last few grains are left. ms is how long it takes to appear.
    from: 0.92,
    ms: 800,
    // It starts this much larger and settles to its true size as it appears.
    scale: 1.03,
    // A short beat with everything in place before the entry steps aside.
    tailMs: 150,
  },
  loading: {
    // The count from 0 to 100 never runs faster than this, however quick the load.
    minMs: 1900,
    // The number moves on in steps about this far apart, and each digit rolls to its new place over rollMs.
    stepMs: 360,
    rollMs: 650,
    // At 100 it holds for a moment, then rolls away before the wormhole comes up.
    holdMs: 260,
    leaveMs: 520,
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
