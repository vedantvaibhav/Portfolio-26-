import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type Texture,
  type WebGLRenderer,
} from "three";

/**
 * A small fluid laid over the screen. The pointer pushes it, it swirls, and it
 * dies away. The grains read its speed where they sit and are carried by it.
 *
 * This is how Shopify Editions moves its particles under the pointer: nothing
 * happens while the pointer rests, and a moving pointer leaves a wake that
 * curls and fades. Nothing is pushed out of a circle.
 *
 * The method is Jos Stam's stable fluids, in the arrangement of passes made
 * common by Pavel Dobryakov's WebGL Fluid Simulation (MIT): add the push,
 * strengthen the swirls, make the flow keep its volume, carry it along itself.
 * It runs on a tiny texture, so it costs next to nothing.
 */

const VERTEX = /* glsl */ `
uniform vec2 uTexel;
varying vec2 vUv, vL, vR, vT, vB;
void main(){
  vUv = uv;
  vL = uv-vec2(uTexel.x, 0.);
  vR = uv+vec2(uTexel.x, 0.);
  vT = uv+vec2(0., uTexel.y);
  vB = uv-vec2(0., uTexel.y);
  gl_Position = vec4(position.xy, 0., 1.);
}
`;

const HEAD = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
`;

// The push: speed is added along the stroke from where the pointer was to where
// it is, falling off softly to either side. uRadius is in screen heights.
const SPLAT = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform vec2 uFrom, uTo, uPush;
uniform float uAspect, uRadius;
void main(){
  vec2 pa = (vUv-uFrom)*vec2(uAspect, 1.);
  vec2 ba = (uTo-uFrom)*vec2(uAspect, 1.);
  float h = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-6), 0., 1.);
  vec2 away = pa-ba*h;
  float fall = exp(-dot(away, away)/max(uRadius*uRadius, 1e-6));
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy+uPush*fall, 0., 1.);
}
`;

// How much the flow turns at each point.
const CURL = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float l = texture2D(uVelocity, vL).y, r = texture2D(uVelocity, vR).y;
  float t = texture2D(uVelocity, vT).x, b = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5*(r-l-t+b), 0., 0., 1.);
}
`;

// Push the flow toward where it already turns, so small swirls do not smear away.
const VORTICITY = /* glsl */ `${HEAD}
uniform sampler2D uVelocity, uCurl;
uniform float uStrength, uDt;
void main(){
  float l = texture2D(uCurl, vL).x, r = texture2D(uCurl, vR).x;
  float t = texture2D(uCurl, vT).x, b = texture2D(uCurl, vB).x;
  float c = texture2D(uCurl, vUv).x;
  vec2 force = 0.5*vec2(abs(t)-abs(b), abs(r)-abs(l));
  force /= length(force)+0.0001;
  force *= uStrength*c;
  force.y = -force.y;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy+force*uDt, 0., 1.);
}
`;

// Where the flow is bunching up or thinning out. The edges of the screen are walls.
const DIVERGENCE = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float l = texture2D(uVelocity, vL).x, r = texture2D(uVelocity, vR).x;
  float t = texture2D(uVelocity, vT).y, b = texture2D(uVelocity, vB).y;
  vec2 c = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.) l = -c.x;
  if (vR.x > 1.) r = -c.x;
  if (vT.y > 1.) t = -c.y;
  if (vB.y < 0.) b = -c.y;
  gl_FragColor = vec4(0.5*(r-l+t-b), 0., 0., 1.);
}
`;

const FADE = /* glsl */ `${HEAD}
uniform sampler2D uSource;
uniform float uKeep;
void main(){
  gl_FragColor = vec4(uKeep*texture2D(uSource, vUv).xyz, 1.);
}
`;

// One step toward the pressure that would undo the bunching.
const PRESSURE = /* glsl */ `${HEAD}
uniform sampler2D uPressure, uDivergence;
void main(){
  float l = texture2D(uPressure, vL).x, r = texture2D(uPressure, vR).x;
  float t = texture2D(uPressure, vT).x, b = texture2D(uPressure, vB).x;
  gl_FragColor = vec4((l+r+b+t-texture2D(uDivergence, vUv).x)*0.25, 0., 0., 1.);
}
`;

// Take the pressure out of the flow. What is left keeps its volume, which is what makes it curl.
const PROJECT = /* glsl */ `${HEAD}
uniform sampler2D uPressure, uVelocity;
void main(){
  float l = texture2D(uPressure, vL).x, r = texture2D(uPressure, vR).x;
  float t = texture2D(uPressure, vT).x, b = texture2D(uPressure, vB).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy-vec2(r-l, t-b), 0., 1.);
}
`;

// Carry the flow along itself, and let it die away.
const ADVECT = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform float uDt, uKeep;
void main(){
  vec2 from = vUv-uDt*texture2D(uVelocity, vUv).xy*uTexel;
  vec2 flow = uKeep*texture2D(uVelocity, from).xy;
  // Never let a bad value through: every grain reads this.
  if (!(dot(flow, flow) < 1e8)) flow = vec2(0.);
  gl_FragColor = vec4(flow, 0., 1.);
}
`;

/** Two targets that take turns: read from one, write to the other, swap. */
class Pair {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  constructor(width: number, height: number, filter: MagnificationTextureFilter) {
    const options = {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: filter,
      magFilter: filter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    };
    this.read = new WebGLRenderTarget(width, height, options);
    this.write = new WebGLRenderTarget(width, height, options);
  }
  swap() {
    [this.read, this.write] = [this.write, this.read];
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

export type FluidSettings = { curl: number; dissipation: number; pressure: number; radius: number; simSize: number };

export class Fluid {
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private texel = new Vector2(1, 1);
  private aspect = 1;
  private size = "";
  private velocity!: Pair;
  private pressure!: Pair;
  private curl!: WebGLRenderTarget;
  private divergence!: WebGLRenderTarget;
  private passes: Record<"splat" | "curl" | "vorticity" | "divergence" | "fade" | "pressure" | "project" | "advect", ShaderMaterial>;

  constructor(
    private renderer: WebGLRenderer,
    private settings: FluidSettings,
  ) {
    const pass = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader,
        uniforms: { uTexel: { value: this.texel }, ...uniforms },
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
      });
    const texture = () => ({ value: null as Texture | null });
    this.passes = {
      splat: pass(SPLAT, {
        uVelocity: texture(),
        uFrom: { value: new Vector2() },
        uTo: { value: new Vector2() },
        uPush: { value: new Vector2() },
        uAspect: { value: 1 },
        uRadius: { value: 0.1 },
      }),
      curl: pass(CURL, { uVelocity: texture() }),
      vorticity: pass(VORTICITY, { uVelocity: texture(), uCurl: texture(), uStrength: { value: 0 }, uDt: { value: 0 } }),
      divergence: pass(DIVERGENCE, { uVelocity: texture() }),
      fade: pass(FADE, { uSource: texture(), uKeep: { value: 1 } }),
      pressure: pass(PRESSURE, { uPressure: texture(), uDivergence: texture() }),
      project: pass(PROJECT, { uPressure: texture(), uVelocity: texture() }),
      advect: pass(ADVECT, { uVelocity: texture(), uDt: { value: 0 }, uKeep: { value: 1 } }),
    };
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.passes.fade);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.resize(1, 1);
  }

  /** How fast the fluid is moving at each point of the screen, in its red and green. */
  get texture() {
    return this.velocity.read.texture;
  }

  apply(settings: FluidSettings) {
    const resized = settings.simSize !== this.settings.simSize;
    this.settings = settings;
    if (resized) {
      this.size = "";
      this.resize(this.aspect, 1);
    }
  }

  /** Match the shape of the screen. The long side gets simSize cells. */
  resize(width: number, height: number) {
    this.aspect = width / height;
    const long = Math.max(16, Math.min(512, Math.round(this.settings.simSize)));
    const w = this.aspect >= 1 ? long : Math.max(2, Math.round(long * this.aspect));
    const h = this.aspect >= 1 ? Math.max(2, Math.round(long / this.aspect)) : long;
    if (`${w}x${h}` === this.size) return;
    this.size = `${w}x${h}`;
    this.disposeTargets();
    this.velocity = new Pair(w, h, LinearFilter);
    this.pressure = new Pair(w, h, NearestFilter);
    const single = { type: HalfFloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false };
    this.curl = new WebGLRenderTarget(w, h, single);
    this.divergence = new WebGLRenderTarget(w, h, single);
    this.texel.set(1 / w, 1 / h);
    this.clear();
  }

  /**
   * The pointer moved from one place to another. Both are 0 to 1 across the
   * screen, y up. pushX and pushY are how hard it shoves the fluid that way.
   */
  splat(fromX: number, fromY: number, toX: number, toY: number, pushX: number, pushY: number) {
    const u = this.passes.splat.uniforms;
    u.uVelocity.value = this.velocity.read.texture;
    u.uFrom.value.set(fromX, fromY);
    u.uTo.value.set(toX, toY);
    u.uPush.value.set(pushX, pushY);
    u.uAspect.value = this.aspect;
    u.uRadius.value = this.settings.radius;
    this.keep(() => {
      this.draw(this.passes.splat, this.velocity.write);
      this.velocity.swap();
    });
  }

  /** Move the fluid on by one frame. */
  step(dt: number) {
    const { passes: p, settings } = this;
    const time = Math.min(dt, 1 / 30);
    // The settings say how much is kept each sixtieth of a second, whatever the frame rate.
    const kept = (share: number) => Math.pow(Math.max(0, Math.min(1, share)), time * 60);
    this.keep(() => {
      p.curl.uniforms.uVelocity.value = this.velocity.read.texture;
      this.draw(p.curl, this.curl);

      p.vorticity.uniforms.uVelocity.value = this.velocity.read.texture;
      p.vorticity.uniforms.uCurl.value = this.curl.texture;
      p.vorticity.uniforms.uStrength.value = settings.curl;
      p.vorticity.uniforms.uDt.value = time;
      this.draw(p.vorticity, this.velocity.write);
      this.velocity.swap();

      p.divergence.uniforms.uVelocity.value = this.velocity.read.texture;
      this.draw(p.divergence, this.divergence);

      p.fade.uniforms.uSource.value = this.pressure.read.texture;
      p.fade.uniforms.uKeep.value = kept(settings.pressure);
      this.draw(p.fade, this.pressure.write);
      this.pressure.swap();

      p.pressure.uniforms.uDivergence.value = this.divergence.texture;
      for (let i = 0; i < 10; i++) {
        p.pressure.uniforms.uPressure.value = this.pressure.read.texture;
        this.draw(p.pressure, this.pressure.write);
        this.pressure.swap();
      }

      p.project.uniforms.uPressure.value = this.pressure.read.texture;
      p.project.uniforms.uVelocity.value = this.velocity.read.texture;
      this.draw(p.project, this.velocity.write);
      this.velocity.swap();

      p.advect.uniforms.uVelocity.value = this.velocity.read.texture;
      p.advect.uniforms.uDt.value = time;
      p.advect.uniforms.uKeep.value = kept(settings.dissipation);
      this.draw(p.advect, this.velocity.write);
      this.velocity.swap();
    });
  }

  /** Still the fluid. */
  clear() {
    this.keep(() => {
      const alpha = this.renderer.getClearAlpha();
      this.renderer.setClearAlpha(0);
      for (const target of [this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write, this.curl, this.divergence]) {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
      }
      this.renderer.setClearAlpha(alpha);
    });
  }

  dispose() {
    this.disposeTargets();
    this.quad.geometry.dispose();
    for (const material of Object.values(this.passes)) material.dispose();
  }

  private draw(material: ShaderMaterial, target: WebGLRenderTarget) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  /** Run some drawing and leave the renderer pointing where it was. */
  private keep(work: () => void) {
    const target = this.renderer.getRenderTarget();
    work();
    this.renderer.setRenderTarget(target);
  }

  private disposeTargets() {
    this.velocity?.dispose();
    this.pressure?.dispose();
    this.curl?.dispose();
    this.divergence?.dispose();
  }
}
