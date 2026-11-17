import { Effect, EffectAttribute } from "postprocessing";
import { ShaderMaterial, Uniform, Vector2 } from "three";

/**
 * Screen space pieces of the entry. They work in "height units": the origin
 * is the middle of the screen, y is up, and the screen is 1 tall.
 *
 * Shader rules: never pow() a value that can be negative, and never call
 * smoothstep() with its edges reversed. Both are undefined, look fine in
 * software rendering, and produce invalid pixels on real GPUs.
 */

const RUSH_FRAGMENT = /* glsl */ `
uniform vec2 bufferSize;
uniform float radius, rim, streaks, clock;

const float R_PI = 3.14159265;
const float R_TAU = 6.2831853;

float rHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec3 rLinear(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }

// Grains pulled into lines that fly out from the centre, each on its own clock.
float rLines(vec2 q, float lanes, float seed, float speed, float lengthK, float density){
  float r = length(q); float a = (atan(q.y, q.x)+R_PI)/R_TAU*lanes; float lane = floor(a), across = fract(a)-0.5;
  float h = rHash(vec2(lane, seed)); if (h > density) return 0.;
  float travel = fract(rHash(vec2(lane, seed+7.)) + clock*speed*(0.5+h));   // 0 at the centre, 1 off the edge
  float r0 = 0.02+1.25*travel*travel;                                        // it speeds up on the way out
  float len = (0.02+lengthK*rHash(vec2(lane, seed+11.)))*streaks*(0.25+r0);
  float along = (r-r0)/max(len, 1e-4);
  float inside = step(0., along)*step(along, 1.);
  float m = inside*pow(clamp(1.-along, 0., 1.), 0.6)*smoothstep(0., 0.08, along);
  float arc = across*r*R_TAU/lanes; float width = 0.0006+0.0009*h;
  float fade = smoothstep(0., 0.12, travel)*(1.-smoothstep(0.8, 1., travel));
  return m*exp(-arc*arc/(width*width))*(0.25+0.9*h)*fade;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (rim + streaks <= 0.) { outputColor = inputColor; return; }

  vec2 p = (gl_FragCoord.xy-0.5*bufferSize)/bufferSize.y;
  float r = length(p);
  vec3 light = vec3(0.);
  if (streaks > 0.) {
    light += vec3(0.9)*(rLines(p, 300., 31., 0.9, 0.7, 0.5) + rLines(p, 480., 47., 1.3, 0.5, 0.45)*0.8 + rLines(p, 170., 57., 0.7, 1.0, 0.5)*1.2);
  }
  if (rim > 0.) {
    // The edge of the opening: a thin bright line with a soft glow either side.
    float d = abs(r-radius);
    float line = 0.0016+radius*0.004;
    light += (vec3(1.0)*exp(-d*d/(line*line))*1.5 + vec3(0.72)*(0.5*exp(-d/(0.008+radius*0.02))+0.12*exp(-d/(0.03+radius*0.06))))*rim;
  }
  // Never let a bad value through: the bloom would smear it across the whole frame.
  if (!(light.r >= 0. && light.g >= 0. && light.b >= 0.)) light = vec3(0.);
  outputColor = vec4(inputColor.rgb + rLinear(light), inputColor.a);
}
`;

/** What rushes past during the fall, and the bright edge of the opening at the end of it. */
export class RushEffect extends Effect {
  constructor() {
    const names = ["radius", "rim", "streaks", "clock"];
    const uniforms = new Map<string, Uniform>(names.map((name) => [name, new Uniform(0)]));
    uniforms.set("bufferSize", new Uniform(new Vector2(1, 1)));
    super("RushEffect", RUSH_FRAGMENT, { uniforms, attributes: EffectAttribute.NONE });
  }

  setBufferSize(width: number, height: number) {
    this.uniforms.get("bufferSize")!.value.set(width, height);
  }

  set(radius: number, rim: number, streaks: number, clock: number) {
    this.uniforms.get("radius")!.value = radius;
    this.uniforms.get("rim")!.value = rim;
    this.uniforms.get("streaks")!.value = streaks;
    this.uniforms.get("clock")!.value = clock;
  }
}

const FINAL_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D inputBuffer;
uniform float uAspect, uGrain, uVignette, uHole, uClock;
varying vec2 vUv;

float fHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

void main(){
  // Display space from here on: this pass writes the final pixels.
  vec3 c = pow(max(texture2D(inputBuffer, vUv).rgb, 0.), vec3(1./2.2));
  vec2 p = (vUv-0.5)*vec2(uAspect, 1.);
  c *= 1.-uVignette*smoothstep(0.30, 1.05, length(p*vec2(0.92, 1.15)));
  float g = fHash(gl_FragCoord.xy + fract(uClock)*311.7)-0.5;
  c += g*uGrain*(0.35+0.65*sqrt(max(dot(c, vec3(0.333)), 0.)));

  // The opening: a soft edged hole in the middle of the screen, so the page
  // under the canvas shows through. Just inside the edge the light is kept
  // and added on top of the page.
  float alpha = 1., keep = 1.;
  if (uHole > 0.) {
    float r = length(p);
    alpha = smoothstep(uHole*0.84, uHole*0.97, r);
    keep = max(alpha, smoothstep(uHole*0.55, uHole*0.9, r));
  }
  gl_FragColor = vec4(max(c, 0.)*keep, alpha);
}
`;

/** The last pass: vignette, grain, and the hole the site is seen through. */
export function createFinalMaterial() {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 1., 1.); }`,
    fragmentShader: FINAL_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      inputBuffer: { value: null },
      uAspect: { value: 1 },
      uGrain: { value: 0 },
      uVignette: { value: 0 },
      uHole: { value: 0 },
      uClock: { value: 0 },
    },
  });
}
