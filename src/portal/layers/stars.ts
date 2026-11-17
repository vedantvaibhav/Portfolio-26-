import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION } from "../glsl";

const VERTEX = /* glsl */ `
attribute float aSize, aIntensity, aPhase;
attribute vec3 aTint;
uniform float uTime, uPixelRatio, uScale, uTwinkle;
varying vec3 vColor;
void main(){
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.);
  float twinkle = 1. - uTwinkle*(0.5+0.5*sin(uTime*(0.5+aPhase*0.9)+aPhase*6.2831));
  vColor = aTint*aIntensity*twinkle;
  gl_PointSize = max(aSize*uScale, 1.5)*uPixelRatio;
}
`;

const FRAGMENT = /* glsl */ `
${PRECISION}
varying vec3 vColor;
${NOISE}
void main(){
  vec2 c = gl_PointCoord*2.-1.;
  gl_FragColor = vec4(toLinear(vColor*exp(-dot(c, c)*6.)), 1.);
}
`;

/** Depth, share of the stars, base size in px, and brightness for each layer. */
const LAYERS = [
  { depth: 110, share: 0.1, size: 6.0, gain: 0.95 },
  { depth: 190, share: 0.4, size: 4.2, gain: 0.5 },
  { depth: 300, share: 0.5, size: 3.4, gain: 0.32 },
];

/** Deterministic random, so the sky is the same on every visit. */
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Three depths of stars in one draw call. Most are faint; a few are bright.
 * They are spread across a slab wider than any screen, so the count in view
 * depends on the aspect ratio. `stars.count` is the number in a 16:9 view.
 */
export class Stars {
  readonly points: Points;
  private material: ShaderMaterial;
  private builtCount = -1;
  private builtFov = -1;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uScale: { value: 1 },
        uTwinkle: { value: 0 },
      },
    });
    this.points = new Points(new BufferGeometry(), this.material);
    this.points.frustumCulled = false;
  }

  apply(config: PortalConfig) {
    this.material.uniforms.uTwinkle.value = config.stars.twinkle;
    if (config.stars.count !== this.builtCount || config.camera.fov !== this.builtFov) {
      this.build(config.stars.count, config.camera.fov);
    }
  }

  resize(height: number, pixelRatio: number) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uScale.value = Math.min(1.6, Math.max(0.8, height / 900));
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }

  private build(countIn16by9: number, fov: number) {
    // The slab covers a 2.4:1 view with a margin for camera movement.
    const maxAspect = 2.4;
    const margin = 1.2;
    const total = Math.round(countIn16by9 * (maxAspect / (16 / 9)) * margin * margin);
    const random = mulberry(20260);
    const tan = Math.tan((fov * Math.PI) / 360);

    const position = new Float32Array(total * 3);
    const tint = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const intensity = new Float32Array(total);
    const phase = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      const pick = random();
      const layer = pick < LAYERS[0].share ? LAYERS[0] : pick < LAYERS[0].share + LAYERS[1].share ? LAYERS[1] : LAYERS[2];
      const depth = layer.depth * (0.85 + random() * 0.3);
      const halfHeight = depth * tan * margin;
      position[i * 3] = (random() * 2 - 1) * halfHeight * maxAspect;
      position[i * 3 + 1] = (random() * 2 - 1) * halfHeight;
      position[i * 3 + 2] = -depth;

      const bright = Math.pow(random(), 5);
      size[i] = layer.size * (0.7 + 1.6 * bright);
      intensity[i] = layer.gain * (0.22 + 1.9 * bright);
      phase[i] = random();

      // Mostly cool white, some warm.
      const warm = Math.min(1, Math.max(0, (random() - 0.55) / 0.45));
      tint[i * 3] = 0.72 + 0.28 * warm;
      tint[i * 3 + 1] = 0.82 + 0.08 * warm;
      tint[i * 3 + 2] = 1.0 - 0.22 * warm;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aTint", new BufferAttribute(tint, 3));
    geometry.setAttribute("aSize", new BufferAttribute(size, 1));
    geometry.setAttribute("aIntensity", new BufferAttribute(intensity, 1));
    geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));

    this.points.geometry.dispose();
    this.points.geometry = geometry;
    this.builtCount = countIn16by9;
    this.builtFov = fov;
  }
}
