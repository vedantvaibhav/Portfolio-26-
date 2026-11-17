import { Vector3 } from "three";

/**
 * Shared GLSL. Colours in every Portal shader are authored in display space
 * (the numbers you would pick in a design tool) and converted to linear with
 * toLinear() on the way out, so the look matches the approved storyboard.
 *
 * highp everywhere: on Adreno and Mali, mediump is a real 16 bit float and
 * bands in the dark gradients.
 */
export const PRECISION = /* glsl */ `precision highp float;`;

export const NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ s+=a*vnoise(p); p=m*p; a*=.5; } return s; }

float h31(vec3 p){ p=fract(p*vec3(0.1031,0.1030,0.0973)); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(11.3,7.1,5.7); a*=.5; } return s; }

vec3 toLinear(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }
`;

/** "#rrggbb" to its display space components, untouched by colour management. */
export function hexToDisplay(hex: string, target = new Vector3()) {
  const n = parseInt(hex.replace("#", ""), 16);
  return target.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
