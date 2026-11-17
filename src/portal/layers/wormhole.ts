import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
} from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION } from "../glsl";

/** The sheet starts this far down the throat, as a share of the hole's radius. Below that it is lost in the dark. */
const THROAT = 0.6;
/** How sharply the sheet bends into the hole. */
const BEND = 2.2;

/**
 * A point cloud, in the manner of a scanned landscape: about a million tiny
 * points, all nearly the same brightness. The picture is made by how many of
 * them land in each place. Where they crowd, at the lip of the hole, they add
 * up to white. Where they thin out you see single grains.
 *
 * Nothing is stored per point. Each one derives everything from its index:
 * which spiral it falls along, how far along it started, how far it sits off
 * the sheet. The flow lines and dunes are a density pattern laid over those
 * coordinates, and points that fall in the gaps are simply not drawn.
 */
const VERTEX = /* glsl */ `
uniform float uClock, uSpan, uInner, uOuterX, uSwirl, uWell, uThickness, uSize;
uniform float uPixelsPerUnit, uPixelRatio, uBrightAngle, uGain, uFade;
varying float vLight;
const float TAU = 6.2831853;

uint pcg(uint v){ uint s = v*747796405u+2891336453u; uint w = ((s >> ((s >> 28u)+4u)) ^ s)*277803737u; return (w >> 22u) ^ w; }
float rnd(uint n){ return float(pcg(n))*(1./4294967296.); }

// Value noise that repeats every "period" cells in x, so the pattern joins up around the hole.
float cell(vec2 i, float period){ i.x = mod(i.x, period); return fract(sin(dot(i, vec2(127.1, 311.7)))*43758.5453); }
float pnoise(vec2 p, float period){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(cell(i, period), cell(i+vec2(1, 0), period), f.x), mix(cell(i+vec2(0, 1), period), cell(i+vec2(1, 1), period), f.x), f.y); }
float pfbm(vec2 p, float period){ float a = .5, s = 0.; for (int i=0; i<4; i++) { s += a*pnoise(p, period); p *= 2.; period *= 2.; p.y += 17.3; a *= .5; } return s; }

void main(){
  uint id = uint(gl_VertexID)*9u;
  float pop = rnd(id), start = rnd(id+1u), turn = rnd(id+2u), keep = rnd(id+5u), vary = rnd(id+6u);
  float gauss = sqrt(-2.*log(max(rnd(id+3u), 1e-6)))*cos(TAU*rnd(id+4u));
  bool spray = pop > 0.94;                              // a few fly loose above the sheet

  // Where the matter is. Long streaks along the flow, slow dunes across it, and a fine hair of lines.
  float lines = pfbm(vec2(turn*26., start*4.5), 26.);
  float dunes = pfbm(vec2(turn*3., start*7.+5.), 3.);
  float hair = pnoise(vec2(turn*230., start*2.2), 230.);
  float density = (0.04+0.96*smoothstep(0.34, 0.62, lines*0.6+dunes*0.4))*(0.30+1.4*hair);
  if (!spray && keep > density) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vLight = 0.; return; }

  // The fall. k runs evenly from 1 at the outer rim to 0 deep in the throat and wraps.
  // Bending it with a power sets where points gather, and makes them plunge at the end.
  float k = fract(start - uClock*(1.+0.05*(vary-0.5)));
  float x = ${THROAT.toFixed(2)}*exp(uSpan*pow(k, pop < 0.5 ? 1.6 : 0.85));   // radius, in hole radii
  float r = uInner*x;
  float theta = TAU*turn + uSwirl*pow(1./x, 1.5);        // the spiral winds tighter near the hole

  float height = -uWell*uInner*pow(1./x, ${BEND.toFixed(1)}) + r*0.024*(dunes-0.5);
  height += gauss*r*(spray ? 0.075 : uThickness);
  vec4 view = modelViewMatrix*vec4(r*cos(theta), height, r*sin(theta), 1.);
  gl_Position = projectionMatrix*view;

  float distance = max(-view.z, 0.01);
  float size = uSize*(0.7+0.9*vary*vary)*uPixelsPerUnit/distance;
  float smallest = 1.15*uPixelRatio;
  float shrink = 1.;
  if (size < smallest) { shrink = (size/smallest)*(size/smallest); size = smallest; }   // too small to draw: dim it instead
  float soft = 2.6*uPixelRatio;
  float bokeh = size > soft ? soft/size : 1.;            // close to the lens they swell and go faint
  gl_PointSize = min(size, 20.*uPixelRatio);

  // The light comes from the hole. Hottest where the sheet rolls over the lip, gone down the throat.
  float lip = exp(-pow((x-1.08)/0.20, 2.));
  float light = 0.20+1.5*lip+1.0*pow(1./max(x, 1.), 1.35);
  light *= pow(smoothstep(0.80, 1.03, x), 2.)*smoothstep(uOuterX, 0.55*uOuterX, x);   // the walls of the throat go black fast
  float side = 0.58+0.42*pow(0.5+0.5*cos(theta-uBrightAngle), 1.5);   // one side burns brighter
  float ends = smoothstep(0., 0.015, k)*smoothstep(1., 0.93, k);
  float glint = 0.55+2.6*pow(rnd(id+7u), 12.);            // one in a few hundred catches the light
  float tooNear = smoothstep(2.5, 9., distance);
  vLight = uGain*light*side*ends*glint*shrink*bokeh*tooNear*uFade*(spray ? 0.55 : 1.);
}
`;

const FRAGMENT = /* glsl */ `
${PRECISION}
varying float vLight;
${NOISE}
void main(){
  float d = length(gl_PointCoord*2.-1.);
  gl_FragColor = vec4(toLinear(vec3(vLight*smoothstep(1., 0.35, d))), 1.);
}
`;

/**
 * The wormhole: a wide sheet of grains turning around a black hole and
 * falling into it. One draw call for the grains, and a black funnel under
 * them so nothing shows through the hole. Everything moves from one clock.
 */
export class Wormhole {
  /** Add this to the scene. Its origin is the centre of the hole, level with the far sheet. */
  readonly group = new Group();
  private points: Points;
  private throat: Mesh;
  private floor: Mesh;
  private material: ShaderMaterial;
  private black = new MeshBasicMaterial({ color: 0x000000, side: DoubleSide });
  private clock = 0;
  private builtCount = -1;
  private builtThroat = "";

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
        uOuterX: { value: 2 },
        uSwirl: { value: 0 },
        uWell: { value: 0 },
        uThickness: { value: 0 },
        uSize: { value: 0.05 },
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

    // Black walls and a black floor for the throat. They draw first and hide the stars behind the hole.
    this.throat = new Mesh(new BufferGeometry(), this.black);
    this.floor = new Mesh(new CircleGeometry(1, 64), this.black);
    this.floor.rotation.x = -Math.PI / 2;

    this.group.rotation.order = "ZXY";
    this.group.add(this.throat, this.floor, this.points);
  }

  apply(config: PortalConfig, coarse: boolean) {
    const w = config.wormhole;
    const u = this.material.uniforms;
    u.uSpan.value = Math.log(w.outerRadius / (w.innerRadius * THROAT));
    u.uInner.value = w.innerRadius;
    u.uOuterX.value = w.outerRadius / w.innerRadius;
    u.uSwirl.value = w.swirl;
    u.uWell.value = w.well;
    u.uThickness.value = w.thickness;
    u.uSize.value = w.pointSize;
    u.uBrightAngle.value = (w.brightAngle * Math.PI) / 180;
    u.uGain.value = w.gain;
    this.group.rotation.set((w.elevation * Math.PI) / 180, 0, (w.roll * Math.PI) / 180);

    // Phones draw about a third as many points, each a little brighter to keep the same weight.
    const count = Math.round(coarse ? w.points * 0.35 : w.points);
    if (coarse) u.uGain.value = w.gain * 1.7;
    if (count !== this.builtCount) {
      const geometry = new BufferGeometry();
      // Every value comes from the vertex index. Three only needs this attribute to know how many to draw.
      geometry.setAttribute("position", new BufferAttribute(new Uint8Array(count * 3), 3));
      this.points.geometry.dispose();
      this.points.geometry = geometry;
      this.builtCount = count;
    }

    const throatKey = `${w.innerRadius}:${w.well}`;
    if (throatKey !== this.builtThroat) this.buildThroat(w.innerRadius, w.well);
    this.builtThroat = throatKey;
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
    this.throat.geometry.dispose();
    this.floor.geometry.dispose();
    this.material.dispose();
    this.black.dispose();
  }

  /** The inside of the funnel, from the lip down to where the light gives out. */
  private buildThroat(inner: number, well: number) {
    const rings = 24;
    const spokes = 96;
    const depth = (x: number) => -well * inner * Math.pow(1 / x, BEND);
    const position = new Float32Array((rings + 1) * (spokes + 1) * 3);
    let v = 0;
    for (let i = 0; i <= rings; i++) {
      const x = THROAT + (1.0 - THROAT) * (i / rings);
      for (let j = 0; j <= spokes; j++) {
        const theta = (j / spokes) * Math.PI * 2;
        // A touch narrower and lower than the grains, so they always sit in front of it.
        position.set([inner * x * 0.985 * Math.cos(theta), depth(x) - 0.08, inner * x * 0.985 * Math.sin(theta)], v * 3);
        v++;
      }
    }
    const index = new Uint16Array(rings * spokes * 6);
    let k = 0;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < spokes; j++) {
        const a = i * (spokes + 1) + j;
        const b = a + spokes + 1;
        index.set([a, b, a + 1, a + 1, b, b + 1], k);
        k += 6;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setIndex(new BufferAttribute(index, 1));
    this.throat.geometry.dispose();
    this.throat.geometry = geometry;
    this.floor.position.y = depth(THROAT) - 0.08;
    this.floor.scale.setScalar(inner * THROAT);
  }
}
