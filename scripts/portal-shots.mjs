// Stills of the Portal entry at every beat, for reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m7          writes docs/portal/shots/m7/
//   pnpm portal:shots m7 http://localhost:3001
//
// It pauses the way in and steps through it, then checks that a short hold
// eases back and a scroll goes all the way. Headless Chromium renders WebGL
// in software, so the FPS it prints is a smoke test, not a result, and it is
// too slow to record video.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "latest";
const base = process.argv[3] ?? "http://localhost:3000";
const out = path.join("docs", "portal", "shots", label);
fs.mkdirSync(out, { recursive: true });

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];
// Position on the master timeline, 0 to 1. With the default timings the wrap
// ends near 0.45 and the opening starts near 0.67.
const beats = [["2-wrap-half", 0.24], ["3-wrap-done", 0.45], ["4-fall", 0.6], ["5-opening-early", 0.74], ["6-opening-mid", 0.86], ["7-opening-late", 0.95]];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let failed = false;
for (const { name, ...options } of viewports) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const shot = (file) => page.screenshot({ path: path.join(out, `${name}-${file}.jpg`), type: "jpeg", quality: 90 });
  const phase = () => page.evaluate(() => window.__portal?.phase ?? "gone");

  await page.goto(`${base}/?debug`, { waitUntil: "networkidle" });
  // Software rendering is slow. Stop the scene from thinning the cloud to make up for it.
  await page.waitForFunction(() => window.__portal);
  await page.evaluate(() => (window.__portal.config.quality.stepDownMs = 1e9));
  await page.locator("canvas[data-ready]").waitFor({ timeout: 240000 });
  await page.waitForFunction(() => window.__portal.wormhole.total > 0, null, { timeout: 120000 });
  await page.waitForTimeout(6000);
  const reading = (await page.locator("[data-portal-fps]").innerText()).replace(/\s+/g, " ");
  await page.evaluate(() => {
    document.querySelector(".lil-gui").style.display = "none";
    document.querySelector("[data-portal-fps]").style.display = "none";
  });
  await shot("1-arrival");

  // A short hold, let go early: it must come back to rest.
  await page.evaluate(() => window.__portal.begin("hold"));
  await page.waitForTimeout(500);
  const held = await phase();
  await page.evaluate(() => window.__portal.release());
  await page.waitForFunction(() => window.__portal.phase === "idle", null, { timeout: 20000 });

  for (const [file, at] of beats) {
    await page.evaluate((progress) => window.__portal.scrub(progress), at);
    await page.waitForTimeout(1300);
    await shot(file);
  }

  // Let it run to the end: the cover must go and focus must land on the page.
  await page.evaluate(() => window.__portal.pause(false));
  await page.waitForFunction(() => !document.querySelector(".portal-cover"), null, { timeout: 30000 });
  const focus = await page.evaluate(() => document.activeElement?.tagName);

  const ok = held === "wrapping" && focus === "H1";
  console.log(`${name}: ${reading} | hold eases back: ${held === "wrapping"} | ends on the page: ${focus === "H1"}${errors.length ? `\n  errors: ${errors.join(" | ")}` : ""}`);
  if (errors.length || !ok) failed = true;
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
