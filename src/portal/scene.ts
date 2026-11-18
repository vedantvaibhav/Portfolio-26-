import { HalfFloatType, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
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
import { createFinalMaterial } from "./effects";
import { Wormhole } from "./layers/wormhole";
import { buildDrain, buildReducedDrain, restFx, type Fx } from "./ritual";

export type FrameStats = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  dpr: number;
};

/**
 * idle       the wormhole, waiting
 * draining   the grains are being drawn into a point
 * appearing  the grains are gone and the text is in place; a short beat before the entry steps aside
 * done       the site is open; the scene can be torn down
 */
export type Phase = "idle" | "draining" | "appearing" | "done";

/** Shares of the point cloud to draw, from full quality down. */
const SHARES = [1, 0.66, 0.44, 0.28];

/**
 * The Portal scene. Vanilla Three.js on purpose: this class owns the frame
 * loop and every GPU upload. React only mounts the canvas and calls the hooks.
 *
 *   enter()     start rendering
 *   update()    advance one frame
 *   resize()    match the canvas to its box
 *   teardown()  stop and free everything
 *
 * It also runs the way in: go() drains the wormhole into the centre of the
 * hole, hold() and release() drain it into wherever the screen is held.
 */
export class PortalScene {
  onStats?: (stats: FrameStats) => void;
  /** Called once, after the first frame is on screen. */
  onReady?: () => void;
  /** Called once, when the point cloud has arrived and everything is in place. */
  onLoaded?: () => void;
  onPhase?: (phase: Phase) => void;

  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private scene = new Scene();
  private camera: PerspectiveCamera;

  private wormhole = new Wormhole();
  private bloom: BloomEffect;
  private final = createFinalMaterial();

  private raf = 0;
  private running = false;
  private ready = false;
  private loaded = false;
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
  /** True once nothing can call it back: a scroll, or a hold that drained everything. */
  private committed = false;
  /** Where the grains drain to, in screen space: -1 to 1, y up. It eases toward `aim`. */
  private target = new Vector2();
  private aim = new Vector2();
  /** Which step of SHARES is in use, and how long the frame time has sat on either side of the limits. */
  private tier = 0;
  private slowFor = 0;
  private fastFor = 0;
  private settle = 3;
  private cover: HTMLElement | null = null;
  private label: HTMLElement | null = null;
  /** The ring around the pointer that fills while the screen is held. */
  private ring: HTMLElement | null = null;
  private holding = false;
  /** Where the pointer is, eased, and how strongly the grains feel it. */
  private hoverAt = new Vector2();
  private hoverTo = new Vector2();
  private hoverWas = new Vector2();
  private hoverVel = new Vector2();
  private hoverTo2 = new Vector2();
  private hover = 0;
  private hoverUntil = 0;
  private holeAt = new Vector2();

  // Scratch values, reused.
  private axis = new Vector3();
  private lip = new Vector3();
  private origin = new Vector3();
  private ray = new Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    private config: PortalConfig,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false; // count draw calls across every pass

    this.camera = new PerspectiveCamera(config.camera.fov, 1, 0.5, 600);
    this.scene.add(this.wormhole.group);

    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 });
    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
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
    this.camera.fov = config.camera.fov;
    this.camera.updateProjectionMatrix();
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

  /** The cover fades to show the site. The destination settles into place as it does. */
  setElements(cover: HTMLElement | null, label: HTMLElement | null, ring: HTMLElement | null) {
    this.cover = cover;
    this.label = label;
    this.ring = ring;
  }

  /** Pointer position, -1 to 1 on each axis, y up. Ignored once the way in has started. */
  setPointer(x: number, y: number) {
    if (this.phase !== "idle") return;
    this.pointer.set(x, y);
    // The grains feel the pointer while it moves, and for a moment after.
    this.hoverTo.set(x, y);
    this.hoverUntil = performance.now() + this.config.hover.fadeAfterMs;
  }

  /** The pointer left the page. */
  clearPointer() {
    this.hoverUntil = 0;
  }

  // ---- the way in ----

  /** A scroll: drain into the centre of the hole. It cannot be called back. */
  go() {
    if (!this.loaded || this.phase === "appearing" || this.phase === "done") return;
    if (this.phase === "idle") {
      this.holeOnScreen(this.aim);
      this.target.copy(this.aim);
    }
    this.committed = true;
    this.holding = false;
    this.play(1);
  }

  /**
   * A press: drain into that point for as long as it is held. Positions are
   * CSS pixels from the top left of the canvas. Returns false, and does
   * nothing, if the point is not inside the hole.
   */
  hold(x: number, y: number) {
    if (!this.loaded || this.phase === "appearing" || this.phase === "done" || this.committed) return false;
    if (!this.insideHole(x, y)) return false;
    this.aim.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2);
    if (this.phase === "idle") this.target.copy(this.aim);
    this.holding = true;
    this.play(this.config.drain.holdSpeed);
    return true;
  }

  /** The hold moved. The point follows it while it stays inside the hole. */
  holdMove(x: number, y: number) {
    if (this.phase !== "draining" || this.committed) return;
    if (this.insideHole(x, y)) this.aim.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2);
  }

  /** The hold was let go. Before everything is gone, the grains come back. After, nothing changes. */
  release() {
    this.holding = false;
    if (this.committed || this.phase !== "draining" || !this.timeline) return;
    this.timeline.timeScale(this.config.drain.returnSpeed).reverse();
  }

  /** For the debug panel: hold the timeline still, or move it by hand. */
  pause(paused: boolean) {
    if (paused) this.timeline?.pause();
    else this.timeline?.timeScale(1).play();
  }

  scrub(progress: number) {
    if (!this.timeline || this.phase === "idle") this.go();
    this.timeline?.pause().progress(progress);
  }

  private play(speed: number) {
    if (!this.timeline) {
      const hooks = {
        onGone: () => {
          this.committed = true;
          this.holding = false;
          this.setPhase("appearing");
        },
        onDone: () => this.finish(),
        onReturned: () => this.setPhase("idle"),
      };
      this.timeline = this.motion
        ? buildDrain(this.fx, this.config, hooks)
        : buildReducedDrain(this.fx, this.config, hooks);
    }
    this.pointer.copy(this.lean); // hold the camera's lean where it is
    if (this.phase === "idle") this.setPhase("draining");
    this.timeline.timeScale(speed).play();
  }

  /** The centre of the hole's lip, in world space, and the way the hole faces. */
  private findHole() {
    this.axis.set(0, 1, 0).applyQuaternion(this.wormhole.group.quaternion);
    this.lip.copy(this.wormhole.group.position).addScaledVector(this.axis, -this.wormhole.lipDepth);
  }

  /** Where the centre of the hole is on screen, -1 to 1, y up. */
  private holeOnScreen(out: Vector2) {
    this.findHole();
    this.camera.updateMatrixWorld();
    this.ray.copy(this.lip).project(this.camera);
    return out.set(this.ray.x, this.ray.y);
  }

  /** Is this point of the screen over the black of the hole? Cast a ray and see where it meets the lip. */
  private insideHole(x: number, y: number) {
    this.findHole();
    this.camera.updateMatrixWorld();
    this.origin.setFromMatrixPosition(this.camera.matrixWorld);
    this.ray.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5).unproject(this.camera).sub(this.origin).normalize();
    const facing = this.ray.dot(this.axis);
    if (Math.abs(facing) < 1e-4) return false;
    const distance = this.lip.clone().sub(this.origin).dot(this.axis) / facing;
    if (distance <= 0) return false;
    const hit = this.origin.clone().addScaledVector(this.ray, distance);
    return hit.distanceTo(this.lip) <= this.config.wormhole.innerRadius * this.config.drain.reach;
  }

  private finish() {
    this.setPhase("done");
  }

  /** Back to the start. Used when the window changes shape mid way. */
  private reset() {
    this.timeline?.kill();
    this.timeline = null;
    this.committed = false;
    this.fx = restFx();
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
    const { camera: c, drain, wormhole: hole } = this.config;
    const { fx } = this;
    const t = elapsed;

    // A slow drift, and a lean toward the pointer. Frame rate independent.
    this.lean.lerp(this.pointer, (1 - Math.exp(-dt * c.leanSpeed)) * this.motion);
    const yaw = (this.lean.x * c.leanDegrees * Math.PI) / 180;
    const pitch = (this.lean.y * c.leanDegrees * Math.PI) / 180;
    this.camera.rotation.set(pitch, -yaw, 0);
    this.camera.position.set(
      this.lean.x * c.leanShift + Math.sin(t * 0.11) * c.drift,
      this.lean.y * c.leanShift + Math.sin(t * 0.083 + 1.3) * c.drift,
      Math.sin(t * 0.19) * c.breathe,
    );

    // The grains near the pointer step aside. It fades when the pointer rests, leaves, or the way in starts.
    const feel = this.phase === "idle" && performance.now() < this.hoverUntil ? 1 : 0;
    this.hover += (feel - this.hover) * (1 - Math.exp(-dt * 4));
    this.hoverWas.copy(this.hoverAt);
    this.hoverAt.lerp(this.hoverTo, 1 - Math.exp(-dt * this.config.hover.follow));
    // How fast the pointer is moving, eased, in screen heights per second. Capped so a flick does not fling grains.
    const perSecond = dt > 0 ? 0.5 / dt : 0;
    this.hoverTo2.set((this.hoverAt.x - this.hoverWas.x) * this.camera.aspect, this.hoverAt.y - this.hoverWas.y).multiplyScalar(perSecond);
    if (this.hoverTo2.length() > 2.5) this.hoverTo2.setLength(2.5);
    this.hoverVel.lerp(this.hoverTo2, 1 - Math.exp(-dt * 6));
    this.wormhole.setHover(this.hover * this.motion, this.hoverAt.x, this.hoverAt.y, this.hoverVel.x, this.hoverVel.y, this.clock);

    // The words in the middle of the hole stay in the middle of the hole as the camera leans.
    if (this.label) {
      this.holeOnScreen(this.holeAt);
      const x = ((this.holeAt.x + 1) / 2) * this.width;
      const y = ((1 - this.holeAt.y) / 2) * this.height;
      this.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }

    // The ring around the pointer fills as the hold goes on, and empties if it is let go.
    if (this.ring) {
      this.ring.style.setProperty("--hold", fx.drain.toFixed(4));
      this.ring.style.opacity = this.holding ? "1" : "0";
    }
    this.cover?.toggleAttribute("data-holding", this.holding);

    // The point the grains drain to follows the hold, a little behind it.
    this.target.lerp(this.aim, 1 - Math.exp(-dt * 10));
    this.wormhole.setDrain(fx.drain, this.target.x, this.target.y);
    // It builds late, like the grains themselves.
    this.wormhole.update(dt * this.motion, dt, hole.flow * (1 + fx.drain * fx.drain * fx.drain * drain.pullBoost), 1);
    this.final.uniforms.uClock.value = this.clock;

    // The text of the page comes up on the black as the grains leave. The page reads this value.
    document.documentElement.style.setProperty("--portal-reveal", fx.reveal.toFixed(4));
    document.documentElement.style.setProperty("--portal-reveal-grow", String(this.config.reveal.scale - 1));
    if (this.cover) this.cover.style.opacity = fx.cover < 1 ? String(fx.cover) : "";
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

    this.final.uniforms.uAspect.value = width / height;
    this.layout();

    if (changed && this.phase !== "idle" && this.phase !== "done") this.reset();
  }

  teardown() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.timeline?.kill();
    document.documentElement.style.removeProperty("--portal-reveal");
    document.documentElement.style.removeProperty("--portal-reveal-grow");
    this.wormhole.dispose();
    this.final.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  /** Place the hole by screen fraction from the centre, so portrait and landscape both compose. */
  private layout() {
    const hole = this.config.wormhole;
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfHeight = hole.depth * tan;
    const halfWidth = halfHeight * this.camera.aspect;
    const dpr = this.renderer.getPixelRatio();
    // Put the lip of the hole, the black circle itself, on that spot. With x and y
    // at 0 the black sits dead centre. The group's own origin is a little above the lip.
    this.axis.set(0, 1, 0).applyQuaternion(this.wormhole.group.quaternion).multiplyScalar(this.wormhole.lipDepth);
    this.wormhole.place(hole.x * halfWidth + this.axis.x, hole.y * halfHeight + this.axis.y, -hole.depth + this.axis.z);
    this.wormhole.setScale((this.height * dpr) / (2 * tan), dpr, this.camera.aspect);
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
    if (!this.loaded && this.wormhole.arrived) {
      this.loaded = true;
      this.onLoaded?.();
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
