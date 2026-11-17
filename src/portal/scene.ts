import { HalfFloatType, PerspectiveCamera, Quaternion, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ShaderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import type { PortalConfig } from "./config";
import { RushEffect, createFinalMaterial } from "./effects";
import { Wormhole } from "./layers/wormhole";
import { buildDive, buildReducedDive, restFx, type Fx } from "./ritual";

export type FrameStats = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  dpr: number;
};

/**
 * idle      the wormhole, waiting
 * wrapping  the camera is rising over the hole; the disc is becoming a circle
 * falling   past the point of no return, on the way down the throat
 * opening   the site is growing out of the light at the bottom
 * done      the site is open; the scene can be torn down
 */
export type Phase = "idle" | "wrapping" | "falling" | "opening" | "done";

/** Shares of the point cloud to draw, from full quality down. */
const SHARES = [1, 0.66, 0.44, 0.28];

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The Portal scene. Vanilla Three.js on purpose: this class owns the frame
 * loop and every GPU upload. React only mounts the canvas and calls the hooks.
 *
 *   enter()     start rendering
 *   update()    advance one frame
 *   resize()    match the canvas to its box
 *   teardown()  stop and free everything
 *
 * It also runs the way in: begin("scroll") plays it through, begin("hold")
 * and release() play it for as long as the screen is held.
 */
export class PortalScene {
  onStats?: (stats: FrameStats) => void;
  /** Called once, after the first frame is on screen. */
  onReady?: () => void;
  onPhase?: (phase: Phase) => void;

  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private scene = new Scene();
  private camera: PerspectiveCamera;

  private wormhole = new Wormhole();
  private rush = new RushEffect();
  private bloom: BloomEffect;
  private final = createFinalMaterial();

  private raf = 0;
  private running = false;
  private ready = false;
  private lastTime = 0;
  private elapsed = 0;
  private clock = 0;
  /** Rolling average of frame time. The quality steps read this. */
  private frameMs = 1000 / 60;
  private width = 1;
  private height = 1;

  private pointer = new Vector2();
  private lean = new Vector2();
  /** 0 freezes drift, lean and flow. Set from prefers-reduced-motion. */
  private motion = 1;

  private phase: Phase = "idle";
  private fx: Fx = restFx();
  private timeline: gsap.core.Timeline | null = null;
  /** True once nothing can call it back: a scroll, or a hold that reached the fall. */
  private committed = false;
  /** Which step of SHARES is in use, and how long the frame time has sat on either side of the limits. */
  private tier = 0;
  private slowFor = 0;
  private fastFor = 0;
  private settle = 3;
  private cover: HTMLElement | null = null;
  private destination: HTMLElement | null = null;

  // Scratch values for the camera path, reused every frame.
  private axis = new Vector3();
  private upEnd = new Vector3();
  private restPosition = new Vector3();
  private restTurn = new Quaternion();
  private lookTurn = new Quaternion();
  private from = new Vector3();
  private to = new Vector3();
  private rig = new PerspectiveCamera();

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
    this.scene.add(this.wormhole.group);

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 });
    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera, this.rush));
    this.composer.addPass(
      new EffectPass(this.camera, this.bloom, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })),
    );
    this.composer.addPass(new ShaderPass(this.final, "inputBuffer"));

    this.setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.applyConfig();
    this.resize();
  }

  /** Re-read the config. The debug panel calls this after every change. */
  applyConfig() {
    const { config } = this;
    this.wormhole.apply(config, window.matchMedia("(pointer: coarse)").matches);
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

  /** Pointer position, -1 to 1 on each axis, y up. Ignored once the way in has started. */
  setPointer(x: number, y: number) {
    if (this.phase === "idle") this.pointer.set(x, y);
  }

  // ---- the way in ----

  /**
   * "scroll" plays the whole thing and cannot be called back.
   * "hold" plays it for as long as the screen is held: see release().
   */
  begin(mode: "scroll" | "hold") {
    if (this.phase === "falling" || this.phase === "opening" || this.phase === "done") return;
    if (!this.timeline) {
      const hooks = {
        onFall: () => {
          this.committed = true;
          this.setPhase("falling");
        },
        onOpen: () => this.setPhase("opening"),
        onDone: () => this.finish(),
        onReturned: () => this.setPhase("idle"),
      };
      this.timeline = this.motion
        ? buildDive(this.fx, this.config, hooks)
        : buildReducedDive(this.fx, this.config, hooks);
    }
    if (mode === "scroll") this.committed = true;
    this.pointer.copy(this.lean); // hold the camera's lean where it is
    if (this.phase === "idle") this.setPhase("wrapping");
    this.timeline.timeScale(1).play();
  }

  /** The hold was let go. Before the fall, everything eases back to rest. After it, nothing changes. */
  release() {
    if (this.committed || this.phase !== "wrapping" || !this.timeline) return;
    this.timeline.timeScale(this.config.dive.returnSpeed).reverse();
  }

  /** For the debug panel: hold the timeline still, or move it by hand. */
  pause(paused: boolean) {
    if (paused) this.timeline?.pause();
    else this.timeline?.timeScale(1).play();
  }

  scrub(progress: number) {
    if (!this.timeline || this.phase === "idle") this.begin("scroll");
    this.timeline?.pause().progress(progress);
  }

  private finish() {
    this.clearDestination();
    this.setPhase("done");
  }

  private clearDestination() {
    if (!this.destination) return;
    this.destination.style.transform = "";
    this.destination.style.filter = "";
    this.destination.style.transformOrigin = "";
  }

  /** Back to the start. Used when the window changes shape mid way. */
  private reset() {
    this.timeline?.kill();
    this.timeline = null;
    this.committed = false;
    this.fx = restFx();
    this.clearDestination();
    if (this.cover) this.cover.style.opacity = "";
    this.setPhase("idle");
  }

  private setPhase(phase: Phase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.onPhase?.(phase);
  }

  // ---- the frame ----

  enter() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    // Compile every shader before the first frame, so the way in never hitches.
    this.renderer.compile(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  }

  update(dt: number, elapsed: number) {
    const { camera: c, dive, opening, wormhole: hole } = this.config;
    const { fx } = this;
    const t = elapsed;

    // Ease toward the pointer. Frame rate independent.
    this.lean.lerp(this.pointer, (1 - Math.exp(-dt * c.leanSpeed)) * this.motion);

    // At rest: a slow drift and a lean toward the pointer.
    const still = 1 - smooth(fx.wrap);
    const yaw = (this.lean.x * c.leanDegrees * Math.PI) / 180;
    const pitch = (this.lean.y * c.leanDegrees * Math.PI) / 180;
    this.rig.rotation.set(pitch * still, -yaw * still, 0);
    this.restTurn.copy(this.rig.quaternion);
    this.restPosition.set(
      (this.lean.x * c.leanShift + Math.sin(t * 0.11) * c.drift) * still,
      (this.lean.y * c.leanShift + Math.sin(t * 0.083 + 1.3) * c.drift) * still,
      Math.sin(t * 0.19) * c.breathe * still,
    );

    // The hole: where it is and which way it faces.
    const centre = this.wormhole.group.position;
    this.axis.set(0, 1, 0).applyQuaternion(this.wormhole.group.quaternion);
    // Looking straight down the hole, "up" on screen is the far side of the disc.
    this.upEnd.set(0, 0, -1).addScaledVector(this.axis, this.axis.z).normalize();

    // The wrap swings the camera from where it rests to a point high over the
    // hole, keeping its eye on the centre, so the tilted disc opens into a circle.
    // The fall then takes it straight down the axis.
    const w = smooth(fx.wrap);
    // High enough that the whole ring fits: on a tall, narrow screen that means higher.
    const fit = (1.3 * hole.innerRadius) / (0.8 * Math.tan((c.fov * Math.PI) / 360) * this.camera.aspect);
    const over = Math.max(hole.innerRadius * dive.height, fit);
    const down = this.wormhole.floorDepth * dive.depth;
    this.from.copy(this.restPosition).sub(centre);
    this.to.copy(this.axis).multiplyScalar(over);
    const reach = this.from.length() + (over - this.from.length()) * w;
    this.from.normalize().lerp(this.to.normalize(), w).normalize().multiplyScalar(reach);
    this.camera.position.copy(centre).add(this.from);
    this.camera.position.addScaledVector(this.axis, -(over + down) * fx.fall);

    this.rig.position.copy(this.camera.position);
    this.rig.up.set(0, 1, 0).lerp(this.upEnd, w).normalize();
    this.to.copy(centre).addScaledVector(this.axis, -(over + down) * fx.fall - down);
    this.rig.lookAt(this.to);
    this.lookTurn.copy(this.rig.quaternion);
    this.camera.quaternion.copy(this.restTurn).slerp(this.lookTurn, smooth(Math.min(1, fx.wrap * 2.5)));

    // The lens widens with the fall.
    const fov = c.fov + (dive.fovEnd - c.fov) * fx.fall * fx.fall;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const dpr = this.renderer.getPixelRatio();
    this.wormhole.setScale((this.height * dpr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360)), dpr);

    // The pull speeds the whole disc up.
    this.wormhole.update(dt * this.motion, dt, hole.flow * (1 + fx.pull * dive.pullBoost), fx.glow);

    // The opening grows from the middle of the screen. Slow, then very fast:
    // the radius grows by a constant factor per unit of `open`.
    const corner = Math.hypot(this.width, this.height) / 2 / this.height;
    const radius = 0.006 * Math.pow((corner * 1.3) / 0.006, fx.open);
    this.rush.set(radius, fx.rim, fx.streaks, this.clock);
    this.final.uniforms.uHole.value = fx.hole > 0 ? radius : 0;
    this.final.uniforms.uClock.value = this.clock;

    if (this.cover) this.cover.style.opacity = fx.cover < 1 ? String(fx.cover) : "";
    if (this.destination && this.phase === "opening" && this.motion) {
      const scale = opening.destinationScale + (1 - opening.destinationScale) * fx.settle;
      const blur = opening.destinationBlurPx * (1 - fx.settle);
      this.destination.style.transformOrigin = "50% 50%";
      this.destination.style.transform = `scale(${scale.toFixed(4)})`;
      this.destination.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
    }
  }

  resize() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    // Only a real change of shape starts it over. A phone's address bar
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

    this.rush.setBufferSize(Math.floor(width * dpr), Math.floor(height * dpr));
    this.final.uniforms.uAspect.value = width / height;
    this.layout();

    if (changed && this.phase !== "idle" && this.phase !== "done") this.reset();
  }

  teardown() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.timeline?.kill();
    this.wormhole.dispose();
    this.final.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  /** Place the hole by screen fraction, so portrait and landscape both compose. */
  private layout() {
    const hole = this.config.wormhole;
    const tan = Math.tan((this.config.camera.fov * Math.PI) / 360);
    const halfHeight = hole.depth * tan;
    const halfWidth = halfHeight * this.camera.aspect;
    this.wormhole.place(hole.x * halfWidth, hole.y * halfHeight, -hole.depth);
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
    this.adapt(dtMs / 1000);
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

  /**
   * Hold the frame rate. If frames run long for a while, draw a smaller share
   * of the point cloud; if they run short, draw more. Only the density
   * changes. The experience is the same on every device.
   */
  private adapt(dt: number) {
    const { stepDownMs, stepUpMs, cooldownMs } = this.config.quality;
    this.settle -= dt;
    this.slowFor = this.frameMs > stepDownMs ? this.slowFor + dt : 0;
    this.fastFor = this.frameMs < stepUpMs ? this.fastFor + dt : 0;
    // Leave it alone while it settles, and once the way in has started.
    if (this.settle > 0 || this.phase !== "idle") return;

    let next = this.tier;
    if (this.slowFor > 0.6 && this.tier < SHARES.length - 1) next++;
    else if (this.fastFor > 4 && this.tier > 0) next--;
    if (next === this.tier) return;
    this.tier = next;
    this.wormhole.setShare(SHARES[next]);
    this.settle = cooldownMs / 1000;
    this.slowFor = this.fastFor = 0;
  }

  private onVisibility = () => {
    // Skip the long gap after a hidden tab so it does not count as a slow frame.
    if (!document.hidden) this.lastTime = performance.now();
  };
}
