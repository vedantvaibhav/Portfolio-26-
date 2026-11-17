import { HalfFloatType, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ShaderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import type { PortalConfig } from "./config";
import { LensEffect, LightEffect, createFinalMaterial } from "./effects";
import { Dust } from "./layers/dust";
import { Nebula } from "./layers/nebula";
import { Planet } from "./layers/planet";
import { Stars } from "./layers/stars";
import { Trail } from "./layers/trail";
import { judgeStroke, ringRadius } from "./recognize";
import { gsap } from "@/lib/gsap";
import { buildOpening, buildReducedOpening, restFx, type Fx } from "./ritual";

export type FrameStats = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  dpr: number;
};

/**
 * idle      space, waiting
 * drawing   the hand is down
 * fail      the stroke was not a circle and is dissolving
 * snap      the stroke pulls onto a perfect circle
 * ignition  the circle becomes the ring
 * opening   the ring grows past the screen and the site shows through
 * done      the site is open; the scene can be torn down
 */
export type Phase = "idle" | "drawing" | "fail" | "snap" | "ignition" | "opening" | "done";
export type Miss = "open" | "shape";

/** How far away the planets sit. Stars are behind them, dust in front. */
const PLANET_DEPTH = 60;
/** Radius of the guide ring and of the keyboard circle, as a share of the short side. */
const DEFAULT_RADIUS = 0.17;

/**
 * The Portal scene. Vanilla Three.js on purpose: this class owns the frame
 * loop and every GPU upload. React only mounts the canvas and calls the hooks.
 *
 *   enter()     start rendering
 *   update()    advance one frame
 *   resize()    match the canvas to its box
 *   teardown()  stop and free everything
 *
 * It also runs the ritual: strokeStart / strokeMove / strokeEnd feed it the
 * pointer, and it reports each change of phase through onPhase.
 */
export class PortalScene {
  onStats?: (stats: FrameStats) => void;
  /** Called once, after the first frame is on screen. */
  onReady?: () => void;
  onPhase?: (phase: Phase, miss?: Miss) => void;

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
  private trail = new Trail();

  private lens = new LensEffect();
  private glow = new LightEffect();
  private bloom: BloomEffect;
  private fringe: ChromaticAberrationEffect;
  private final = createFinalMaterial();

  private raf = 0;
  private running = false;
  private ready = false;
  private lastTime = 0;
  private elapsed = 0;
  private clock = 0;
  /** Rolling average of frame time. The quality tiers will read this. */
  private frameMs = 1000 / 60;
  private width = 1;
  private height = 1;

  private pointer = new Vector2();
  private lean = new Vector2();
  /** 0 freezes drift, lean and twinkle. Set from prefers-reduced-motion. */
  private motion = 1;

  private phase: Phase = "idle";
  private fx: Fx = restFx();
  private timeline: gsap.core.Timeline | null = null;
  private failTween: gsap.core.Tween | null = null;
  private fails = 0;
  private strokeSteps = 0;
  /** Where the ring ignites, in CSS pixels. */
  private ring = { x: 0, y: 0, r: 1 };
  private cover: HTMLElement | null = null;
  private destination: HTMLElement | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private config: PortalConfig,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true, // the opening cuts a hole through to the page
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.info.autoReset = false; // count draw calls across every pass

    this.camera = new PerspectiveCamera(config.camera.fov, 1, 0.5, 600);
    this.scene.add(
      this.nebula.backdrop,
      this.planet.group,
      this.moon.group,
      this.stars.points,
      this.dust.points,
      this.trail.ribbon,
      this.trail.head,
    );

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 });
    this.fringe = new ChromaticAberrationEffect({
      offset: new Vector2(),
      radialModulation: true,
      modulationOffset: 0.5,
    });

    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera, this.lens, this.glow));
    this.composer.addPass(new EffectPass(this.camera, this.bloom));
    this.composer.addPass(
      new EffectPass(this.camera, this.fringe, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })),
    );
    this.composer.addPass(new ShaderPass(this.final, "inputBuffer"));

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
    this.trail.apply(config);

    this.bloom.intensity = config.film.bloom;
    this.bloom.luminanceMaterial.threshold = config.film.bloomThreshold;
    this.final.uniforms.uGrain.value = config.film.grain;
    this.final.uniforms.uVignette.value = config.film.vignette;
    this.layout();
  }

  setReducedMotion(reduced: boolean) {
    this.motion = reduced ? 0 : 1;
  }

  /** The cover fades on the reduced motion path. The destination scales and sharpens in the opening. */
  setElements(cover: HTMLElement | null, destination: HTMLElement | null) {
    this.cover = cover;
    this.destination = destination;
  }

  /** Pointer position, -1 to 1 on each axis, y up. Ignored once the hand is down. */
  setPointer(x: number, y: number) {
    if (this.phase === "idle" || this.phase === "fail") this.pointer.set(x, y);
  }

  // ---- the ritual ----

  /** Positions are CSS pixels from the top left of the canvas. */
  strokeStart(x: number, y: number) {
    if (this.phase !== "idle" && this.phase !== "fail") return;
    this.failTween?.kill();
    this.fx.trail = 1;
    this.pointer.copy(this.lean); // hold the camera still under the stroke
    this.strokeSteps = 0;
    this.trail.begin(x, y, performance.now());
    this.setPhase("drawing");
  }

  strokeMove(x: number, y: number) {
    if (this.phase !== "drawing") return;
    if (!this.trail.add(x, y, performance.now())) return;
    // Check as they draw. If the loop closes mid stroke, ignite without waiting for the hand to lift.
    if (++this.strokeSteps % 3 === 0) {
      const verdict = judgeStroke(this.trail.points, this.config.recognition, true);
      if (verdict.ok) this.recognise(verdict.x, verdict.y, verdict.r);
    }
  }

  strokeEnd() {
    if (this.phase !== "drawing") return;
    const verdict = judgeStroke(this.trail.points, this.config.recognition);
    if (verdict.ok) return this.recognise(verdict.x, verdict.y, verdict.r);

    const miss = verdict.reason === "short" ? undefined : verdict.reason;
    if (miss) this.fails++;
    this.setPhase("fail", miss);
    this.failTween = gsap.to(this.fx, {
      trail: 0,
      duration: (miss ? this.config.trail.failFadeMs : 180) / 1000,
      ease: "power1.out",
      onComplete: () => {
        this.trail.clear();
        this.fx.trail = 1;
        if (this.phase === "fail") this.setPhase("idle");
      },
    });
    if (this.fails >= this.config.recognition.guideAfterFails) gsap.to(this.fx, { guide: 0.5, duration: 0.8 });
  }

  /** The keyboard way in: a perfect circle in the middle of the screen. */
  igniteAtCentre() {
    if (this.phase !== "idle" && this.phase !== "fail" && this.phase !== "drawing") return;
    this.failTween?.kill();
    this.trail.clear();
    const short = Math.min(this.width, this.height);
    this.recognise(this.width / 2, this.height / 2, (short * DEFAULT_RADIUS) / this.config.snap.grow);
  }

  /** For the debug panel: hold the timeline still, or move it by hand. */
  pause(paused: boolean) {
    this.timeline?.paused(paused);
  }

  scrub(progress: number) {
    this.timeline?.pause().progress(progress);
  }

  private recognise(x: number, y: number, strokeRadius: number) {
    const { recognition, snap } = this.config;
    const short = Math.min(this.width, this.height);
    const r = ringRadius(strokeRadius, short, snap.grow, recognition.minRingRadiusViewport, recognition.maxRingRadiusViewport);
    this.ring = { x, y, r };
    this.trail.morphTo = this.ring;
    this.fails = 0;
    navigator.vibrate?.(10);
    this.setPhase("snap");

    const hooks = {
      onIgnite: () => this.setPhase("ignition"),
      onOpen: () => this.setPhase("opening"),
      onDone: () => this.finish(),
    };
    this.timeline = this.motion ? buildOpening(this.fx, this.config, hooks) : buildReducedOpening(this.fx, this.config, hooks);
  }

  private finish() {
    if (this.destination) {
      this.destination.style.transform = "";
      this.destination.style.filter = "";
      this.destination.style.transformOrigin = "";
    }
    this.setPhase("done");
  }

  /** Back to the start. Used when the window changes size mid ritual. */
  private reset() {
    this.timeline?.kill();
    this.timeline = null;
    this.failTween?.kill();
    this.fx = restFx();
    this.trail.clear();
    if (this.destination) {
      this.destination.style.transform = "";
      this.destination.style.filter = "";
    }
    if (this.cover) this.cover.style.opacity = "";
    this.setPhase("idle");
  }

  private setPhase(phase: Phase, miss?: Miss) {
    this.phase = phase;
    this.onPhase?.(phase, miss);
  }

  // ---- the frame ----

  enter() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    // Compile every shader before the first frame, so the first ignition never hitches.
    this.renderer.compile(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  update(dt: number, elapsed: number) {
    const { camera: c, opening, ignition, film } = this.config;
    const { fx } = this;
    const t = elapsed;

    // Ease toward the pointer. Frame rate independent.
    this.lean.lerp(this.pointer, (1 - Math.exp(-dt * c.leanSpeed)) * this.motion);

    const yaw = (this.lean.x * c.leanDegrees * Math.PI) / 180;
    const pitch = (this.lean.y * c.leanDegrees * Math.PI) / 180;
    this.camera.rotation.set(pitch, -yaw, 0);
    this.camera.position.set(
      this.lean.x * c.leanShift + Math.sin(t * 0.11) * c.drift,
      this.lean.y * c.leanShift + Math.sin(t * 0.083 + 1.3) * c.drift,
      Math.sin(t * 0.19) * c.breathe - fx.push * ignition.cameraPush * PLANET_DEPTH,
    );

    // The haze is at infinity: it follows the turn of the camera, not its slide.
    const perHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360);
    this.nebula.render(this.renderer, t, Math.tan(yaw) / perHeight, Math.tan(pitch) / perHeight);

    this.stars.update(t, fx.stars);
    this.planet.update(t, this.config.planet.turnsPerMinute);
    this.moon.update(t, this.config.planet.turnsPerMinute * 1.6);
    this.dust.update(dt * this.motion);

    this.trail.morph = fx.morph;
    this.trail.update(dt, fx.trail, this.phase === "drawing");

    // The ring, in height units: origin mid screen, y up, screen 1 tall.
    const { width: w, height: h, ring } = this;
    const cx = (ring.x - w / 2) / h;
    const cy = (h / 2 - ring.y) / h;
    const r0 = ring.r / h;
    const corner = Math.hypot(Math.max(ring.x, w - ring.x), Math.max(ring.y, h - ring.y)) / h;
    // Slow, then very fast: the radius grows by a constant factor per unit of `open`.
    const radius = r0 * Math.pow((corner * 1.3) / r0, fx.open);

    this.lens.set(cx, cy, radius, fx.lens);
    this.glow.set({
      x: cx,
      y: cy,
      radius,
      ringI: fx.ringI,
      ringW: fx.ringW,
      ringSplit: fx.ringSplit,
      thin: fx.thin,
      guide: fx.guide,
      guideRadius: (Math.min(w, h) * DEFAULT_RADIUS) / h,
      pull: fx.pull,
      warp: fx.warp,
      swell: fx.swell,
      lens: fx.lens,
      clock: this.clock,
    });
    const fringe = film.edgeFringe + fx.fringe;
    this.fringe.offset.set(fringe, fringe);
    this.final.uniforms.uCenter.value.set(cx, cy);
    this.final.uniforms.uHole.value = fx.hole > 0 ? radius : 0;
    this.final.uniforms.uClock.value = this.clock;

    if (this.cover) this.cover.style.opacity = fx.cover < 1 ? String(fx.cover) : "";
    if (this.destination && this.phase === "opening" && this.motion) {
      const scale = opening.destinationScale + (1 - opening.destinationScale) * fx.settle;
      const blur = opening.destinationBlurPx * (1 - fx.settle);
      this.destination.style.transformOrigin = `${ring.x}px ${ring.y}px`;
      this.destination.style.transform = `scale(${scale.toFixed(4)})`;
      this.destination.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
    }
  }

  resize() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    // Only a real change of shape restarts the ritual. A phone's address bar
    // sliding away changes the height by a little and must not.
    const changed =
      Math.abs(width - this.width) > this.width * 0.12 || Math.abs(height - this.height) > this.height * 0.12;
    this.width = width;
    this.height = height;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const cap = coarse ? this.config.quality.dprMobile : this.config.quality.dprDesktop;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);

    this.renderer.setPixelRatio(dpr);
    this.composer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.nebula.resize(width * dpr, height * dpr);
    this.stars.resize(height, dpr);
    this.trail.resize(width, height, dpr);
    this.glow.setBufferSize(Math.floor(width * dpr), Math.floor(height * dpr));
    this.final.uniforms.uAspect.value = width / height;
    this.layout();

    // A resize or rotation mid ritual starts it over cleanly.
    if (changed && this.phase !== "idle" && this.phase !== "done") this.reset();
  }

  teardown() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.timeline?.kill();
    this.failTween?.kill();
    this.nebula.dispose();
    this.stars.dispose();
    this.planet.dispose();
    this.moon.dispose();
    this.dust.dispose();
    this.trail.dispose();
    this.final.dispose();
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
    this.clock += dtMs / 1000;
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
