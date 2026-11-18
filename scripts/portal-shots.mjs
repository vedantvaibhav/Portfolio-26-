// Stills of the Portal entry at every beat, for reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m14         writes docs/portal/shots/m14/
//   pnpm portal:shots m14 http://localhost:3001
//
// It captures the loading number, the hold mark and a sweep of the pointer, checks the hold
// (inside the hole it drains to that point and reveals the text, outside it only
// shows where to hold, let go early and it all comes back), then pauses the way
// in and steps through it.
// Headless Chromium renders WebGL in software, so the FPS it prints is a smoke
// test, not a result, and it is too slow to record video.
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
// Position on the master timeline, 0 to 1. The grains are all gone near 0.83, and then the text comes up.
const beats = [["5-drain-a", 0.25], ["6-drain-b", 0.5], ["7-drain-c", 0.7], ["8-drain-d", 0.86], ["9-arrived", 0.99]];

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

  await page.goto(`${base}/?debug`, { waitUntil: "domcontentloaded" });
  // The loading screen: black, and a number.
  await page.locator(".portal-load").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => Number(document.querySelector(".portal-load").textContent) >= 20, null, { timeout: 120000 });
  const counted = await page.locator(".portal-load").innerText();
  await shot("1-loading");

  // Software rendering is slow. Stop the scene from thinning the cloud to make up for it.
  await page.waitForFunction(() => window.__portal, null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__portal.config.quality.stepDownMs = 1e9;
  });
  await page.locator("canvas[data-ready]").waitFor({ timeout: 240000 });
  await page.waitForTimeout(6000);
  const reading = (await page.locator("[data-portal-fps]").innerText()).replace(/\s+/g, " ");
  // Words a sighted visitor can see on the wormhole. The loading number has gone and the skip button only shows on keyboard focus.
  const seenWords = () =>
    page.evaluate(() =>
    [...document.querySelectorAll(".portal-cover *")]
      .filter((el) => el.children.length === 0 && el.textContent.trim())
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        let shown = style.visibility !== "hidden";
        for (let up = el; up && shown; up = up.parentElement) shown = Number(getComputedStyle(up).opacity) > 0.05;
        return box.width > 2 && box.height > 2 && shown;
      })
      .map((el) => el.textContent.trim())
      .join(" "),
    );
  const words = await seenWords();
  await page.evaluate(() => {
    document.querySelector(".lil-gui").style.display = "none";
    document.querySelector("[data-portal-fps]").style.display = "none";
  });
  await shot("2-arrival");

  // Sweep the pointer across the grains: it stirs the fluid and they are carried along its wake.
  if (!options.hasTouch) {
    const from = { x: options.viewport.width * 0.2, y: options.viewport.height * 0.7 };
    await page.mouse.move(from.x, from.y);
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(from.x + i * 28, from.y - i * 4);
      await page.waitForTimeout(60);
    }
    await shot("2b-hover-wake");
    await page.waitForTimeout(2500);
  }

  // A press in the corner is outside the hole: nothing drains, and a ring shows where to hold.
  await page.mouse.move(60, 60);
  await page.mouse.down();
  await page.waitForTimeout(420);
  const outside = await page.evaluate(() => window.__portal.phase);
  await shot("3-where-to-hold");
  await page.mouse.up();
  await page.waitForTimeout(1500);

  // A hold inside the hole, off its centre, must drain to that point and bring the text up.
  const hold = await page.evaluate(() => {
    const scene = window.__portal;
    const centre = scene.holeOnScreen(scene.aim.clone());
    const x = ((centre.x + 1) / 2) * innerWidth - innerWidth * 0.08;
    const y = ((1 - centre.y) / 2) * innerHeight;
    const inside = scene.hold(x, y);
    scene.pause(true);
    scene.timeline.progress(0.6);
    return inside;
  });
  await page.waitForTimeout(1300);
  const wordsHeld = await seenWords();
  await shot("4-hold");
  // Let go early: the grains and the text must go back.
  await page.evaluate(() => {
    window.__portal.pause(false);
    window.__portal.release();
  });
  await page.waitForFunction(() => window.__portal.phase === "idle", null, { timeout: 30000 });
  const hiddenAgain = await page.evaluate(() => getComputedStyle(document.querySelector(".portal-revealed")).opacity);

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

  const checks = {
    "loading number shows": Number(counted) >= 20,
    "only the hold mark's words on the wormhole": words === "Tap Hold",
    "the mark stays while holding": wordsHeld === "Tap Hold",
    "press outside does not drain": outside === "idle",
    "hold inside works": hold === true,
    "letting go hides the text": Number(hiddenAgain) < 0.02,
    "ends on the page": focus === "H1",
  };
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([what]) => what);
  console.log(`${name}: ${reading} | ${bad.length ? `FAILED: ${bad.join(", ")}` : "all checks pass"}` + (errors.length ? `\n  errors: ${errors.join(" | ")}` : ""));
  if (errors.length || bad.length) failed = true;
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
