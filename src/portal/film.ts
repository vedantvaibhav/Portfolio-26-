import { Effect } from "postprocessing";
import { Uniform } from "three";

const FRAGMENT = /* glsl */ `
uniform float grain;
uniform float vignette;

float filmHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Work in display space so the grain reads the same in shadows and highlights.
  vec3 c = pow(max(inputColor.rgb, 0.), vec3(1./2.2));
  vec2 p = (uv-0.5)*vec2(aspect, 1.);
  c *= 1. - vignette*smoothstep(0.30, 1.05, length(p*vec2(0.92, 1.15)));
  float g = filmHash(uv*resolution + fract(time)*311.7) - 0.5;
  c += g*grain*(0.35+0.65*sqrt(max(dot(c, vec3(0.333)), 0.)));
  outputColor = vec4(pow(max(c, 0.), vec3(2.2)), inputColor.a);
}
`;

/** The film finish: fine grain and a vignette, applied last. */
export class FilmEffect extends Effect {
  constructor() {
    super("FilmEffect", FRAGMENT, {
      uniforms: new Map([
        ["grain", new Uniform(0)],
        ["vignette", new Uniform(0)],
      ]),
    });
  }

  set(grain: number, vignette: number) {
    this.uniforms.get("grain")!.value = grain;
    this.uniforms.get("vignette")!.value = vignette;
  }
}
