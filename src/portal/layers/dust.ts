import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import { NOISE, PRECISION } from "../glsl";

const VERTEX = /* glsl */ `
attribute float aSize, aIntensity;
attribute vec3 aTint;
uniform float uPixelsPerUnit, uStrength;
varying vec3 vColor;
void main(){
  vec4 view = modelViewMatrix*vec4(position, 1.);
  gl_Position = projectionMatrix*view;
  vColor = aTint*aIntensity*uStrength;
  gl_PointSize = aSize*uPixelsPerUnit/max(-view.z, 0.1);
}
`;

const FRAGMENT = /* glsl */ `
${PRECISION}
varying vec3 vColor;
${NOISE}
void main(){
  float d = length(gl_PointCoord*2.-1.);
  gl_FragColor = vec4(toLinear(vColor*smoothstep(1., 0.55, d)), 1.);
}
`;

const COUNT = 7;
const NEAR = 6;
const FAR = 16;

/**
 * A few specks of dust close to the camera, far out of focus. They drift
 * across the frame and wrap around. Because they are near, they move the most
 * when the camera leans, which is what sells the depth.
 */
export class Dust {
  readonly points: Points;
  private material: ShaderMaterial;
  private position: Float32Array;
  private velocity: Float32Array;
  private halfWidth = 1;
  private halfHeight = 1;

  constructor() {
    this.position = new Float32Array(COUNT * 3);
    this.velocity = new Float32Array(COUNT * 2);
    const tint = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const intensity = new Float32Array(COUNT);

    // Fixed values, so the frame is composed and not left to chance.
    for (let i = 0; i < COUNT; i++) {
      const a = (i * 0.618) % 1;
      const b = (i * 0.381 + 0.27) % 1;
      this.position[i * 3 + 2] = -(NEAR + (FAR - NEAR) * ((i * 0.73) % 1));
      this.velocity[i * 2] = 0.05 + 0.07 * b;
      this.velocity[i * 2 + 1] = 0.015 * (a - 0.5);
      size[i] = 0.12 + 0.34 * ((i * 0.47) % 1);
      intensity[i] = 0.008 + 0.014 * ((i * 0.29) % 1);
      const warm = i % 3 === 0 ? 1 : 0;
      tint.set(warm ? [0.9, 0.7, 0.5] : [0.35, 0.42, 0.7], i * 3);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.position, 3));
    geometry.setAttribute("aTint", new BufferAttribute(tint, 3));
    geometry.setAttribute("aSize", new BufferAttribute(size, 1));
    geometry.setAttribute("aIntensity", new BufferAttribute(intensity, 1));

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      uniforms: { uPixelsPerUnit: { value: 1 }, uStrength: { value: 1 } },
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  /** halfWidth and halfHeight of the view at one unit of depth. */
  resize(halfWidth: number, halfHeight: number, heightPx: number, pixelRatio: number) {
    // Positions are stored as fractions of the view at their own depth.
    this.halfWidth = halfWidth * 1.25;
    this.halfHeight = halfHeight * 1.25;
    this.material.uniforms.uPixelsPerUnit.value = ((heightPx * pixelRatio) / (2 * halfHeight)) * 2;
    this.layout(0);
  }

  setStrength(strength: number) {
    this.material.uniforms.uStrength.value = strength;
  }

  update(dt: number) {
    this.layout(dt);
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }

  private fraction = new Float32Array(COUNT * 2).map((_, i) => {
    const k = Math.floor(i / 2);
    return i % 2 === 0 ? ((k * 0.618) % 1) * 2 - 1 : ((k * 0.381 + 0.27) % 1) * 2 - 1;
  });

  private layout(dt: number) {
    for (let i = 0; i < COUNT; i++) {
      let fx = this.fraction[i * 2] + this.velocity[i * 2] * dt * 0.1;
      let fy = this.fraction[i * 2 + 1] + this.velocity[i * 2 + 1] * dt * 0.1;
      if (fx > 1) fx -= 2;
      if (fy > 1) fy -= 2;
      if (fy < -1) fy += 2;
      this.fraction[i * 2] = fx;
      this.fraction[i * 2 + 1] = fy;
      const depth = -this.position[i * 3 + 2];
      this.position[i * 3] = fx * this.halfWidth * depth;
      this.position[i * 3 + 1] = fy * this.halfHeight * depth;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
