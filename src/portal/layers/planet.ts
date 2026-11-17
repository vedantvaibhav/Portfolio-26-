import { AdditiveBlending, BackSide, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { NOISE, PRECISION, hexToDisplay } from "../glsl";

const VERTEX = /* glsl */ `
varying vec3 vSurface, vNormal, vView;
void main(){
  vec4 world = modelMatrix*vec4(position, 1.);
  vSurface = normalize(position);
  vNormal = normalize(mat3(modelMatrix)*normal);
  vView = cameraPosition - world.xyz;
  gl_Position = projectionMatrix*viewMatrix*world;
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
${PRECISION}
varying vec3 vSurface, vNormal, vView;
uniform vec3 uLight, uA, uB, uTint, uRim;
uniform float uSeed, uTintAmount;
${NOISE}
void main(){
  vec3 n = normalize(vNormal), s = normalize(vSurface);
  float ndl = dot(n, uLight);

  // Stretched along latitude so the noise reads as bands.
  float bands = fbm3(s*vec3(1.3, 6.5, 1.3) + uSeed*3. + 0.7*fbm3(s*vec3(3., 9., 3.)+uSeed));
  float detail = fbm3(s*vec3(6., 16., 6.)+uSeed*7.);
  vec3 albedo = mix(uA, uB, smoothstep(0.25, 0.75, bands))*(0.75+0.5*detail);
  albedo = mix(albedo, uTint, smoothstep(0.42, 0.66, fbm3(s*vec3(2., 5., 2.)+uSeed*11.))*uTintAmount);

  vec3 col = albedo*smoothstep(-0.12, 0.5, ndl)*(0.2+max(ndl, 0.)) + albedo*0.010;
  float ndv = dot(n, normalize(vView));
  float fresnel = pow(1.-max(ndv, 0.), 3.2);
  col += uRim*fresnel*smoothstep(-0.35, 0.25, ndl);
  // Fade the last pixel of the limb, so the edge is smooth without multisampling.
  float edge = clamp(ndv/max(fwidth(ndv), 1e-4), 0., 1.);
  gl_FragColor = vec4(toLinear(col), edge);
}
`;

const HALO_FRAGMENT = /* glsl */ `
${PRECISION}
varying vec3 vSurface, vNormal, vView;
uniform vec3 uLight, uRim;
${NOISE}
void main(){
  vec3 n = normalize(vNormal);
  // Back faces of a slightly larger shell: 0 at the shell edge, 1 at the limb.
  float edge = smoothstep(0., 0.42, -dot(n, normalize(vView)));
  float lit = smoothstep(-0.45, 0.35, dot(n, uLight));
  gl_FragColor = vec4(toLinear(uRim*pow(edge, 3.)*lit*0.45), 1.);
}
`;

export type PlanetLook = {
  a: string;
  b: string;
  tint: string;
  tintAmount: number;
  rim: string;
};

/**
 * A placeholder planet: a sphere with procedural bands, lit by the one sun,
 * with an atmosphere rim in the shader. Blender models replace the surface in
 * milestone 6. The rim stays in the shader.
 */
export class Planet {
  readonly group = new Group();
  private surface: ShaderMaterial;
  private halo: ShaderMaterial;
  private body: Mesh;

  constructor(light: Vector3, seed: number) {
    const uniforms = {
      uLight: { value: light },
      uA: { value: new Vector3() },
      uB: { value: new Vector3() },
      uTint: { value: new Vector3() },
      uRim: { value: new Vector3() },
      uSeed: { value: seed },
      uTintAmount: { value: 0 },
    };
    this.surface = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      uniforms,
      transparent: true,
    });
    this.halo = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: HALO_FRAGMENT,
      uniforms: { uLight: uniforms.uLight, uRim: uniforms.uRim },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const geometry = new SphereGeometry(1, 64, 48);
    this.body = new Mesh(geometry, this.surface);
    // Spin first, then tilt the axis.
    this.body.rotation.order = "ZYX";
    this.body.rotation.z = 0.42;
    const shell = new Mesh(geometry, this.halo);
    shell.scale.setScalar(1.1);
    this.group.add(this.body, shell);
  }

  apply(look: PlanetLook) {
    const u = this.surface.uniforms;
    hexToDisplay(look.a, u.uA.value);
    hexToDisplay(look.b, u.uB.value);
    hexToDisplay(look.tint, u.uTint.value);
    hexToDisplay(look.rim, u.uRim.value);
    u.uTintAmount.value = look.tintAmount;
  }

  place(x: number, y: number, z: number, radius: number) {
    this.group.position.set(x, y, z);
    this.group.scale.setScalar(radius);
  }

  update(time: number, turnsPerMinute: number) {
    this.body.rotation.y = (time / 60) * turnsPerMinute * Math.PI * 2;
  }

  dispose() {
    this.body.geometry.dispose();
    this.surface.dispose();
    this.halo.dispose();
  }
}
