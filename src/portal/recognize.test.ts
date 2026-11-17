import { describe, expect, it } from "vitest";
import { portalConfig } from "./config";
import { judgeStroke, ringRadius, type Point } from "./recognize";

const t = portalConfig.recognition;

/** Deterministic wobble, so every run tests the same strokes. */
function wobble(i: number, seed: number) {
  return Math.sin(i * 0.37 + seed) * 0.6 + Math.sin(i * 1.13 + seed * 2.1) * 0.4;
}

type Arc = { r?: number; sweep?: number; clockwise?: boolean; squash?: number; noise?: number; grow?: number; start?: number };

/** A hand drawn arc. sweep in degrees, squash is height over width, grow turns it into a spiral. */
function arc({ r = 120, sweep = 360, clockwise = false, squash = 1, noise = 0, grow = 0, start = 0.4 }: Arc = {}): Point[] {
  const points: Point[] = [];
  const steps = Math.max(24, Math.round(sweep / 3));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const angle = start + (clockwise ? -1 : 1) * k * (sweep * Math.PI) / 180;
    const radius = r * (1 + grow * k) * (1 + noise * wobble(i, 3));
    points.push({ x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius * squash });
  }
  return points;
}

function polyline(corners: [number, number][], perSide = 20): Point[] {
  const points: Point[] = [];
  for (let s = 0; s < corners.length - 1; s++) {
    for (let i = 0; i < perSide; i++) {
      const k = i / perSide;
      points.push({
        x: corners[s][0] + (corners[s + 1][0] - corners[s][0]) * k + wobble(i, s),
        y: corners[s][1] + (corners[s + 1][1] - corners[s][1]) * k + wobble(i, s + 5),
      });
    }
  }
  return points;
}

describe("strokes that open the site", () => {
  const passing: [string, Point[]][] = [
    ["a clean circle", arc()],
    ["a clockwise circle", arc({ clockwise: true })],
    ["a wobbly circle", arc({ noise: 0.08 })],
    ["a very wobbly circle", arc({ noise: 0.16 })],
    ["an oval", arc({ squash: 0.65 })],
    ["a tall oval", arc({ squash: 1.6 })],
    ["a circle that overshoots", arc({ sweep: 430 })],
    ["a circle that stops a little short", arc({ sweep: 305 })],
    ["a loop that drifts outward", arc({ sweep: 380, grow: 0.25 })],
    ["a small circle", arc({ r: 22 })],
    ["a huge circle", arc({ r: 380 })],
    ["a rounded square", polyline([[300, 200], [500, 205], [505, 400], [305, 395], [298, 210]])],
  ];
  for (const [name, stroke] of passing) {
    it(name, () => expect(judgeStroke(stroke, t)).toMatchObject({ ok: true }));
  }

  it("finds the centre and radius of what was drawn", () => {
    const verdict = judgeStroke(arc({ r: 150, noise: 0.05 }), t);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.x).toBeCloseTo(400, -1);
    expect(verdict.y).toBeCloseTo(300, -1);
    expect(verdict.r).toBeGreaterThan(140);
    expect(verdict.r).toBeLessThan(160);
  });
});

describe("strokes that ask for more", () => {
  const cases: [string, Point[], "open" | "shape" | "short"][] = [
    ["a C", arc({ sweep: 240 }), "open"],
    ["half a circle", arc({ sweep: 180 }), "open"],
    ["a straight line", polyline([[100, 300], [700, 310]], 40), "shape"],
    ["a zigzag", polyline([[230, 150], [560, 170], [250, 420], [590, 400]]), "shape"],
    ["a scribble", polyline([[300, 300], [500, 280], [320, 330], [520, 310], [300, 350], [510, 340]]), "shape"],
    ["a shallow curve", arc({ r: 900, sweep: 30 }), "shape"],
    ["a spiral", arc({ sweep: 1080, grow: 1.5, r: 60 }), "shape"],
    ["a tap", [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }], "short"],
    ["a twitch", arc({ r: 5 }), "short"],
  ];
  for (const [name, stroke, reason] of cases) {
    it(`${name} is "${reason}"`, () => expect(judgeStroke(stroke, t)).toEqual({ ok: false, reason }));
  }
});

describe("while the hand is still down", () => {
  it("waits on a loop that is only mostly drawn", () => {
    expect(judgeStroke(arc({ sweep: 300 }), t, true).ok).toBe(false);
  });
  it("fires the moment the loop closes", () => {
    expect(judgeStroke(arc({ sweep: 345 }), t, true).ok).toBe(true);
  });
});

describe("the ring", () => {
  it("is 15% bigger than the stroke", () => {
    expect(ringRadius(200, 900, 1.15, 0.09, 0.46)).toBeCloseTo(230);
  });
  it("grows a small circle to the minimum", () => {
    expect(ringRadius(20, 900, 1.15, 0.09, 0.46)).toBeCloseTo(81);
  });
  it("does not outgrow the screen", () => {
    expect(ringRadius(600, 900, 1.15, 0.09, 0.46)).toBeCloseTo(414);
  });
});
