// Stills of the Portal entry at every beat, for milestone reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m4          writes docs/portal/shots/m4/
//   pnpm portal:shots m4 http://localhost:3001
//
// It draws a circle with pointer events, then pauses the opening timeline and
// steps through it. Headless Chromium renders WebGL in software, so the FPS
// it prints is a smoke test, not a result, and it is too slow to record video.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "latest";
const base = process.argv[3] ?? "http://localhost:3000";
const out = path.join("docs", "portal", "shots", label);
fs.mkdirSync(out, { recursive: true });

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, circle: [640, 430, 190] },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, circle: [195, 400, 110] },
];
// Position on the master timeline, 0 to 1. With the default timings the snap
// ends near 0.07 and the ignition near 0.41.
const beats = [["3-snap", 0.045], ["4-ignition", 0.38], ["5-opening-early", 0.74], ["6-opening-mid", 0.87], ["7-opening-late", 0.95]];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

// Runs in the page: a hand drawn arc, as pointer events on the cover.
const draw = async ([cx, cy, r, from, to, steps]) => {
  const cover = document.querySelector(".portal-cover");
  cover.setPointerCapture = () => {};
  const fire = (type, x, y) =>
    cover.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: "mouse", button: 0, buttons: 1, isPrimary: true }));
  const at = (a) => [cx + r * Math.cos(a) * (1 + 0.05 * Math.sin(a * 2.3) + 0.02 * Math.sin(a * 6)), cy + r * 0.93 * Math.sin(a) * (1 + 0.04 * Math.cos(a * 3))];
  if (from === -2) fire("pointerdown", ...at(from));
  for (let i = 1; i <= steps; i++) {
    fire("pointermove", ...at(from + (i / steps) * (to - from)));
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (window.__portal.phase !== "drawing") break;
  }
};

let failed = false;
for (const { name, circle, ...options } of viewports) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const shot = (file) => page.screenshot({ path: path.join(out, `${name}-${file}.jpg`), type: "jpeg", quality: 90 });

  await page.goto(`${base}/?debug`, { waitUntil: "networkidle" });
  await page.locator("canvas[data-ready]").waitFor({ timeout: 90000 });
  await page.waitForTimeout(4500);
  const reading = (await page.locator("[data-portal-fps]").innerText()).replace(/\s+/g, " ");
  await page.evaluate(() => {
    document.querySelector(".lil-gui").style.display = "none";
    document.querySelector("[data-portal-fps]").style.display = "none";
  });
  await shot("1-arrival");

  await page.evaluate(draw, [...circle, -2, 2.7, 110]);
  await page.waitForTimeout(250);
  await shot("2-drawing");

  // Close the loop. The ring should take over before the hand lifts.
  await page.evaluate(draw, [...circle, 2.7, 4.3, 40]);
  const phase = await page.evaluate(() => {
    window.__portal.pause(true);
    return window.__portal.phase;
  });
  for (const [file, at] of beats) {
    await page.evaluate((progress) => window.__portal.scrub(progress), at);
    await page.waitForTimeout(1100);
    await shot(file);
  }

  console.log(`${name}: ${reading} | loop closed mid stroke: ${phase !== "drawing"}${errors.length ? `\n  errors: ${errors.join(" | ")}` : ""}`);
  if (errors.length || phase === "drawing") failed = true;
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
