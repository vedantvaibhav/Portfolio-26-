import { Color, HalfFloatType, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { EffectComposer, RenderPass } from "postprocessing";
import type { PortalConfig } from "./config";

export type FrameStats = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  dpr: number;
};

/**
 * The Portal scene. Vanilla Three.js on purpose: this class owns the frame
 * loop and every GPU upload. React only mounts the canvas and calls the hooks.
 *
 *   enter()     start rendering
 *   update()    advance one frame
 *   resize()    match the canvas to its box
 *   teardown()  stop and free everything
 *
 * Milestone 0: an empty scene that clears to the space colour.
 */
export class PortalScene {
  onStats?: (stats: FrameStats) => void;

  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private background = new Color();

  private raf = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;
  /** Rolling average of frame time. The quality tiers will read this. */
  private frameMs = 1000 / 60;

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

    this.camera = new PerspectiveCamera(config.camera.fov, 1, 0.1, 100);
    this.scene.background = this.background;

    // Effects (bloom, grain, tone mapping) join this composer in milestone 1.
    this.composer = new EffectComposer(this.renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.applyConfig();
    this.resize();
  }

  /** Re-read the config. The debug panel calls this after every change. */
  applyConfig() {
    this.background.set(this.config.space.deep);
    this.camera.fov = this.config.camera.fov;
    this.camera.updateProjectionMatrix();
  }

  enter() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.tick);
  }

  update(dt: number, elapsed: number) {
    // Nothing moves yet. Kept so the hook exists from the first milestone.
    void dt;
    void elapsed;
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
  }

  teardown() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.composer.dispose();
    this.renderer.dispose();
  }

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const dtMs = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    this.elapsed += dtMs / 1000;
    this.frameMs += (dtMs - this.frameMs) * 0.05;

    this.update(dtMs / 1000, this.elapsed);
    this.composer.render(dtMs / 1000);

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
