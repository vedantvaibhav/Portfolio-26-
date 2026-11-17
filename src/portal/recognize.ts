/**
 * Is this stroke a circle? Geometry only, no ML.
 *
 * A circle is fitted to the stroke. The stroke passes if it stays near that
 * circle (roundness), goes most of the way around it (sweep) and ends near
 * where it began (gap). The thresholds are generous on purpose: anything
 * remotely like a circle opens the site.
 *
 * No imports, so this file runs anywhere, including the unit tests.
 */
export type Point = { x: number; y: number };

export type Thresholds = {
  resamplePx: number;
  maxRoundness: number;
  minSweepRad: number;
  closeGapFactor: number;
  fullSweepRad: number;
  /** While the hand is still down, wait for a loop this complete. */
  liveSweepRad: number;
  /** More turns than this is a spiral, not a circle. */
  maxSweepRad: number;
  minRadiusPx: number;
};

export type Verdict =
  | { ok: true; x: number; y: number; r: number }
  /** short: a tap or a twitch, say nothing. open: a circle that stopped. shape: something else. */
  | { ok: false; reason: "short" | "open" | "shape" };

export type Measure = {
  x: number;
  y: number;
  r: number;
  /** Spread of distances from the centre, as a share of the radius. 0 is a perfect circle. */
  roundness: number;
  /** Signed angle travelled around the centre, in radians. */
  sweep: number;
  /** 1 when the stroke only ever turns one way. A zigzag or scribble is far lower. */
  steady: number;
  /** Distance between the first and last point. */
  gap: number;
  length: number;
};

/** Evenly spaced points along the stroke, so fast and slow drawing weigh the same. */
export function resample(points: Point[], step: number): Point[] {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment === 0) continue;
    let at = step - carry;
    while (at <= segment) {
      const t = at / segment;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      at += step;
    }
    carry = segment - (at - step);
  }
  return out;
}

/** Least squares circle (Kasa fit). Null when the points are on a line. */
export function fitCircle(points: Point[]): { x: number; y: number; r: number } | null {
  const n = points.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;

  let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of points) {
    const u = p.x - mx;
    const v = p.y - my;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-6 * (suu + svv) * (suu + svv) || det === 0) return null;

  const a = (suuu + suvv) / 2;
  const b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  return { x: uc + mx, y: vc + my, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
}

export function measure(points: Point[], step: number): Measure | null {
  const even = resample(points, step);
  if (even.length < 6) return null;
  const circle = fitCircle(even);
  if (!circle) return null;

  let variance = 0;
  let sweep = 0;
  let turned = 0;
  let previous = Math.atan2(even[0].y - circle.y, even[0].x - circle.x);
  for (let i = 0; i < even.length; i++) {
    const dx = even[i].x - circle.x;
    const dy = even[i].y - circle.y;
    const d = Math.hypot(dx, dy) - circle.r;
    variance += d * d;
    if (i > 0) {
      const angle = Math.atan2(dy, dx);
      let delta = angle - previous;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      sweep += delta;
      turned += Math.abs(delta);
      previous = angle;
    }
  }

  const first = even[0];
  const last = even[even.length - 1];
  return {
    ...circle,
    roundness: Math.sqrt(variance / even.length) / circle.r,
    sweep,
    steady: turned > 0 ? Math.abs(sweep) / turned : 0,
    gap: Math.hypot(first.x - last.x, first.y - last.y),
    length: (even.length - 1) * step,
  };
}

/**
 * @param live true while the hand is still down. The check is stricter then,
 * so the ring does not jump the gun on a loop that is only mostly drawn.
 */
export function judgeStroke(points: Point[], t: Thresholds, live = false): Verdict {
  const m = measure(points, t.resamplePx);
  if (!m || m.length < t.minRadiusPx * 2) return { ok: false, reason: "short" };

  const turned = Math.abs(m.sweep);
  const round = m.roundness < t.maxRoundness && m.steady > 0.8;
  const closed = m.gap < t.closeGapFactor * m.r || turned > t.fullSweepRad;
  const enough = turned >= (live ? t.liveSweepRad : t.minSweepRad);

  if (round && closed && enough && turned <= t.maxSweepRad) {
    if (m.r < t.minRadiusPx) return { ok: false, reason: "short" };
    return { ok: true, x: m.x, y: m.y, r: m.r };
  }
  // Round and well on its way, but not there: ask them to finish it.
  if (round && turned >= 2.6 && turned <= t.maxSweepRad) return { ok: false, reason: "open" };
  return { ok: false, reason: "shape" };
}

/** The ring is a little bigger than the stroke, and never smaller than a minimum. */
export function ringRadius(strokeRadius: number, shortSide: number, grow: number, minShare: number, maxShare: number) {
  return Math.min(Math.max(strokeRadius * grow, shortSide * minShare), shortSide * maxShare);
}
