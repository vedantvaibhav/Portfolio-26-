// Stills of the Portal entry at every beat, for reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m8          writes docs/portal/shots/m8/
//   pnpm portal:shots m8 http://localhost:3001
//
// It checks the hold (inside the hole it drains to that point, outside it does
// nothing, let go early and it comes back), then pauses the scroll version and
// steps through it. Headless Chromium renders WebGL in software, so the FPS it
// prints is a smoke test, not a result, and it is too slow to record video.
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
// Position on the master timeline, 0 to 1. With the default timings the
// grains are all gone near 0.65.
const beats = [["3-drain-a", 0.16], ["4-drain-b", 0.32], ["5-drain-c", 0.46], ["6-drain-d", 0.58], ["7-appearing", 0.82], ["8-arrived", 0.97]];

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

  // A hold in the corner of the screen is outside the hole and must do nothing.
  // A hold inside the hole, off its centre, must drain to that point.
  const hold = await page.evaluate(() => {
    const scene = window.__portal;
    const centre = scene.holeOnScreen(scene.aim.clone());
    const x = ((centre.x + 1) / 2) * innerWidth - innerWidth * 0.1;
    const y = ((1 - centre.y) / 2) * innerHeight;
    return { outside: scene.hold(4, 4), inside: scene.hold(x, y) };
  });
  await page.evaluate(() => {
    window.__portal.pause(true);
    window.__portal.timeline.progress(0.4);
  });
  await page.waitForTimeout(1300);
  await shot("2-hold-off-centre");
  // Let go early: the grains must come back.
  await page.evaluate(() => {
    window.__portal.pause(false);
    window.__portal.release();
  });
  await page.waitForFunction(() => window.__portal.phase === "idle", null, { timeout: 30000 });

  for (const [file, at] of beats) {
    await page.evaluate((progress) => {
      window.__portal.scrub(progress);
    }, at);
    await page.waitForTimeout(1300);
    await shot(file);
  }

  // Let it run to the end: the cover must go and focus must land on the page.
  await page.evaluate(() => {
    window.__portal.pause(false);
  });
  await page.waitForFunction(() => !document.querySelector(".portal-cover"), null, { timeout: 30000 });
  const focus = await page.evaluate(() => document.activeElement?.tagName);

  const ok = hold.inside === true && hold.outside === false && focus === "H1";
  console.log(
    `${name}: ${reading} | hold inside the hole works: ${hold.inside} | hold outside is ignored: ${!hold.outside} | ends on the page: ${focus === "H1"}` +
      (errors.length ? `\n  errors: ${errors.join(" | ")}` : ""),
  );
  if (errors.length || !ok) failed = true;
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
