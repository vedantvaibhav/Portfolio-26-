import { Effect, EffectAttribute } from "postprocessing";
import { ShaderMaterial, Uniform, Vector2 } from "three";

/**
 * Screen space pieces of the ritual. All of them work in "height units":
 * the origin is the middle of the screen, y is up, and the screen is 1 tall.
 * A ring centre or radius is given in those units.
 */

const LENS_FRAGMENT = /* glsl */ `
uniform vec2 center;
uniform float radius;
uniform float strength;

void mainUv(inout vec2 uv) {
  if (strength > 0.) {
    vec2 scale = vec2(aspect, 1.);
    vec2 q = (uv-0.5)*scale - center;
    float r = length(q);
    float inside = (1.-smoothstep(radius*0.8, radius*1.25, r));
    float off = (r-radius)/(0.24*radius);
    float rim = exp(-off*off);
    q *= 1. - strength*(0.30*inside + 0.46*rim);
    uv = (q + center)/scale + 0.5;
  }
}
`;

/** Bends the space around the ring, like light near something heavy. */
export class LensEffect extends Effect {
  constructor() {
    super("LensEffect", LENS_FRAGMENT, {
      uniforms: new Map<string, Uniform>([
        ["center", new Uniform(new Vector2())],
        ["radius", new Uniform(0.2)],
        ["strength", new Uniform(0)],
      ]),
    });
  }

  set(x: number, y: number, radius: number, strength: number) {
    this.uniforms.get("center")!.value.set(x, y);
    this.uniforms.get("radius")!.value = radius;
    this.uniforms.get("strength")!.value = strength;
  }
}

const LIGHT_FRAGMENT = /* glsl */ `
uniform vec2 bufferSize;
uniform vec2 center;
uniform float radius, ringI, ringW, ringSplit, thin, guide, guideRadius, pull, warp, swell, lens, clock;

const float L_PI = 3.14159265;
const float L_TAU = 6.2831853;

float lh21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float lnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(lh21(i),lh21(i+vec2(1,0)),f.x), mix(lh21(i+vec2(0,1)),lh21(i+vec2(1,1)),f.x), f.y); }
float lfbm(vec2 p){ float a=.5, s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ s+=a*lnoise(p); p=m*p; a*=.5; } return s; }
vec3 lLinear(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }

vec3 lBump(vec3 x, vec3 y){ return clamp(vec3(1.)-x*x-y, 0., 1.); }
// Visible spectrum, 0 violet to 1 red.
vec3 lSpectrum(float x){
  const vec3 c1=vec3(3.54585104,2.93225262,2.41593945), x1=vec3(0.69549072,0.49228336,0.27699880), y1=vec3(0.02312639,0.15225084,0.52607955);
  const vec3 c2=vec3(3.90307140,3.21182957,3.96587128), x2=vec3(0.11748627,0.86755042,0.66077860), y2=vec3(0.84897130,0.88445281,0.73949448);
  return lBump(c1*(x-x1),y1)+lBump(c2*(x-x2),y2);
}

// The ring: a soft band of spectrum, red outside, violet inside.
vec3 lRing(vec2 q){
  float r = length(q); vec2 dir = q/max(r, 1e-5); float angle = atan(q.y, q.x);
  float n1 = lfbm(dir*1.3+clock*0.05+3.), n2 = lfbm(dir*1.7-clock*0.04+9.);
  float R = radius*(1.+0.014*(n1-0.5));
  float w = radius*ringW*(0.86+0.28*n2);                  // the width breathes
  float x = (r-R)/w;
  float film = 0.15*sin(angle*2.+clock*0.6+n1*4.)+0.10*(n2-0.5);   // colour slides around the ring
  vec3 hue = lSpectrum(clamp(0.5+0.36*x+film, 0., 1.));
  hue = mix(hue, vec3(dot(hue, vec3(0.333))), 0.22);       // soft, not neon
  hue.b += 0.35*(1.-smoothstep(-1.2, 0.2, x));                  // lift the violet edge, which the eye reads as dark
  vec3 col = hue*exp(-x*x*0.9)*1.05;
  col += vec3(1.0, 0.97, 0.92)*exp(-x*x*14.)*0.55;         // a pale hot core
  vec3 tint = mix(vec3(0.42, 0.55, 1.0), vec3(1.0, 0.56, 0.42), smoothstep(-2.5, 2.5, x));
  col += tint*(0.22*exp(-abs(x)/2.4)+0.07*exp(-abs(x)/7.));
  return col;
}

// Dust drawn toward the ring on a slight spiral. Specks, a few with tails.
vec3 lDust(vec2 q){
  float r = length(q);
  float near = radius*1.04, far = radius*3.4;
  if (r < near*0.9 || r > far*1.05) return vec3(0.);
  float lanes = 72.;
  float a = (atan(q.y, q.x)+L_PI)/L_TAU*lanes;
  vec3 acc = vec3(0.);
  for (int j=-1; j<=1; j++) for (int k=0; k<2; k++) {
    float lane = mod(floor(a)+float(j), lanes);
    vec2 id = vec2(lane, float(k));
    float h = lh21(id+1.7), h2 = lh21(id+23.1), h3 = lh21(id+57.3);
    if (h3 > 0.62) continue;
    float u = fract(h + clock*(0.16+0.22*h2)*pull);        // 0 far out, 1 at the ring
    float fall = u*u;                                      // it speeds up as it gets close
    float pr = mix(far, near, fall);
    float pa = (lane+0.5+0.7*(h2-0.5))/lanes*L_TAU - L_PI + (0.5+0.8*h)*fall;   // the swirl
    vec2 pos = pr*vec2(cos(pa), sin(pa));
    vec2 inward = -normalize(pos);
    vec2 heading = normalize(inward + vec2(-inward.y, inward.x)*0.45);
    float tail = (0.002+0.05*h3*h3)*u*radius*5.;
    vec2 d = q-pos;
    float t = clamp(dot(d, -heading)/max(tail, 1e-4), 0., 1.);
    float dist = length(d+heading*tail*t);
    float size = (0.0006+0.0013*h2*h2)*(1.-0.6*t);
    float life = smoothstep(0., 0.12, u)*(1.-smoothstep(0.9, 1., u));
    acc += vec3(0.9)*exp(-dist*dist/(size*size))*(0.45+2.2*h3)*(1.-t)*life;
  }
  return acc*pull;
}

// Stars pulled into lines that point away from the ring.
float lStreaks(vec2 q, float lanes, float seed, float rMin, float rSpan, float lengthK, float density){
  float r = length(q); float a = (atan(q.y, q.x)+L_PI)/L_TAU*lanes; float lane = floor(a), across = fract(a)-0.5;
  float h = lh21(vec2(lane, seed)); if (h > density) return 0.;
  float r0 = rMin+rSpan*lh21(vec2(lane, seed+7.));
  float len = (0.02+lengthK*lh21(vec2(lane, seed+11.)))*warp*(0.4+r0);
  float along = (r-r0)/max(len, 1e-4);
  float m = step(0., along)*step(along, 1.)*pow(clamp(1.-along, 0., 1.), 0.6)*smoothstep(0., 0.08, along);
  float arc = across*r*L_TAU/lanes; float width = 0.0007+0.0009*h;
  return m*exp(-arc*arc/(width*width))*(0.25+0.9*h);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (ringI + thin + guide + pull + warp + swell + lens <= 0.) { outputColor = inputColor; return; }

  vec2 p = (gl_FragCoord.xy-0.5*bufferSize)/bufferSize.y;
  vec2 q = p-center; float r = length(q);
  vec3 col = inputColor.rgb;
  col *= 1.-0.30*lens*(1.-smoothstep(radius*0.5, radius, r));    // the inside of the ring goes darker

  vec3 light = vec3(0.);
  if (ringI > 0.) {
    vec3 ring = lRing(q);
    if (ringSplit > 0.) { ring.r = lRing(q*(1.-ringSplit)).r; ring.b = lRing(q*(1.+ringSplit)).b; }   // red a touch outside, blue inside
    light += ring*ringI;
  }
  if (thin > 0.) {
    float d = abs(r-radius);
    light += (vec3(1.0)*exp(-d*d/(0.0016*0.0016))*1.5 + vec3(0.72)*(0.5*exp(-d/0.008)+0.12*exp(-d/0.03)))*thin;
  }
  if (guide > 0.) {
    float d = abs(length(p)-guideRadius);
    float dash = (1.-smoothstep(0.15, 0.25, abs(fract(atan(p.y, p.x)/L_TAU*72.+clock*0.01)-0.5)));
    light += vec3(0.85)*exp(-d*d/(0.0011*0.0011))*dash*guide;
  }
  if (pull > 0.) light += lDust(q);
  if (warp > 0.) light += vec3(0.9)*(lStreaks(q, 320., 31., 0.05, 1.2, 0.75, 0.5) + lStreaks(q, 520., 47., 0.1, 1.3, 0.55, 0.45)*0.8 + lStreaks(q, 190., 57., 0.02, 0.9, 1.1, 0.5)*1.2);
  if (swell > 0.) light += vec3(1.0, 0.93, 0.86)*swell*(0.10+0.34*smoothstep(0.25, 1.0, length(p*vec2(0.95, 1.3))));

  // Never let a bad value through: the bloom would smear it across the whole frame.
  if (!(light.r >= 0. && light.g >= 0. && light.b >= 0.)) light = vec3(0.);
  outputColor = vec4(col + lLinear(light), inputColor.a);
}
`;

export type LightState = {
  x: number;
  y: number;
  radius: number;
  ringI: number;
  ringW: number;
  ringSplit: number;
  thin: number;
  guide: number;
  guideRadius: number;
  pull: number;
  warp: number;
  swell: number;
  lens: number;
  clock: number;
};

/** Everything that glows during the ritual: the snapped circle, the ring, the dust, the streaks. */
export class LightEffect extends Effect {
  constructor() {
    const names = ["radius", "ringI", "ringW", "ringSplit", "thin", "guide", "guideRadius", "pull", "warp", "swell", "lens", "clock"];
    const uniforms = new Map<string, Uniform>(names.map((name) => [name, new Uniform(0)]));
    uniforms.set("center", new Uniform(new Vector2()));
    uniforms.set("bufferSize", new Uniform(new Vector2(1, 1)));
    super("LightEffect", LIGHT_FRAGMENT, { uniforms, attributes: EffectAttribute.NONE });
  }

  setBufferSize(width: number, height: number) {
    this.uniforms.get("bufferSize")!.value.set(width, height);
  }

  set(state: LightState) {
    this.uniforms.get("center")!.value.set(state.x, state.y);
    for (const [name, uniform] of this.uniforms) {
      if (name !== "center" && name !== "bufferSize") uniform.value = state[name as keyof LightState];
    }
  }
}

const FINAL_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D inputBuffer;
uniform vec2 uCenter;
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

  // The opening: a soft edged hole, so the page under the canvas shows through.
  // Just inside the edge the ring's light is kept and added on top of the page.
  float alpha = 1., keep = 1.;
  if (uHole > 0.) {
    float r = length(p-uCenter);
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
      uCenter: { value: new Vector2() },
      uAspect: { value: 1 },
      uGrain: { value: 0 },
      uVignette: { value: 0 },
      uHole: { value: 0 },
      uClock: { value: 0 },
    },
  });
}
