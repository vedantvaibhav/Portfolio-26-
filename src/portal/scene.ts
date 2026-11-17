import { HalfFloatType, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import type { PortalConfig } from "./config";
import { FilmEffect } from "./film";
import { Dust } from "./layers/dust";
import { Nebula } from "./layers/nebula";
import { Planet } from "./layers/planet";
import { Stars } from "./layers/stars";

export type FrameStats = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  dpr: number;
};

/** How far away the planets sit. Stars are behind them, dust in front. */
const PLANET_DEPTH = 60;

/**
 * The Portal scene. Vanilla Three.js on purpose: this class owns the frame
 * loop and every GPU upload. React only mounts the canvas and calls the hooks.
 *
 *   enter()     start rendering
 *   update()    advance one frame
 *   resize()    match the canvas to its box
 *   teardown()  stop and free everything
 *
 * Milestone 1: the space. Haze, stars, two planets, near dust, a camera that
 * drifts and leans toward the pointer, and the film finish.
 */
export class PortalScene {
  onStats?: (stats: FrameStats) => void;
  /** Called once, after the first frame is on screen. */
  onReady?: () => void;

  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private scene = new Scene();
  private camera: PerspectiveCamera;

  private light = new Vector3(-0.72, 0.38, 0.42).normalize();
  private nebula = new Nebula();
  private stars = new Stars();
  private planet = new Planet(this.light, 2);
  private moon = new Planet(this.light, 5);
  private dust = new Dust();

  private bloom: BloomEffect;
  private fringe: ChromaticAberrationEffect;
  private film = new FilmEffect();

  private raf = 0;
  private running = false;
  private ready = false;
  private lastTime = 0;
  private elapsed = 0;
  /** Rolling average of frame time. The quality tiers will read this. */
  private frameMs = 1000 / 60;

  private pointer = new Vector2();
  private lean = new Vector2();
  /** 0 freezes drift, lean and twinkle. Set from prefers-reduced-motion. */
  private motion = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private config: PortalConfig,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true, // the opening cuts a hole through to the DOM
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false; // count draw calls across every pass

    this.camera = new PerspectiveCamera(config.camera.fov, 1, 0.5, 600);
    this.scene.add(this.nebula.backdrop, this.planet.group, this.moon.group, this.stars.points, this.dust.points);

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 });
    this.fringe = new ChromaticAberrationEffect({
      offset: new Vector2(),
      radialModulation: true,
      modulationOffset: 0.5,
    });

    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera, this.bloom));
    this.composer.addPass(new EffectPass(this.camera, this.fringe));
    this.composer.addPass(
      new EffectPass(this.camera, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), this.film),
    );

    this.setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.applyConfig();
    this.resize();
  }

  /** Re-read the config. The debug panel calls this after every change. */
  applyConfig() {
    const { config } = this;
    this.camera.fov = config.camera.fov;
    this.camera.updateProjectionMatrix();

    this.nebula.apply(config);
    this.stars.apply(config);
    this.planet.apply(config.planet);
    this.moon.apply({ ...config.moon, tint: config.moon.a, tintAmount: 0 });
    this.dust.setStrength(config.dust.strength);

    this.bloom.intensity = config.film.bloom;
    this.bloom.luminanceMaterial.threshold = config.film.bloomThreshold;
    this.fringe.offset.set(config.film.edgeFringe, config.film.edgeFringe);
    this.film.set(config.film.grain, config.film.vignette);
    this.layout();
  }

  setReducedMotion(reduced: boolean) {
    this.motion = reduced ? 0 : 1;
  }

  /** Pointer position, -1 to 1 on each axis, y up. */
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  enter() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    // Compile every shader before the first frame, so nothing hitches later.
    this.renderer.compile(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  update(dt: number, elapsed: number) {
    const { camera: c } = this.config;
    const t = elapsed;

    // Ease toward the pointer. Frame rate independent.
    this.lean.lerp(this.pointer, (1 - Math.exp(-dt * c.leanSpeed)) * this.motion);

    const yaw = (this.lean.x * c.leanDegrees * Math.PI) / 180;
    const pitch = (this.lean.y * c.leanDegrees * Math.PI) / 180;
    this.camera.rotation.set(pitch, -yaw, 0);
    this.camera.position.set(
      this.lean.x * c.leanShift + Math.sin(t * 0.11) * c.drift,
      this.lean.y * c.leanShift + Math.sin(t * 0.083 + 1.3) * c.drift,
      Math.sin(t * 0.19) * c.breathe,
    );

    // The haze is at infinity: it follows the turn of the camera, not its slide.
    const perHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360);
    this.nebula.render(this.renderer, t, Math.tan(yaw) / perHeight, Math.tan(pitch) / perHeight);

    this.stars.update(t);
    this.planet.update(t, this.config.planet.turnsPerMinute);
    this.moon.update(t, this.config.planet.turnsPerMinute * 1.6);
    this.dust.update(dt * this.motion);
  }

  resize() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const cap = coarse ? this.config.quality.dprMobile : this.config.quality.dprDesktop;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);

    this.renderer.setPixelRatio(dpr);
    this.composer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.nebula.resize(width * dpr, height * dpr);
    this.stars.resize(height, dpr);
    this.layout();
  }

  teardown() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.nebula.dispose();
    this.stars.dispose();
    this.planet.dispose();
    this.moon.dispose();
    this.dust.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  /** Place the planets by screen fraction, so portrait and landscape both compose. */
  private layout() {
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfHeight = PLANET_DEPTH * tan;
    const halfWidth = halfHeight * this.camera.aspect;
    const unit = Math.min(halfHeight, halfWidth * 1.5);

    this.planet.place(0.63 * halfWidth, 0.46 * halfHeight, -PLANET_DEPTH, 0.12 * unit);
    this.moon.place(-0.675 * halfWidth, -0.34 * halfHeight, -PLANET_DEPTH * 1.4, 0.028 * unit * 1.4);
    this.dust.resize(tan * this.camera.aspect, tan, this.canvas.clientHeight || 1, this.renderer.getPixelRatio());
  }

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const dtMs = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    this.elapsed += (dtMs / 1000) * this.motion;
    this.frameMs += (dtMs - this.frameMs) * 0.05;

    this.update(dtMs / 1000, this.elapsed);
    this.renderer.info.reset();
    this.composer.render(dtMs / 1000);

    if (!this.ready) {
      this.ready = true;
      this.onReady?.();
    }

    this.onStats?.({
      fps: 1000 / this.frameMs,
      frameMs: this.frameMs,
      drawCalls: this.renderer.info.render.calls,
      dpr: this.renderer.getPixelRatio(),
    });
  };

  private onVisibility = () => {
    // Skip the long gap after a hidden tab so it does not count as a slow frame.
    if (!document.hidden) this.lastTime = performance.now();
  };
}
