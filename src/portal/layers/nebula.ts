import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  HalfFloatType,
  LinearFilter,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { PortalConfig } from "../config";
import { NOISE, PRECISION, hexToDisplay } from "../glsl";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0., 1.); }
`;

const NEBULA_FRAGMENT = /* glsl */ `
${PRECISION}
varying vec2 vUv;
uniform float uTime, uAspect, uStrength;
uniform vec2 uOffset;
uniform vec3 uDeep, uLift, uIndigo, uMarigold, uCoral;
${NOISE}
void main(){
  vec2 p = (vUv-0.5)*vec2(uAspect, 1.) + uOffset;
  vec3 col = mix(uDeep, uLift, smoothstep(-0.6, 0.7, p.y*0.8+p.x*0.35+0.25*fbm(p*0.7)));

  vec2 d = p + uTime*vec2(0.0016, 0.0007);
  vec2 q = d*1.25 + vec2(fbm(d*1.1+3.0), fbm(d*1.1+11.0))*0.9;
  float n = fbm(q*1.4 + uTime*0.008);
  float w = fbm(q*2.2+20.);
  vec3 haze = uIndigo*smoothstep(0.34, 0.86, n);
  haze += uMarigold*smoothstep(0.52, 0.85, fbm(d*0.9+vec2(7., 2.)))*smoothstep(0.40, 0.8, w)*0.35;
  haze += uCoral*smoothstep(0.55, 0.9, fbm(d*0.8+vec2(-4., 9.)))*smoothstep(0.38, 0.8, w)*0.33;
  haze *= 0.55+0.9*smoothstep(0.2, 0.7, fbm(q*3.0+40.));

  gl_FragColor = vec4(col + haze*uStrength, 1.);
}
`;

const BACKDROP_FRAGMENT = /* glsl */ `
${PRECISION}
varying vec2 vUv;
uniform sampler2D uMap;
${NOISE}
void main(){ gl_FragColor = vec4(toLinear(texture2D(uMap, vUv).rgb), 1.); }
`;

function fullscreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return geometry;
}

/**
 * The far background: a dark gradient with indigo haze and traces of marigold
 * and coral. It is soft, so it is painted into a quarter resolution buffer and
 * stretched over the screen. That keeps the noise off the full size frame.
 */
export class Nebula {
  /** Add this to the main scene. It draws first and covers the frame. */
  readonly backdrop: Mesh;

  private target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  private paintScene = new Scene();
  private paintCamera = new Camera();
  private paint: ShaderMaterial;

  constructor() {
    this.paint = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: NEBULA_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uStrength: { value: 0 },
        uOffset: { value: new Vector2() },
        uDeep: { value: new Vector3() },
        uLift: { value: new Vector3() },
        uIndigo: { value: new Vector3() },
        uMarigold: { value: new Vector3() },
        uCoral: { value: new Vector3() },
      },
    });
    const painter = new Mesh(fullscreenTriangle(), this.paint);
    painter.frustumCulled = false;
    this.paintScene.add(painter);

    this.backdrop = new Mesh(
      fullscreenTriangle(),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: BACKDROP_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: { uMap: { value: this.target.texture } },
      }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -1000;
  }

  apply(config: PortalConfig) {
    const u = this.paint.uniforms;
    hexToDisplay(config.space.deep, u.uDeep.value);
    hexToDisplay(config.space.lift, u.uLift.value);
    hexToDisplay(config.space.nebulaIndigo, u.uIndigo.value);
    hexToDisplay(config.space.nebulaMarigold, u.uMarigold.value);
    hexToDisplay(config.space.nebulaCoral, u.uCoral.value);
    u.uStrength.value = config.space.nebulaStrength;
  }

  resize(width: number, height: number) {
    this.target.setSize(Math.max(2, Math.round(width / 4)), Math.max(2, Math.round(height / 4)));
    this.paint.uniforms.uAspect.value = width / height;
  }

  /** offset: how far the camera has turned, in screen heights. */
  render(renderer: WebGLRenderer, time: number, offsetX: number, offsetY: number) {
    this.paint.uniforms.uTime.value = time;
    this.paint.uniforms.uOffset.value.set(offsetX, offsetY);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.paintScene, this.paintCamera);
    renderer.setRenderTarget(previous);
  }

  dispose() {
    this.target.dispose();
    this.paint.dispose();
    this.backdrop.geometry.dispose();
    (this.backdrop.material as ShaderMaterial).dispose();
  }
}
