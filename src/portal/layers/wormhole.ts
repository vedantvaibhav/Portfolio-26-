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
  Vector2,
} from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION } from "../glsl";
import { requestCloud } from "./wormhole-cloud";

/** The sheet starts this far down the throat, as a share of the hole's radius. Below that it is lost in the dark. */
const THROAT = 0.6;
/** How sharply the sheet bends into the hole. */
const BEND = 2.2;

/**
 * A point cloud, in the manner of a scanned landscape: hundreds of thousands
 * of tiny points, all nearly the same brightness. The picture is made by how
 * many of them land in each place. Where they crowd, at the lip of the hole,
 * they add up to white. Where they thin out you see single grains.
 *
 * The cloud is built once (see wormhole-cloud.ts). Each frame the shader only
 * moves every point a little further along its spiral.
 */
const VERTEX = /* glsl */ `
attribute vec4 aLook;      // vary, dunes, glint, kind
uniform float uClock, uSpan, uInner, uOuterX, uSwirl, uWell, uThickness, uSize;
uniform float uPixelsPerUnit, uPixelRatio, uBrightAngle, uGain;
uniform float uDrain, uDrainCurve, uDrainFlight, uDrainTravel, uDrainRush, uAspect;
uniform vec2 uTarget;       // where the grains drain to, in screen space: -1 to 1 on each axis
varying float vLight;
const float TAU = 6.2831853;

void main(){
  float start = position.x, turn = position.y, gauss = (position.z-0.5)*6.;
  float vary = aLook.x, dunes = aLook.y, glint = aLook.z;
  bool spray = aLook.w > 0.75;                           // a few fly loose above the sheet
  bool crowd = aLook.w > 0.25 && !spray;                 // half gather toward the hole

  // The fall. k runs evenly from 1 at the outer rim to 0 deep in the throat and wraps.
  // Bending it with a power sets where points gather, and makes them plunge at the end.
  float k = fract(start - uClock*(1.+0.05*(vary-0.5)));
  float x = ${THROAT.toFixed(2)}*exp(uSpan*pow(max(k, 1e-6), crowd ? 1.6 : 0.85));   // radius, in hole radii
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

  // The drain. The picture is not pulled or bent. Each grain leaves on its own,
  // at its own moment, and flies across the screen to the point. Until its turn
  // comes it stays exactly where it was. So the wormhole holds its shape and
  // thins out, while a stream of grains pours into the point.
  float gone = 1.;
  if (uDrain > 0.) {
    vec2 screen = gl_Position.xy/gl_Position.w;
    vec2 away = (screen-uTarget)*vec2(uAspect, 1.);
    float far = length(away);
    // Two rolls of the dice per grain, from where it sits in the cloud.
    float roll = fract(sin(dot(position.xy, vec2(12.9898, 78.233)))*43758.5453);
    float bend = fract(sin(dot(position.xy, vec2(39.3468, 11.135)))*24634.6345)-0.5;
    // When it leaves: a trickle first, then more and more. Grains near the point go a little sooner.
    float leave = (1.-uDrainFlight)*(0.82*pow(roll, 0.65)+0.18*clamp(far/1.6, 0., 1.));
    float e = clamp((uDrain-leave)/uDrainFlight, 0., 1.);
    e = pow(e, uDrainRush);                              // its own trip: slow off the mark, fast at the end
    // Each takes its own curved path, some bowing left and some right.
    vec2 side = vec2(-away.y, away.x)*bend*uDrainCurve*sin(e*3.14159265);
    away = (away+side)*(1.-e*uDrainTravel);
    gl_Position.xy = (uTarget+away/vec2(uAspect, 1.))*gl_Position.w;
    size *= 1.-0.5*e;
    gone = 1.-smoothstep(0.7, 1., e);
  }
  gl_PointSize = min(size, 20.*uPixelRatio);

  // The light comes from the hole. Hottest where the sheet rolls over the lip, gone down the throat.
  float off = (x-1.08)/0.20;
  float light = 0.20+1.5*exp(-off*off)+1.0*pow(1./max(x, 1.), 1.35);
  float walls = smoothstep(0.87, 1.03, x);               // the walls of the throat go black fast
  light *= walls*walls*(1.-smoothstep(0.55*uOuterX, uOuterX, x));
  float side = 0.58+0.42*pow(max(0.5+0.5*cos(theta-uBrightAngle), 0.), 1.5);   // one side burns brighter
  float ends = smoothstep(0., 0.015, k)*(1.-smoothstep(0.93, 1., k));
  float tooNear = smoothstep(2.5, 9., distance);
  vLight = uGain*light*side*ends*(0.55+2.6*glint)*shrink*bokeh*tooNear*gone*(spray ? 0.55 : 1.);
}
`;

const FRAGMENT = /* glsl */ `
${PRECISION}
varying float vLight;
${NOISE}
void main(){
  float d = length(gl_PointCoord*2.-1.);
  float light = vLight*(1.-smoothstep(0.35, 1., d));
  // Never let a bad value through: the bloom would smear it across the whole frame.
  if (!(light >= 0.)) light = 0.;
  gl_FragColor = vec4(toLinear(vec3(light)), 1.);
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
  private gain = 1;
  private well = 0;
  /** 0 until the cloud arrives, then it eases to 1. */
  private reveal = 0;
  private total = 0;
  private share = 1;
  private wanted = -1;
  private builtThroat = "";
  private disposed = false;

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
        uGain: { value: 0 },
        uDrain: { value: 0 },
        uDrainCurve: { value: 0 },
        uDrainFlight: { value: 0.3 },
        uDrainTravel: { value: 1 },
        uDrainRush: { value: 3 },
        uAspect: { value: 1 },
        uTarget: { value: new Vector2() },
      },
    });
    this.points = new Points(new BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.visible = false;

    // Black walls and a black floor for the throat, so the far side of the sheet does not show through the hole.
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
    u.uDrainCurve.value = config.drain.curve;
    u.uDrainFlight.value = config.drain.flight;
    u.uDrainTravel.value = config.drain.travel;
    u.uDrainRush.value = config.drain.rush;
    this.group.rotation.set((w.elevation * Math.PI) / 180, 0, (w.roll * Math.PI) / 180);

    // Phones draw about a third as many points, each a little brighter to keep the same weight.
    this.gain = coarse ? w.gain * 1.7 : w.gain;
    this.well = w.well * w.innerRadius;
    const count = Math.round(coarse ? w.points * 0.35 : w.points);
    if (count !== this.wanted) {
      this.wanted = count;
      requestCloud(count).then((cloud) => {
        if (this.disposed || count !== this.wanted) return;
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(cloud.flow, 3, true));
        geometry.setAttribute("aLook", new BufferAttribute(cloud.look, 4, true));
        this.points.geometry.dispose();
        this.points.geometry = geometry;
        this.points.visible = true;
        this.total = cloud.count;
        this.setShare(this.share);
      });
    }

    const throatKey = `${w.innerRadius}:${w.well}`;
    if (throatKey !== this.builtThroat) this.buildThroat(w.innerRadius, w.well);
    this.builtThroat = throatKey;
  }

  /** Where the hole sits. */
  place(x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
  }

  /** How big a world unit is on screen, one unit from the lens, and the shape of the screen. */
  setScale(pixelsPerUnit: number, pixelRatio: number, aspect: number) {
    this.material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uAspect.value = aspect;
  }

  /** amount runs 0 to 1. x and y are where the grains drain to on screen, -1 to 1, y up. */
  setDrain(amount: number, x: number, y: number) {
    this.material.uniforms.uDrain.value = amount;
    this.material.uniforms.uTarget.value.set(x, y);
  }

  /** How far below the far sheet the lip of the hole sits. */
  get lipDepth() {
    return this.well;
  }

  /**
   * Draw only this share of the cloud. The points are in random order, so a
   * smaller share is the same picture, thinner. Used to hold the frame rate.
   */
  setShare(share: number) {
    this.share = share;
    this.points.geometry.setDrawRange(0, Math.round(this.total * share));
  }

  /** speed is the share of the journey from rim to hole covered per second. */
  update(dt: number, realDt: number, speed: number, fade: number) {
    this.clock += dt * speed;
    if (this.points.visible) this.reveal = Math.min(1, this.reveal + realDt / 1.6);
    const eased = this.reveal * this.reveal * (3 - 2 * this.reveal);
    this.material.uniforms.uClock.value = this.clock;
    // Fewer points are each a little brighter, so the picture keeps its weight.
    this.material.uniforms.uGain.value = (this.gain * fade * eased) / Math.pow(this.share, 0.8);
  }

  dispose() {
    this.disposed = true;
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
