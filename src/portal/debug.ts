import GUI from "lil-gui";
import type { PortalConfig } from "./config";
import type { FrameStats } from "./scene";

/**
 * Debug tools, loaded only when the URL has ?debug.
 * The panel is generated from the config object: one folder per group, a
 * colour picker for hex strings and a number field for everything else.
 */
export function createDebug(config: PortalConfig, onChange: () => void) {
  const gui = new GUI({ title: "Portal" });

  for (const [groupName, group] of Object.entries(config)) {
    const folder = gui.addFolder(groupName);
    const values = group as Record<string, string | number>;
    for (const key of Object.keys(values)) {
      const control =
        typeof values[key] === "string" ? folder.addColor(values, key) : folder.add(values, key);
      control.onChange(onChange);
    }
    if (groupName !== "space") folder.close();
  }

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
    },
  };
}
