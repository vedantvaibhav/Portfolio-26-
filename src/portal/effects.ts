import { ShaderMaterial } from "three";

/**
 * Shader rules: never pow() a value that can be negative, and never call
 * smoothstep() with its edges reversed. Both are undefined, look fine in
 * software rendering, and produce invalid pixels on real GPUs.
 */

const FINAL_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D inputBuffer;
uniform float uAspect, uGrain, uVignette, uClock;
varying vec2 vUv;

float fHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

void main(){
  // Display space from here on: this pass writes the final pixels.
  vec3 c = pow(max(texture2D(inputBuffer, vUv).rgb, 0.), vec3(1./2.2));
  vec2 p = (vUv-0.5)*vec2(uAspect, 1.);
  c *= 1.-uVignette*smoothstep(0.30, 1.05, length(p*vec2(0.92, 1.15)));
  float g = fHash(gl_FragCoord.xy + fract(uClock)*311.7)-0.5;
  c += g*uGrain*(0.35+0.65*sqrt(max(dot(c, vec3(0.333)), 0.)));
  gl_FragColor = vec4(max(c, 0.), 1.);
}
`;

/** The last pass: vignette and film grain. */
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
      uClock: { value: 0 },
    },
  });
}
