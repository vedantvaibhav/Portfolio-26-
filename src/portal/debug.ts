import GUI from "lil-gui";
import type { PortalConfig } from "./config";
import type { FrameStats, PortalScene } from "./scene";

/**
 * Debug tools, loaded only when the URL has ?debug.
 * The panel is generated from the config object: one folder per group, a
 * colour picker for hex strings and a number field for everything else.
 * The timeline folder runs the opening without drawing, and scrubs it.
 */
export function createDebug(config: PortalConfig, scene: PortalScene) {
  const gui = new GUI({ title: "Portal" });

  const timeline = {
    "ignite at centre": () => scene.igniteAtCentre(),
    paused: false,
    progress: 0,
  };
  const folder = gui.addFolder("timeline");
  folder.add(timeline, "ignite at centre");
  folder.add(timeline, "paused").onChange((paused: boolean) => scene.pause(paused));
  folder.add(timeline, "progress", 0, 0.999, 0.001).onChange((progress: number) => scene.scrub(progress));

  for (const [groupName, group] of Object.entries(config)) {
    const groupFolder = gui.addFolder(groupName);
    const values = group as Record<string, string | number>;
    for (const key of Object.keys(values)) {
      const control =
        typeof values[key] === "string" ? groupFolder.addColor(values, key) : groupFolder.add(values, key);
      control.onChange(() => scene.applyConfig());
    }
    groupFolder.close();
  }

  // For screenshots and tests: window.__portal.igniteAtCentre(), .scrub(0.4), .strokeStart(x, y) and so on.
  (window as unknown as { __portal?: PortalScene }).__portal = scene;

  const meter = document.createElement("div");
  meter.setAttribute("data-portal-fps", "");
  meter.style.cssText =
    "position:fixed;top:12px;left:12px;z-index:1000;padding:6px 10px;border-radius:6px;" +
    "background:rgba(0,0,0,0.6);color:#e9e6de;font:12px/1.4 var(--font-mono),ui-monospace,monospace;" +
    "font-variant-numeric:tabular-nums;pointer-events:none;white-space:pre";
  meter.textContent = "-- fps";
  document.body.appendChild(meter);

  let lastPaint = 0;

  return {
    update(stats: FrameStats) {
      const now = performance.now();
      if (now - lastPaint < 250) return;
      lastPaint = now;
      meter.textContent =
        `${stats.fps.toFixed(0)} fps  ${stats.frameMs.toFixed(1)} ms\n` +
        `${stats.drawCalls} draw calls  dpr ${stats.dpr.toFixed(2)}`;
    },
    destroy() {
      gui.destroy();
      meter.remove();
      delete (window as unknown as { __portal?: PortalScene }).__portal;
    },
  };
}
