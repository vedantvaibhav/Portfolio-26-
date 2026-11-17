import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
} from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION } from "../glsl";

const VERTEX = /* glsl */ `
attribute float aPhase, aGamma, aTheta, aLift, aSize, aSeed, aTrack;
uniform float uClock, uSpan, uInner, uSwirl, uWell, uPixelsPerUnit, uPixelRatio, uBrightAngle, uGain, uFade;
varying float vLight;
void main(){
  // Each grain falls inward along its own spiral. "fall" is how far out it is,
  // in log radius: 0 at the edge of the hole, uSpan at the rim of the disc.
  // The phase runs evenly from 1 (the rim) to 0 (the hole) and wraps. Bending it
  // with a power sets where grains gather, and makes them plunge at the end.
  float k = fract(aPhase - uClock*(0.7+0.6*aSeed));
  float fall = uSpan*pow(k, aGamma);
  float r = uInner*exp(fall);
  float close = exp(-1.5*fall);                       // 1 at the hole, near 0 far out
  float theta = aTheta + uSwirl*close;                // it winds tighter as it gets close
  float sheet = r*(aLift + 0.016*sin(theta*3.+fall*4.));   // a thin sheet with long slow waves
  float well = uWell*uInner*close*close;              // and the sheet bends down into the hole
  vec4 view = modelViewMatrix*vec4(r*cos(theta), sheet-well, r*sin(theta), 1.);
  gl_Position = projectionMatrix*view;

  float distance = max(-view.z, 0.01);
  float size = aSize*uPixelsPerUnit/distance;
  float smallest = 1.3*uPixelRatio;
  float shrink = 1.;
  if (size < smallest) { shrink = (size/smallest)*(size/smallest); size = smallest; }   // too small to draw: dim it instead
  gl_PointSize = min(size, 22.*uPixelRatio);

  float ends = smoothstep(0., 0.02, k)*smoothstep(1., 0.9, k);       // fade in at the rim, out at the hole
  float side = 0.28+0.72*pow(0.5+0.5*cos(theta-uBrightAngle), 1.6);  // one side of the disc burns brighter
  float inward = 0.32+1.5*pow(uInner/r, 1.5);                        // white hot at the edge of the hole
  float spark = 0.45+1.55*pow(aSeed, 4.);                            // a few grains are much brighter
  float tooNear = smoothstep(2.5, 10., distance);
  vLight = uGain*ends*side*inward*aTrack*spark*shrink*tooNear*uFade;
}
`;

const FRAGMENT = /* glsl */ `
${PRECISION}
varying float vLight;
${NOISE}
void main(){
  vec2 c = gl_PointCoord*2.-1.;
  gl_FragColor = vec4(toLinear(vec3(vLight*exp(-dot(c, c)*5.))), 1.);
}
`;

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The wormhole: a wide, thin disc of white grains turning around a black
 * hole and falling slowly into it. One draw call. Every grain's path is a
 * fixed spiral, computed in the vertex shader from one clock, so the motion
 * costs nothing on the CPU and never drifts out of shape.
 *
 * Many grains share a spiral ("track"), which is what draws the flow lines.
 */
export class Wormhole {
  /** Add this to the scene. Its origin is the throat of the hole. */
  readonly group = new Group();
  private points: Points;
  private throat: Mesh;
  private material: ShaderMaterial;
  private clock = 0;
  private built = "";

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      uniforms: {
        uClock: { value: 0 },
        uSpan: { value: 1 },
        uInner: { value: 1 },
        uSwirl: { value: 0 },
        uWell: { value: 0 },
        uPixelsPerUnit: { value: 1 },
        uPixelRatio: { value: 1 },
        uBrightAngle: { value: 0 },
        uGain: { value: 1 },
        uFade: { value: 1 },
      },
    });
    this.points = new Points(new BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;

    // A black disc across the throat, so no stars show through the hole.
    this.throat = new Mesh(
      new CircleGeometry(1, 96),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, depthTest: false, depthWrite: false }),
    );
    this.throat.rotation.x = -Math.PI / 2;
    this.throat.renderOrder = 1;

    this.group.rotation.order = "ZXY";
    this.group.add(this.throat, this.points);
  }

  apply(config: PortalConfig, coarse: boolean) {
    const w = config.wormhole;
    const u = this.material.uniforms;
    u.uSpan.value = Math.log(w.outerRadius / w.innerRadius);
    u.uInner.value = w.innerRadius;
    u.uSwirl.value = w.swirl;
    u.uWell.value = w.well;
    u.uBrightAngle.value = (w.brightAngle * Math.PI) / 180;
    u.uGain.value = w.gain;
    this.group.rotation.set((w.elevation * Math.PI) / 180, 0, (w.roll * Math.PI) / 180);
    // The sheet starts this far above the throat and bends down to it.
    this.points.position.y = w.well * w.innerRadius;
    this.throat.scale.setScalar(w.innerRadius * 0.985);

    // Phones get half the grains. The picture is the same, only less dense.
    const count = Math.round(coarse ? w.grains / 2 : w.grains);
    const key = `${count}:${w.grainSize}`;
    if (key !== this.built) this.build(count, w.grainSize);
    this.built = key;
  }

  /** Where the hole sits, and how big a world unit is on screen. */
  place(x: number, y: number, z: number, pixelsPerUnit: number, pixelRatio: number) {
    this.group.position.set(x, y, z);
    this.material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  /** speed is the share of the journey from rim to hole covered per second. */
  update(dt: number, speed: number, fade: number) {
    this.clock += dt * speed;
    this.material.uniforms.uClock.value = this.clock;
    this.material.uniforms.uFade.value = fade;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    this.throat.geometry.dispose();
    (this.throat.material as MeshBasicMaterial).dispose();
  }

  private build(count: number, grainSize: number) {
    const random = mulberry(8128);
    const gauss = () => (random() + random() + random() + random() - 2) * 0.87;
    const tracks = 190;
    const trackLight = Array.from({ length: tracks }, () => 0.22 + 0.95 * Math.pow(random(), 2.2));

    const phase = new Float32Array(count);
    const gamma = new Float32Array(count);
    const theta = new Float32Array(count);
    const lift = new Float32Array(count);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    const track = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      phase[i] = random();
      // Most grains spread across the disc. The rest crowd toward the hole and make the bright band around it.
      gamma[i] = random() < 0.38 ? 1.7 : 0.62;
      if (random() < 0.8) {
        const t = Math.floor(random() * tracks);
        theta[i] = ((t + gauss() * 0.1) / tracks) * Math.PI * 2;
        track[i] = trackLight[t];
      } else {
        theta[i] = random() * Math.PI * 2;
        track[i] = 0.5;
      }
      lift[i] = gauss() * 0.006;
      seed[i] = random();
      size[i] = grainSize * (0.6 + 1.1 * Math.pow(random(), 3));
    }

    const geometry = new BufferGeometry();
    // Positions are made in the shader. Three still wants a position attribute to know the count.
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));
    geometry.setAttribute("aGamma", new BufferAttribute(gamma, 1));
    geometry.setAttribute("aTheta", new BufferAttribute(theta, 1));
    geometry.setAttribute("aLift", new BufferAttribute(lift, 1));
    geometry.setAttribute("aSize", new BufferAttribute(size, 1));
    geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
    geometry.setAttribute("aTrack", new BufferAttribute(track, 1));
    this.points.geometry.dispose();
    this.points.geometry = geometry;
  }
}
