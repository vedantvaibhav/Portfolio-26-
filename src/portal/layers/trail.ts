import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  Points,
  ShaderMaterial,
  Vector2,
} from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION } from "../glsl";
import type { Point } from "../recognize";

/** Points in the drawn ribbon. The stroke is resampled to fit. */
const MAX_POINTS = 600;
/** Raw pointer samples kept for the circle check. */
const MAX_SAMPLES = 4000;
/** Spacing of the ribbon's points, in px. Even spacing keeps its edges clean. */
const SPACING = 5;
/** The ribbon is this many core widths wide on each side, to carry the glow. */
const HALO = 14;

const RIBBON_VERTEX = /* glsl */ `
attribute float aSide, aAlong, aSpeed;
uniform vec2 uRes;
varying float vSide, vAlong, vSpeed;
void main(){
  vSide = aSide; vAlong = aAlong; vSpeed = aSpeed;
  gl_Position = vec4(position.x/uRes.x*2.-1., 1.-position.y/uRes.y*2., 0., 1.);
}
`;

const RIBBON_FRAGMENT = /* glsl */ `
${PRECISION}
varying float vSide, vAlong, vSpeed;
uniform float uAlpha, uStall;
${NOISE}
void main(){
  float x = abs(vSide)*${HALO.toFixed(1)};               // distance from the centre line, in core widths
  vec3 col = vec3(1.0)*exp(-x*x)*(0.9+0.9*vSpeed);   // faster is brighter
  col += vec3(0.72)*(0.62*exp(-x/3.5)+0.24*exp(-x/9.))*(1.-smoothstep(0.35, 1., abs(vSide)));
  col *= (0.55+0.45*smoothstep(0., 0.4, vAlong))*smoothstep(0., 0.03, vAlong);   // the start of the stroke sits back, and tapers in
  col *= smoothstep(uStall, uStall+0.35, vAlong);           // the tail fades when the hand stops
  gl_FragColor = vec4(toLinear(col)*uAlpha, 1.);
}
`;

const HEAD_VERTEX = /* glsl */ `
uniform vec2 uRes;
uniform float uPixelRatio;
void main(){
  gl_Position = vec4(position.x/uRes.x*2.-1., 1.-position.y/uRes.y*2., 0., 1.);
  gl_PointSize = 56.*uPixelRatio;
}
`;

const HEAD_FRAGMENT = /* glsl */ `
${PRECISION}
uniform float uAlpha;
${NOISE}
void main(){
  float d = length(gl_PointCoord*2.-1.);
  vec3 col = vec3(1.0, 0.97, 0.94)*exp(-d*d*90.)*1.6 + vec3(0.7)*0.4*exp(-d*5.)*(1.-smoothstep(0.6, 1., d));
  gl_FragColor = vec4(toLinear(col)*uAlpha, 1.);
}
`;

type Sample = Point & { speed: number };

/**
 * The light the pointer leaves behind. A ribbon in screen space, rebuilt each
 * frame from the stroke. Drawn brighter than white so the bloom picks it up.
 * Positions are CSS pixels from the top left of the canvas.
 */
export class Trail {
  readonly ribbon: Mesh;
  readonly head: Points;

  private samples: Sample[] = [];
  private lastTime = 0;
  private stall = -0.35;
  private stillFor = 0;
  private material: ShaderMaterial;
  private headMaterial: ShaderMaterial;
  private positions = new Float32Array(MAX_POINTS * 2 * 3);
  private side = new Float32Array(MAX_POINTS * 2);
  private along = new Float32Array(MAX_POINTS * 2);
  private speed = new Float32Array(MAX_POINTS * 2);
  private headPosition = new Float32Array(3);
  private scratch: Sample[] = [];
  private coreSlow = 3.2;
  private coreFast = 1.5;
  private fastSpeed = 1.6;

  /** Set during the snap: the stroke is pulled onto this circle. */
  morphTo: { x: number; y: number; r: number } | null = null;
  morph = 0;

  constructor() {
    const res = { value: new Vector2(1, 1) };
    const geometry = new BufferGeometry();
    for (const [name, array, size] of [
      ["position", this.positions, 3],
      ["aSide", this.side, 1],
      ["aAlong", this.along, 1],
      ["aSpeed", this.speed, 1],
    ] as const) {
      const attribute = new BufferAttribute(array, size);
      attribute.setUsage(DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
    }
    const index = new Uint16Array((MAX_POINTS - 1) * 6);
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      index.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
    }
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.setDrawRange(0, 0);

    // Double sided: the ribbon's winding flips with the direction of the stroke.
    const shared = { blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: DoubleSide };
    this.material = new ShaderMaterial({
      ...shared,
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      uniforms: { uRes: res, uAlpha: { value: 1 }, uStall: { value: -0.35 } },
    });
    this.ribbon = new Mesh(geometry, this.material);
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 20;

    const headGeometry = new BufferGeometry();
    headGeometry.setAttribute("position", new BufferAttribute(this.headPosition, 3));
    this.headMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: HEAD_VERTEX,
      fragmentShader: HEAD_FRAGMENT,
      uniforms: { uRes: res, uPixelRatio: { value: 1 }, uAlpha: { value: 0 } },
    });
    this.head = new Points(headGeometry, this.headMaterial);
    this.head.frustumCulled = false;
    this.head.renderOrder = 21;
  }

  get points(): Point[] {
    return this.samples;
  }

  apply(config: PortalConfig) {
    this.coreSlow = config.trail.coreSlowPx;
    this.coreFast = config.trail.coreFastPx;
    this.fastSpeed = config.trail.fastSpeed;
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.material.uniforms.uRes.value.set(width, height);
    this.headMaterial.uniforms.uPixelRatio.value = pixelRatio;
  }

  begin(x: number, y: number, time: number) {
    this.samples = [{ x, y, speed: 0 }];
    this.lastTime = time;
    this.stall = -0.35;
    this.stillFor = 0;
    this.morphTo = null;
    this.morph = 0;
  }

  /** Returns true if the point was far enough from the last one to keep. */
  add(x: number, y: number, time: number) {
    const last = this.samples[this.samples.length - 1];
    if (!last || this.samples.length >= MAX_SAMPLES) return false;
    const distance = Math.hypot(x - last.x, y - last.y);
    if (distance < 2) return false;
    const elapsed = Math.max(time - this.lastTime, 1);
    // Ease the speed so the width does not flicker between pointer events.
    const speed = last.speed + (Math.min(distance / elapsed / this.fastSpeed, 1) - last.speed) * 0.35;
    this.samples.push({ x, y, speed });
    this.lastTime = time;
    this.stillFor = 0;
    this.stall = -0.35;
    return true;
  }

  clear() {
    this.samples = [];
    this.ribbon.geometry.setDrawRange(0, 0);
    this.headMaterial.uniforms.uAlpha.value = 0;
  }

  /** alpha fades the whole stroke. showHead is true only while the hand is down. */
  update(dt: number, alpha: number, showHead: boolean) {
    const count = this.samples.length;
    this.material.uniforms.uAlpha.value = alpha;
    this.headMaterial.uniforms.uAlpha.value = showHead && count > 0 ? alpha : 0;
    if (count < 2) {
      this.ribbon.geometry.setDrawRange(0, 0);
      if (count === 1) this.headPosition.set([this.samples[0].x, this.samples[0].y, 0]);
      this.head.geometry.attributes.position.needsUpdate = true;
      return;
    }

    // A hand that stops lets the tail fade toward the head.
    if (showHead) {
      this.stillFor += dt;
      if (this.stillFor > 0.3) this.stall = Math.min(this.stall + dt * 0.35, 0.8);
    }
    this.material.uniforms.uStall.value = this.stall;

    const path = this.smoothed();
    const points = path.length;
    for (let i = 0; i < points; i++) {
      const p = path[i];
      // A wide baseline for the normal, so the glow's edges do not jitter.
      const before = path[Math.max(i - 2, 0)];
      const after = path[Math.min(i + 2, points - 1)];
      let nx = -(after.y - before.y);
      let ny = after.x - before.x;
      const length = Math.hypot(nx, ny) || 1;
      const core = this.coreSlow + (this.coreFast - this.coreSlow) * p.speed;
      const half = core * HALO;
      nx = (nx / length) * half;
      ny = (ny / length) * half;

      this.positions.set([p.x + nx, p.y + ny, 0, p.x - nx, p.y - ny, 0], i * 6);
      this.side.set([1, -1], i * 2);
      this.along.fill(i / (points - 1), i * 2, i * 2 + 2);
      this.speed.fill(p.speed, i * 2, i * 2 + 2);
    }

    const geometry = this.ribbon.geometry;
    for (const name of ["position", "aSide", "aAlong", "aSpeed"]) geometry.attributes[name].needsUpdate = true;
    geometry.setDrawRange(0, (points - 1) * 6);

    const tip = path[points - 1];
    this.headPosition.set([tip.x, tip.y, 0]);
    this.head.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.ribbon.geometry.dispose();
    this.head.geometry.dispose();
    this.material.dispose();
    this.headMaterial.dispose();
  }

  /** Pointer input is jagged and unevenly spaced. Space it evenly, blur it lightly, then pull it toward the snapped circle. */
  private smoothed() {
    const source = this.samples;
    const out = this.scratch;
    out.length = 0;
    out.push({ ...source[0] });

    let total = 0;
    for (let i = 1; i < source.length; i++) total += Math.hypot(source[i].x - source[i - 1].x, source[i].y - source[i - 1].y);
    const step = Math.max(SPACING, total / (MAX_POINTS - 2));

    let carry = 0;
    for (let i = 1; i < source.length && out.length < MAX_POINTS - 1; i++) {
      const a = source[i - 1];
      const b = source[i];
      const segment = Math.hypot(b.x - a.x, b.y - a.y);
      if (segment === 0) continue;
      let at = step - carry;
      while (at <= segment && out.length < MAX_POINTS - 1) {
        const k = at / segment;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, speed: a.speed + (b.speed - a.speed) * k });
        at += step;
      }
      carry = segment - (at - step);
    }
    // End exactly under the pointer.
    const tip = source[source.length - 1];
    const end = out[out.length - 1];
    if (Math.hypot(tip.x - end.x, tip.y - end.y) > 0.5) out.push({ ...tip });

    const count = out.length;
    for (let pass = 0; pass < 3; pass++) {
      let px = out[0].x;
      let py = out[0].y;
      for (let i = 1; i < count - 1; i++) {
        const x = out[i].x;
        const y = out[i].y;
        out[i].x = px * 0.25 + x * 0.5 + out[i + 1].x * 0.25;
        out[i].y = py * 0.25 + y * 0.5 + out[i + 1].y * 0.25;
        px = x;
        py = y;
      }
    }
    const target = this.morphTo;
    if (target && this.morph > 0) {
      for (const p of out) {
        const dx = p.x - target.x;
        const dy = p.y - target.y;
        const d = Math.hypot(dx, dy) || 1;
        p.x += (target.x + (dx / d) * target.r - p.x) * this.morph;
        p.y += (target.y + (dy / d) * target.r - p.y) * this.morph;
      }
    }
    return out;
  }
}
