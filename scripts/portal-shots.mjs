// Screenshots and a short screen capture of the Portal entry, for milestone reviews.
//
//   pnpm dev                      (in another terminal)
//   pnpm portal:shots m1          writes docs/portal/shots/m1/
//   pnpm portal:shots m1 http://localhost:3001
//
// Prints the FPS meter reading for each viewport. Headless Chromium renders
// WebGL in software here, so treat that number as a smoke test, not a result.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "latest";
const base = process.argv[3] ?? "http://localhost:3000";
const out = path.join("docs", "portal", "shots", label);
fs.mkdirSync(out, { recursive: true });

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let failed = false;
const report = (name, reading, errors) => {
  console.log(`${name}: ${reading}${errors.length ? `\n  errors: ${errors.join(" | ")}` : ""}`);
  if (errors.length) failed = true;
};
const watch = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const ready = (page) => page.locator("canvas[data-ready]").waitFor({ timeout: 60000 });

for (const { name, ...options } of viewports) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = watch(page);

  await page.goto(`${base}/?debug`, { waitUntil: "networkidle" });
  await ready(page);
  await page.waitForTimeout(4000);
  const reading = (await page.locator("[data-portal-fps]").innerText()).replace(/\s+/g, " ");
  await page.screenshot({ path: path.join(out, `${name}-debug.png`) });

  await page.goto(base, { waitUntil: "networkidle" });
  await ready(page);
  await page.waitForTimeout(4500); // canvas fade and prompt fade
  await page.screenshot({ path: path.join(out, `${name}.png`) });

  if (!options.isMobile) {
    await page.mouse.move(1380, 80);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `${name}-lean.png`) });
  }

  report(name, reading, errors);
  await context.close();
}

// A short capture of the arrival with the pointer moving, to show the parallax.
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(base, { waitUntil: "networkidle" });
  await ready(page);
  await page.waitForTimeout(3500);
  for (const [x, y] of [[1100, 160], [240, 560], [640, 360]]) {
    await page.mouse.move(x, y, { steps: 30 });
    await page.waitForTimeout(1500);
  }
  const video = page.video();
  await context.close();
  fs.renameSync(await video.path(), path.join(out, "arrival.webm"));
  report("capture", "arrival.webm", errors);
}

await browser.close();
process.exit(failed ? 1 : 0);
